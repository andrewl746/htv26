"""S7: translation (MASTERSPEC 7.6). A second pass over the validated English; every translated string
is validated again with the English placeholders required. Gemini is replaced by a fake translator."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from ai.config import PROMPTS_DIR, contract, load_json, load_settings
from ai.gemini import GeminiError
from ai.main import app, get_generate, get_settings
from ai.tests.fakes import fake_translate

BRIEFING = contract("fixtures/briefing.request.json")
EXPLAIN = contract("fixtures/explain.request.json")
BRIEFING_SCHEMA = Draft202012Validator(contract("schemas/briefing.response.schema.json"))
EXPLAIN_SCHEMA = Draft202012Validator(contract("schemas/explain.response.schema.json"))
BRIEFING_EN = {s["id"]: s["template_text"] for s in contract("fixtures/briefing.04.en.json")["sections"]
               if s["id"] != "questions"}
EXPLAIN_EN = {"template_text": contract("fixtures/explain.response.json")["template_text"]}


def french(english: dict) -> dict:
    return fake_translate(english, "FR ")


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
    assert all(h["heading"].startswith("FR ") for h in body["sections"] if h["id"] != "blocking_rule")  # glossary-fixed
    assert all(q.startswith("FR ") for q in body["questions"]) and len(body["questions"]) == 3
    assert body["disclaimer"].startswith("FR ")
    assert set(body["numbers"]) == set(contract("fixtures/briefing.04.en.json")["numbers"])


def test_translation_is_cached_per_language(client):
    fake = use(FakeGemini())
    briefing(client)
    second = briefing(client)
    assert second["cached"] is True
    assert fake.calls == ["BriefingDraft", "Translation"]
    assert briefing(client, "en")["cached"] is True
    assert fake.calls == ["BriefingDraft", "Translation"]  # English reused, French cached


def test_a_language_without_a_label_is_served_in_english(client):
    # The request schemas still accept the eight languages of contracts v0.1; only English and French are offered.
    fake = use(FakeGemini())
    body = briefing(client, "pt")
    assert body["translation_unavailable"] is True and body["lang"] == "pt"
    assert fake.calls == ["BriefingDraft"]  # no translation is attempted


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
    def numeric_month(english):
        return {k: v.replace("May 2023", "05/2023") for k, v in french(english).items()}

    use(FakeGemini(numeric_month))
    body = briefing(client, "fr")
    assert body["translation_unavailable"] is False
    assert "05/2023" in next(s for s in body["sections"] if s["id"] == "permits")["template_text"]


def test_english_never_gets_the_month_allowance(client):
    from ai.tests.test_briefing import GOOD
    invented = {**GOOD, "permits": "Since May 2023, about 5 multiplex permits were issued here."}
    app.dependency_overrides[get_generate] = lambda: lambda prompt, schema, *, model=None: schema(**invented)
    assert briefing(client, "en")["source"] == "template"


def test_french_glossary_fixes_the_reviewed_heading(client):
    use(FakeGemini(french))
    body = briefing(client, "fr")
    heading = next(s for s in body["sections"] if s["id"] == "blocking_rule")["heading"]
    assert heading == "Pourquoi les terrains ne conviennent pas"  # the French review, not the model's wording


@pytest.mark.parametrize(("text", "found"), [
    ("Les lots ne conviennent pas.", {"lot"}),
    ("Un lot étroit.", {"lot"}),
    ("Un lotissement, un pilote, un ballot.", set()),
    ("{{could_lots}} terrains et {{lots_per_permit}}", set()),
    ("Deux duplexes.", {"duplex"}),
])
def test_forbidden_words_match_whole_words_only(text, found):
    from ai.translate import forbidden_found
    assert forbidden_found({"t": text}, ["lot", "duplex"]) == found


def test_a_forbidden_word_is_rejected_and_retried(client, settings):
    replies = iter(["circonscription", "quartier"])

    def ward_word(english):
        word = next(replies)
        return {k: v.replace("Ward", word.capitalize()) for k, v in french(english).items()}

    fake = use(FakeGemini(ward_word))
    body = briefing(client, "fr")
    assert body["translation_unavailable"] is False and body["title"].startswith("FR Quartier 04")
    assert fake.calls == ["BriefingDraft", "Translation", "Translation"]
    log = [json.loads(line) for line in (settings.log_dir / "rejections.jsonl").read_text().splitlines()]
    assert log[0]["forbidden"] == ["circonscription"]


def test_the_glossary_rules_reach_the_prompt(client):
    prompts = []

    def capture(prompt, schema, *, model=None):
        prompts.append(prompt)
        return FakeGemini()(prompt, schema, model=model)

    use(capture)
    briefing(client, "fr")
    assert "quartier" in prompts[-1] and "duplex" in prompts[-1]


def test_duplex_is_forbidden_in_every_language(client):
    use(FakeGemini(lambda english: {k: v.replace("multiplexes", "duplexes") for k, v in french(english).items()}))
    assert briefing(client, "fr")["translation_unavailable"] is True


def test_french_numbers_carry_french_labels(client):
    use(FakeGemini())
    labels = {key: n["label"] for key, n in briefing(client, "fr")["numbers"].items()}
    assert labels["did_permits"] == "Permis de multiplex délivrés depuis mai 2023"
    english = {key: n["label"] for key, n in briefing(client, "en")["numbers"].items()}
    assert english["did_permits"] == "Multiplex permits issued since May 2023"


def test_numbers_labels_have_french_for_every_key():
    copy = load_json(PROMPTS_DIR / "numbers.json")
    assert set(copy["labels_fr"]) == set(copy["labels"])
    assert set(copy["top_rule_count_fr"]) == set(copy["top_rule_count"])


def test_french_has_a_label_for_everything_the_page_shows():
    labels = contract("copy/labels.json")
    assert set(labels["languages"]) == {"en", "fr"}
    for block in ("ui", "briefing_page"):
        missing = set(labels["fr"][block]) - set(labels[block])
        assert not missing, f"fr.{block} has keys English does not: {missing}"
    assert len(labels["fr"]["briefing_page"]["methodology"]) == len(labels["briefing_page"]["methodology"])
    assert all(item.get("label_fr") for item in contract("copy/not_checked.json"))


def test_every_language_has_a_review_status():
    languages = contract("copy/labels.json")["languages"]
    assert all(isinstance(info["reviewed"], bool) for info in languages.values())
    assert languages["en"]["reviewed"] and languages["fr"]["reviewed"]


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


def test_explanation_wording_reaches_only_the_explanation_prompt(client):
    prompts = []

    def capture(prompt, schema, *, model=None):
        prompts.append((schema.__name__, prompt))
        return FakeGemini()(prompt, schema, model=model)

    use(capture)
    briefing(client, "fr")
    client.post("/explain", json={**EXPLAIN, "lang": "fr"})
    translations = [p for name, p in prompts if name == "Translation"]
    assert "trop serré pour trancher" not in translations[0]  # the briefing's glossary (and cache key) is unchanged
    assert "trop serré pour trancher" in translations[1]


@pytest.mark.parametrize("phrase", ["ne rentre pas", "une maison attachée", "une propriété détachée"])
def test_awkward_explanation_wording_is_rejected(client, phrase):
    use(FakeGemini(lambda english: {k: f"{v} {phrase}" for k, v in french(english).items()}))
    body = client.post("/explain", json={**EXPLAIN, "lang": "fr"}).json()
    assert body["translation_unavailable"] is True


def test_the_briefing_glossary_is_the_reviewed_one():
    from ai.translate import glossary
    assert glossary("fr", "briefing") == glossary("fr")
    assert "attachée" in glossary("fr", "explain")["forbidden"]
