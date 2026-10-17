"""S7: pregenerate.py fills the cache, paces calls, resumes after a failure, and the cache then serves
every language with Gemini unreachable."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from ai import pregenerate
from ai.config import contract, load_settings
from ai.gemini import GeminiError
from ai.main import app, get_generate, get_settings

BRIEFING_EN = {s["id"]: s["template_text"] for s in contract("fixtures/briefing.04.en.json")["sections"]
               if s["id"] != "questions"}
EXPLAIN_EN = {"template_text": contract("fixtures/explain.response.json")["template_text"]}


class FakeGemini:
    def __init__(self, fail_after: int | None = None):
        self.calls = 0
        self.fail_after = fail_after

    def __call__(self, prompt, schema, *, model=None):
        self.calls += 1
        if self.fail_after is not None and self.calls > self.fail_after:
            raise GeminiError("quota")
        if schema.__name__ == "BriefingDraft":
            return schema(**BRIEFING_EN)
        if schema.__name__ == "ExplainDraft":
            return schema(**EXPLAIN_EN)
        english = json.loads(prompt.split("JSON:\n", 1)[1])
        return schema(**{k: f"T {v}" for k, v in english.items()})


@pytest.fixture
def settings(tmp_path, monkeypatch):
    s = replace(load_settings(), cache_dir=tmp_path / "cache", log_dir=tmp_path / "logs",
                suplex_web_url="http://localhost:5173", suplex_ai_url="http://localhost:8001")
    monkeypatch.setattr(pregenerate, "load_settings", lambda: s)
    return s


def run(fake, *args):
    return pregenerate.main(["--ward", "04", "--fixture", *args], generate=fake, sleep=lambda s: None)


def test_fills_every_language_then_serves_them_with_gemini_unreachable(settings):
    fake = FakeGemini()
    assert run(fake, "--langs", "all", "--address-id", "fixture-1") == 0
    assert fake.calls == 1 + 7 + 4  # English briefing, seven translations, four explanations

    def unreachable(prompt, schema, *, model=None):
        raise AssertionError("Gemini must not be called once the cache is full")

    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_generate] = lambda: unreachable
    try:
        client = TestClient(app)
        request = contract("fixtures/briefing.request.json")
        for lang in settings.langs:
            body = client.post("/briefing", json={**request, "lang": lang}).json()
            assert body["cached"] is True and body["translation_unavailable"] is False, lang
    finally:
        app.dependency_overrides.clear()


def test_second_run_makes_no_requests(settings):
    run(FakeGemini(), "--langs", "en,fr")
    again = FakeGemini()
    assert run(again, "--langs", "en,fr") == 0 and again.calls == 0


def test_stops_on_a_gemini_failure_and_resumes(settings, capsys):
    assert run(FakeGemini(fail_after=3), "--langs", "all") == 2
    assert "Stopped" in capsys.readouterr().out
    resumed = FakeGemini()
    assert run(resumed, "--langs", "all") == 0
    assert resumed.calls == 8 - 3  # only what the first run had not cached


def test_refresh_regenerates_english_once(settings):
    run(FakeGemini(), "--langs", "en,fr")
    fresh = FakeGemini()
    run(fresh, "--langs", "en,fr", "--refresh")
    assert fresh.calls == 1  # English regenerated; French is keyed by the (identical) English text, so cached


def test_pacing_waits_between_calls():
    waits: list[float] = []
    now = [0.0]
    paced = pregenerate.Paced(15, generate=lambda *a, **k: None, sleep=waits.append, clock=lambda: now[0])
    paced("p", None)
    paced("p", None)
    assert waits == [pytest.approx(60 / 15 + pregenerate.PACING_MARGIN_S)]


def test_unknown_language_is_refused(settings):
    with pytest.raises(SystemExit):
        run(FakeGemini(), "--langs", "en,xx")
