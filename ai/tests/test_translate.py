"""S7: translation (MASTERSPEC 7.6). A second pass over the validated English; every translated string
is validated again with the English placeholders required. Gemini is replaced by a fake translator."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from ai.config import contract, load_settings
from ai.gemini import GeminiError
from ai.main import app, get_generate, get_settings

BRIEFING = contract("fixtures/briefing.request.json")
EXPLAIN = contract("fixtures/explain.request.json")
BRIEFING_SCHEMA = Draft202012Validator(contract("schemas/briefing.response.schema.json"))
EXPLAIN_SCHEMA = Draft202012Validator(contract("schemas/explain.response.schema.json"))
BRIEFING_EN = {s["id"]: s["template_text"] for s in contract("fixtures/briefing.04.en.json")["sections"]
               if s["id"] != "questions"}
EXPLAIN_EN = {"template_text": contract("fixtures/explain.response.json")["template_text"]}


def french(english: dict) -> dict:
    return {k: f"FR {v}" for k, v in english.items()}


class FakeGemini:
    """Writes the English drafts, and 'translates' by calling translator on the JSON in the prompt."""

    def __init__(self, translator=french):
        self.translator = translator
        self.calls: list[str] = []

    def __call__(self, prompt, schema, *, model=None):
        self.calls.append(schema.__name__)
        if schema.__name__ == "BriefingDraft":
            return schema(**BRIEFING_EN)
        if schema.__name__ == "ExplainDraft":
            return schema(**EXPLAIN_EN)
        english = json.loads(prompt.split("JSON:\n", 1)[1].split("\n\nYour draft", 1)[0])
        reply = self.translator(english)
        if isinstance(reply, Exception):
            raise reply
        return schema(**reply)


@pytest.fixture
def settings(tmp_path):
    return replace(load_settings(), cache_dir=tmp_path / "cache", log_dir=tmp_path / "logs",
                   suplex_web_url="http://localhost:5173", suplex_ai_url="http://localhost:8001")


@pytest.fixture
def client(settings):
    app.dependency_overrides[get_settings] = lambda: settings
    yield TestClient(app)
    app.dependency_overrides.clear()


def use(fake):
    app.dependency_overrides[get_generate] = lambda: fake
    return fake


def briefing(client, lang="fr"):
    response = client.post("/briefing", json={**BRIEFING, "lang": lang})
    assert response.status_code == 200, response.text
    return response.json()


def test_french_briefing_keeps_every_placeholder_and_formats_numbers_for_french(client):
    use(FakeGemini())
    body = briefing(client)
    assert not list(BRIEFING_SCHEMA.iter_errors(body))
    assert body["lang"] == "fr" and body["translation_unavailable"] is False
    what = body["sections"][0]
    assert what["template_text"].startswith("FR ") and "{{could_lots}}" in what["template_text"]
    assert "3 900" in what["text"] and "32,5" in what["text"]  # Intl-style French separators
    assert body["title"] == "FR Ward 04, Parkdale–High Park: multiplexes, before you vote"
    assert all(h["heading"].startswith("FR ") for h in body["sections"])
    assert all(q.startswith("FR ") for q in body["questions"]) and len(body["questions"]) == 3
    assert body["disclaimer"].startswith("FR ")
    assert set(body["numbers"]) == set(contract("fixtures/briefing.04.en.json")["numbers"])


def test_translation_is_cached_per_language(client):
    fake = use(FakeGemini())
    briefing(client)
    second = briefing(client)
    assert second["cached"] is True
    assert fake.calls == ["BriefingDraft", "Translation"]
    briefing(client, "es")
    assert fake.calls == ["BriefingDraft", "Translation", "Translation"]  # English reused, Spanish is new


def drop_placeholder(english):
    return {k: v.replace("{{did_permits}}", "quarante et un") for k, v in french(english).items()}


def invent_number(english):
    return {k: v + " 1 300" if k == "section_what_may_fit" else v for k, v in french(english).items()}


def drop_title_token(english):
    return {k: v.replace("{ward_name}", "Parkdale") for k, v in french(english).items()}


@pytest.mark.parametrize("translator", [drop_placeholder, invent_number, drop_title_token])
def test_a_bad_translation_is_rejected_twice_then_english_is_served(client, settings, translator):
    fake = use(FakeGemini(translator))
    body = briefing(client)
    assert body["translation_unavailable"] is True and body["lang"] == "fr"
    assert not body["sections"][0]["template_text"].startswith("FR ")
    assert fake.calls == ["BriefingDraft", "Translation", "Translation"]
    log = [json.loads(line) for line in (settings.log_dir / "rejections.jsonl").read_text().splitlines()]
    assert [entry["endpoint"] for entry in log] == ["briefing:translate:fr"] * 2
    briefing(client)
    assert len(fake.calls) == 3  # the double rejection is cached: same inputs, same result


def test_numeric_month_is_allowed_in_translations_only(client):
    def chinese(english):
        return {k: v.replace("May 2023", "2023年5月") for k, v in french(english).items()}

    use(FakeGemini(chinese))
    body = briefing(client, "zh-Hans")
    assert body["translation_unavailable"] is False
    assert "2023年5月" in next(s for s in body["sections"] if s["id"] == "permits")["template_text"]


def test_english_never_gets_the_month_allowance(client):
    from ai.tests.test_briefing import GOOD
    invented = {**GOOD, "permits": "Since May 2023, about 5 multiplex permits were issued here."}
    app.dependency_overrides[get_generate] = lambda: lambda prompt, schema, *, model=None: schema(**invented)
    assert briefing(client, "en")["source"] == "template"


def test_gemini_error_during_translation_is_not_cached(client):
    fake = use(FakeGemini(lambda english: GeminiError("quota")))
    assert briefing(client)["translation_unavailable"] is True
    briefing(client)
    assert fake.calls == ["BriefingDraft", "Translation", "Translation"]  # tried again


def test_template_english_is_not_translated(client):
    fake = FakeGemini()
    use(lambda prompt, schema, *, model=None: (_ for _ in ()).throw(GeminiError("down"))
        if schema.__name__ == "BriefingDraft" else fake(prompt, schema, model=model))
    body = briefing(client)
    assert body["source"] == "template" and body["translation_unavailable"] is True
    assert "Translation" not in fake.calls


def test_french_explanation(client):
    use(FakeGemini())
    response = client.post("/explain", json={**EXPLAIN, "lang": "fr"})
    body = response.json()
    assert not list(EXPLAIN_SCHEMA.iter_errors(body))
    assert body["translation_unavailable"] is False and body["template_text"].startswith("FR ")
    assert "7,62" in body["text"] and body["disclaimer"].startswith("FR ")
