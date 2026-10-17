"""The Suplex AI service (MASTERSPEC 7.1), port 8001: `uvicorn ai.main:app --reload --port 8001`.

/explain now; /briefing (S5) and the briefing page at /b/{ward_id} (S6) come next.
"""
from __future__ import annotations

from functools import cache
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from jsonschema import Draft202012Validator

from ai.cache import JsonCache
from ai.config import CONTRACTS_DIR, Settings, contract, load_settings
from ai.explain import Generate, explain
from ai.gemini import generate_json
from ai.models import ExplainRequest, ExplainResponse

app = FastAPI(title="Suplex AI service")
app.mount("/static", StaticFiles(directory=CONTRACTS_DIR), name="static")


@cache
def _request_validator() -> Draft202012Validator:
    return Draft202012Validator(contract("schemas/explain.request.schema.json"))


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
    errors = sorted(_request_validator().iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        first = errors[0]
        path = "$." + ".".join(str(p) for p in first.absolute_path)
        return JSONResponse({"error": "bad_request", "detail": f"{path}: {first.message}"}, status_code=400)
    return explain(payload, settings, cache, generate)
