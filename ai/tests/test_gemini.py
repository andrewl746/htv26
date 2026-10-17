"""S3: generate_json retries once on a 429 or an unparseable reply, then raises GeminiError (MASTERSPEC 7.9)."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from google.genai import errors

from ai import gemini
from ai.models import ExplainDraft


class FakeInteractions:
    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(output_text=outcome)


def client(*outcomes):
    return SimpleNamespace(interactions=FakeInteractions(*outcomes))


@pytest.fixture(autouse=True)
def no_wait(monkeypatch):
    monkeypatch.setattr(gemini.time, "sleep", lambda s: None)


def rate_limited():
    return errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})


def test_structured_output_is_requested_and_parsed():
    c = client('{"template_text": "Hi {{x}}"}')
    draft = gemini.generate_json("prompt", ExplainDraft, model="m", client=c)
    assert draft.template_text == "Hi {{x}}"
    call = c.interactions.calls[0]
    assert call["model"] == "m" and call["response_format"]["mime_type"] == "application/json"
    assert call["response_format"]["schema"] == ExplainDraft.model_json_schema()


def test_one_retry_after_a_429():
    c = client(rate_limited(), '{"template_text": "ok"}')
    assert gemini.generate_json("p", ExplainDraft, model="m", client=c).template_text == "ok"
    assert len(c.interactions.calls) == 2


def test_two_429s_raise():
    c = client(rate_limited(), rate_limited())
    with pytest.raises(gemini.GeminiError):
        gemini.generate_json("p", ExplainDraft, model="m", client=c)


def test_one_retry_after_a_reply_that_does_not_parse():
    c = client("not json", '{"template_text": "ok"}')
    assert gemini.generate_json("p", ExplainDraft, model="m", client=c).template_text == "ok"


def test_other_api_errors_are_not_retried():
    c = client(errors.ServerError(500, {"error": {"code": 500, "message": "x", "status": "INTERNAL"}}))
    with pytest.raises(gemini.GeminiError):
        gemini.generate_json("p", ExplainDraft, model="m", client=c)
    assert len(c.interactions.calls) == 1


def test_missing_key_raises_without_calling(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setattr(gemini, "load_settings", lambda: SimpleNamespace(gemini_api_key=None, gemini_model="m"))
    with pytest.raises(gemini.GeminiError):
        gemini.generate_json("p", ExplainDraft)
