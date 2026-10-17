"""S3/S4: POST /explain against /contracts/fixtures, with Gemini replaced by a fake (no quota spent).

Covers the S3 acceptance check (a valid ExplainResponse with placeholders resolved; the same call
twice hits the cache) and the S4 one (an invented number in a draft ends in the template).
"""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from ai.config import contract, load_settings
from ai.gemini import GeminiError
from ai.main import app, get_generate, get_settings
from ai.models import ExplainDraft
from ai.numbers import allowed_numbers, build_check_numbers, pick_design, render
from ai.templates import explain_template
from ai.validator import validate

REQUEST = contract("fixtures/explain.request.json")
RESPONSE_SCHEMA = Draft202012Validator(contract("schemas/explain.response.schema.json"))
GOOD = contract("fixtures/explain.response.json")["template_text"]
INVENTED = "The Fourplex Narrow is too close to call: it needs 7.65 m and about 1,300 lots nearby are similar."


class FakeGemini:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts: list[str] = []

    def __call__(self, prompt, schema, *, model=None):
        self.prompts.append(prompt)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(reply, Exception):
            raise reply
        return ExplainDraft(template_text=reply)


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


def test_fixture_request_returns_a_valid_explain_response(client):
    use(FakeGemini(GOOD))
    response = client.post("/explain", json=REQUEST)
    assert response.status_code == 200
    body = response.json()
    assert not list(RESPONSE_SCHEMA.iter_errors(body))
    assert body["source"] == "gemini" and body["validated"] is True and body["cached"] is False
    assert "{{" not in body["text"]
    assert body["text"] == contract("fixtures/explain.response.json")["text"]
    assert body["numbers"] == contract("fixtures/explain.response.json")["numbers"]
    assert body["disclaimer"] == "Screening only, not a permit or legal advice."


def test_same_call_twice_hits_the_cache(client):
    fake = use(FakeGemini(GOOD))
    first = client.post("/explain", json=REQUEST).json()
    second = client.post("/explain", json=REQUEST).json()
    assert len(fake.prompts) == 1
    assert second["cached"] is True
    assert {**first, "cached": True} == second


def test_context_does_not_change_the_cache_key(client):
    fake = use(FakeGemini(GOOD))
    client.post("/explain", json=REQUEST)
    moved = json.loads(json.dumps(REQUEST))
    moved["check"]["context"]["trees"] = []
    assert client.post("/explain", json=moved).json()["cached"] is True
    assert len(fake.prompts) == 1


def test_invented_number_twice_falls_back_to_the_template(client, settings):
    fake = use(FakeGemini(INVENTED))
    body = client.post("/explain", json=REQUEST).json()
    assert len(fake.prompts) == 2
    assert "1300" in fake.prompts[1] and "Use only {{placeholders}}" in fake.prompts[1]
    assert body["source"] == "template" and body["model"] is None and body["validated"] is True
    assert not list(RESPONSE_SCHEMA.iter_errors(body))
    log = (settings.log_dir / "rejections.jsonl").read_text().splitlines()
    assert len(log) == 2 and json.loads(log[0])["invented"] == ["1300", "7.65"]


def test_one_rejection_then_a_clean_draft_is_accepted(client):
    use(FakeGemini(INVENTED, GOOD))
    body = client.post("/explain", json=REQUEST).json()
    assert body["source"] == "gemini" and body["template_text"] == GOOD


def test_gemini_error_falls_back_and_is_not_cached(client):
    fake = use(FakeGemini(GeminiError("quota")))
    first = client.post("/explain", json=REQUEST).json()
    assert first["source"] == "template"
    client.post("/explain", json=REQUEST)
    assert len(fake.prompts) == 2  # tried again: a quota error is not a verdict on the inputs


def test_model_never_sees_the_values(client):
    fake = use(FakeGemini(GOOD))
    client.post("/explain", json=REQUEST)
    model_input = fake.prompts[0].split("Input:\n", 1)[1]
    assert "7.62" not in model_input and "lot_width_actual" in model_input


def test_failed_translation_serves_english_with_the_notice(client):
    use(FakeGemini(GOOD, GeminiError("quota")))
    body = client.post("/explain", json={**REQUEST, "lang": "fr"}).json()
    assert body["lang"] == "fr" and body["translation_unavailable"] is True
    assert not list(RESPONSE_SCHEMA.iter_errors(body))


def test_a_check_that_breaks_the_contract_is_a_400(client):
    use(FakeGemini(GOOD))
    broken = json.loads(json.dumps(REQUEST))
    del broken["check"]["lot"]["ward_id"]
    response = client.post("/explain", json=broken)
    assert response.status_code == 400 and response.json()["error"] == "bad_request"


FIXTURE_CHECKS = ["check.fits.json", "check.borderline.json", "check.no_fit.json", "check.not_checked.json"]


@pytest.mark.parametrize("fixture", FIXTURE_CHECKS)
@pytest.mark.parametrize("design_id", ["fourplex_narrow", "fourplex_wide", "sixplex_narrow", "sixplex_wide"])
def test_every_template_passes_the_validator(fixture, design_id):
    check = contract(f"fixtures/{fixture}")
    _, numbers = build_check_numbers(check, design_id, web_url="w", ai_url="a")
    text = explain_template(check, pick_design(check, design_id), numbers)
    assert validate(text, numbers, allowed_numbers(numbers)).ok, text
    assert "{" not in render(text, numbers, "en"), text  # no placeholder mangled into single braces
    assert "Screening" in text or "screening" in text
    assert "will be built" not in text
