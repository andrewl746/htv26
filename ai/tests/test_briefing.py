"""S5: POST /briefing against /contracts/fixtures, with Gemini replaced by a fake (no quota spent).

Acceptance (MASTERSPEC 8.4 S5): a valid BriefingResponse from the fixture with five sections, the
three fixed questions, validated: true and a numbers map whose every key has a source_url.
"""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from ai.briefing import SECTION_IDS, briefing_template
from ai.config import contract, load_settings
from ai.gemini import GeminiError
from ai.main import app, get_generate, get_settings
from ai.models import BriefingDraft
from ai.numbers import allowed_numbers, build_ward_numbers, render
from ai.validator import validate

REQUEST = contract("fixtures/briefing.request.json")
EXPECTED = contract("fixtures/briefing.04.en.json")
SCHEMA = Draft202012Validator(contract("schemas/briefing.response.schema.json"))
QUESTIONS = contract("copy/questions.json")["en"]
GOOD = {s["id"]: s["template_text"] for s in EXPECTED["sections"] if s["id"] != "questions"}
INVENTED = {**GOOD, "permits": "Since May 2023, about 50 multiplex permits have been issued in this ward."}


class FakeGemini:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts: list[str] = []

    def __call__(self, prompt, schema, *, model=None):
        self.prompts.append(prompt)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
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


def post(client, body=REQUEST):
    response = client.post("/briefing", json=body)
    assert response.status_code == 200, response.text
    return response.json()


# --- the S5 acceptance check -------------------------------------------------------------------


def test_fixture_request_returns_a_valid_briefing(client):
    use(FakeGemini(GOOD))
    body = post(client)
    assert not list(SCHEMA.iter_errors(body))
    assert [s["id"] for s in body["sections"]] == list(SECTION_IDS)
    assert body["questions"] == QUESTIONS
    assert body["validated"] is True and body["source"] == "gemini"
    assert body["numbers"] and all(entry["source_url"] for entry in body["numbers"].values())


def test_matches_the_english_briefing_fixture(client):
    use(FakeGemini(GOOD))
    body = post(client)
    for got, want in zip(body["sections"], EXPECTED["sections"], strict=True):
        assert (got["id"], got["heading"], got["template_text"], got["text"]) == (
            want["id"], want["heading"], want["template_text"], want["text"])
    assert body["numbers"] == EXPECTED["numbers"]
    for key in ("ward_id", "ward_name", "title", "links", "disclaimer", "data_dates"):
        assert body[key] == EXPECTED[key], key


def test_questions_are_fixed_copy_never_generated(client):
    use(FakeGemini(GOOD))
    body = post(client)
    questions = next(s for s in body["sections"] if s["id"] == "questions")
    assert questions["template_text"].split("\n") == QUESTIONS
    assert "questions" not in BriefingDraft.model_fields  # the model is never asked to write them


# --- validation policy, caching, fallback ------------------------------------------------------


def test_invented_number_twice_falls_back_to_the_template(client, settings):
    fake = use(FakeGemini(INVENTED))
    body = post(client)
    assert len(fake.prompts) == 2 and "50" in fake.prompts[1]
    assert body["source"] == "template" and body["model"] is None
    assert not list(SCHEMA.iter_errors(body))
    log = [json.loads(line) for line in (settings.log_dir / "rejections.jsonl").read_text().splitlines()]
    assert [entry["endpoint"] for entry in log] == ["briefing", "briefing"]


def test_same_call_twice_hits_the_cache(client):
    fake = use(FakeGemini(GOOD))
    first = post(client)
    second = post(client)
    assert len(fake.prompts) == 1 and second["cached"] is True
    assert {**first, "cached": True} == second


def test_trend_and_urls_do_not_change_the_cache_key(client):
    fake = use(FakeGemini(GOOD))
    post(client)
    bare = json.loads(json.dumps(REQUEST))
    bare["trend"] = None
    for key in ("lots_url", "permits_url", "trend_url", "briefing_url"):
        del bare["ward"][key]
    assert post(client, bare)["cached"] is True
    assert len(fake.prompts) == 1


def test_gemini_error_serves_the_template_without_caching(client):
    fake = use(FakeGemini(GeminiError("quota")))
    assert post(client)["source"] == "template"
    post(client)
    assert len(fake.prompts) == 2


def test_model_never_sees_the_values(client):
    fake = use(FakeGemini(GOOD))
    post(client)
    model_input = fake.prompts[0].split("Input:\n", 1)[1]
    assert "3900" not in model_input and "could_lots" in model_input


def test_failed_translation_serves_english_with_the_notice(client):
    use(FakeGemini(GOOD, GeminiError("quota")))
    body = post(client, {**REQUEST, "lang": "fr"})
    assert body["lang"] == "fr" and body["translation_unavailable"] is True
    assert not list(SCHEMA.iter_errors(body))


def test_a_ward_that_breaks_the_contract_is_a_400(client):
    use(FakeGemini(GOOD))
    broken = json.loads(json.dumps(REQUEST))
    del broken["ward"]["headline"]
    response = client.post("/briefing", json=broken)
    assert response.status_code == 400 and response.json()["error"] == "bad_request"


# --- the template and the numbers map ----------------------------------------------------------


def test_ward_numbers_cover_section_7_3():
    numbers = build_ward_numbers(REQUEST["ward"], web_url="http://localhost:5173")
    expected = {
        "could_lots", "could_pct", "did_permits", "lots_per_permit", "borderline_lots", "nofit_lots",
        "not_checked_lots", "house_lots", "attached_pct", "top_rule_count", "flagged_fitting_lots",
        "permits_2023", "permits_2024", "permits_2025", "permits_2026", "units_since_may_2023",
        "by_design_fourplex_narrow_fits", "by_design_fourplex_wide_fits", "by_design_sixplex_narrow_fits",
        "by_design_sixplex_wide_fits",
    }
    assert set(numbers) == expected
    assert all(entry["source_url"] for entry in numbers.values())


def test_no_permits_drops_lots_per_permit_and_its_sentence():
    ward = json.loads(json.dumps(REQUEST["ward"]))
    ward["headline"].update(did=0, lots_per_permit=None)
    numbers = build_ward_numbers(ward, web_url="w")
    assert "lots_per_permit" not in numbers
    sections = briefing_template(ward, numbers)
    assert "lots_per_permit" not in sections["permits"]
    assert validate(sections["permits"], numbers, allowed_numbers(numbers)).ok


@pytest.mark.parametrize("top_rule", ["detached_building", "lot_width", "lot_depth", "building_length", "height",
                                      "lot_coverage", "units_allowed"])
def test_every_template_section_passes_the_validator(top_rule):
    ward = json.loads(json.dumps(REQUEST["ward"]))
    ward["top_blocking_rules"][0]["rule_id"] = top_rule
    numbers = build_ward_numbers(ward, web_url="w")
    for section_id, text in briefing_template(ward, numbers).items():
        assert validate(text, numbers, allowed_numbers(numbers)).ok, (section_id, text)
        assert "{" not in render(text, numbers, "en") and "}" not in text.replace("}}", ""), (section_id, text)
        for word in ("will be built", "threat", "opportunity", "best", "worst"):
            assert word not in text.lower(), (section_id, word)
