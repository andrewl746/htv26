"""The Suplex AI service (MASTERSPEC 7.1), port 8001: `uvicorn ai.main:app --reload --port 8001`.

/explain and /briefing now; the briefing page at /b/{ward_id} (S6) comes next.
"""
from __future__ import annotations

from functools import cache
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from jsonschema import Draft202012Validator

from ai.briefing import briefing
from ai.cache import JsonCache
from ai.config import CONTRACTS_DIR, Settings, contract, load_settings
from ai.explain import explain
from ai.gemini import generate_json
from ai.generate import Generate
from ai.models import BriefingRequest, BriefingResponse, ExplainRequest, ExplainResponse

app = FastAPI(title="Suplex AI service")
app.mount("/static", StaticFiles(directory=CONTRACTS_DIR), name="static")


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
