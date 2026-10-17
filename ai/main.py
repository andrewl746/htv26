"""The Suplex AI service (MASTERSPEC 7.1), port 8001: `uvicorn ai.main:app --reload --port 8001`.

POST /explain, POST /briefing, the shareable briefing page at GET /b/{ward_id}?lang=xx, GET /health.
"""
from __future__ import annotations

import json
import re
from functools import cache
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jsonschema import Draft202012Validator

from ai.briefing import briefing
from ai.cache import JsonCache
from ai.config import AI_DIR, CONTRACTS_DIR, Settings, contract, load_settings
from ai.explain import explain
from ai.gemini import generate_json
from ai.generate import Generate
from ai.models import BriefingRequest, BriefingResponse, ExplainRequest, ExplainResponse

app = FastAPI(title="Suplex AI service")
app.mount("/static", StaticFiles(directory=CONTRACTS_DIR), name="static")
app.mount("/page", StaticFiles(directory=AI_DIR / "page"), name="page")

WARD_ID = re.compile(r"0[1-9]|1[0-9]|2[0-5]")


@cache
def _request_validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(contract(f"schemas/{name}.request.schema.json"))


def _contract_error(name: str, payload: dict) -> JSONResponse | None:
    """A 400 in the API's error shape when the body breaks the request contract, else None."""
    errors = sorted(_request_validator(name).iter_errors(payload), key=lambda e: list(e.absolute_path))
    if not errors:
        return None
    first = errors[0]
    path = "$." + ".".join(str(p) for p in first.absolute_path)
    return JSONResponse({"error": "bad_request", "detail": f"{path}: {first.message}"}, status_code=400)


def get_settings() -> Settings:
    return load_settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_cache(settings: SettingsDep) -> JsonCache:
    return JsonCache(settings.cache_dir)


def get_generate():
    return generate_json


@app.get("/health")
def health(settings: SettingsDep) -> dict:
    return {
        "ok": True,
        "model": settings.gemini_model,
        "gemini_key_set": settings.gemini_api_key is not None,
        "langs": list(settings.langs),
    }


@app.post("/explain", response_model=ExplainResponse)
def post_explain(
    body: ExplainRequest,
    settings: SettingsDep,
    cache: Annotated[JsonCache, Depends(get_cache)],
    generate: Annotated[Generate, Depends(get_generate)],
) -> dict:
    payload = body.model_dump()
    return _contract_error("explain", payload) or explain(payload, settings, cache, generate)


@app.post("/briefing", response_model=BriefingResponse)
def post_briefing(
    body: BriefingRequest,
    settings: SettingsDep,
    cache: Annotated[JsonCache, Depends(get_cache)],
    generate: Annotated[Generate, Depends(get_generate)],
) -> dict:
    payload = body.model_dump()
    return _contract_error("briefing", payload) or briefing(payload, settings, cache, generate)


@app.get("/b/{ward_id}", response_class=HTMLResponse)
def briefing_page(ward_id: str, settings: SettingsDep, lang: str = "en") -> HTMLResponse:
    """The shareable briefing page (MASTERSPEC 7.7): index.html with window.SUPLEX injected."""
    if not WARD_ID.fullmatch(ward_id):
        return JSONResponse({"error": "ward_not_found"}, status_code=404)
    if lang not in settings.langs:
        lang = "en"
    boot = {
        "apiUrl": settings.suplex_api_url,
        "webUrl": settings.suplex_web_url,
        "wardId": ward_id,
        "lang": lang,
        "langs": list(settings.langs),
    }
    script = "<script>window.SUPLEX = " + json.dumps(boot).replace("</", "<\\/") + ";</script>"
    html = (AI_DIR / "page" / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html.replace("<!--SUPLEX-->", script))
