"""Suplex live API (MASTERSPEC 3.3). From the repo root:

    SUPLEX_DATA_DIR=data/out uvicorn api.main:app --reload --port 8000     # or --env-file .env

Environment: SUPLEX_DATA_DIR (default ./data/out), SUPLEX_GPKG (optional path overriding
<data_dir>/suplex.gpkg), SUPLEX_CORS_ORIGINS (optional, comma-separated extra origins),
SUPLEX_AI_URL (default http://localhost:8001, for briefing_url), SUPLEX_DEMO_CACHE (1 = answer from
api/cache/ whenever a cached response exists, and start without the data; api/demo_cache.py),
TIGER_DSN (read by pipeline/tiger/queries.py; unset = the trend cache).

Every error is JSON with an `error` key, 500s included, and carries the CORS headers. /check never
calls Tiger Data or Gemini.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import os
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from suplex_engine import ENGINE_VERSION

from . import demo_cache
from .demo_cache import CACHE_DIR
from .store import SEARCH_MAX_RESULTS, Store, StoreError, load, read_designs_json

log = logging.getLogger("uvicorn.error")

DEFAULT_DATA_DIR = "./data/out"
DEFAULT_AI_URL = "http://localhost:8001"
TIGER_BUDGET_S = 2.0       # MASTERSPEC 3.3: on any Tiger Data error or after 2 s, serve the trend cache
GZIP_MIN_BYTES = 1000      # transport only: responses smaller than this are sent uncompressed
LOCAL_ORIGINS = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"   # any localhost port (MASTERSPEC 3.3 CORS)
GEOJSON = "application/geo+json"
BATCH_HINT = "run the batch (python -m suplex_engine.batch --all)"
CACHE_ONLY_HINT = "the API runs on the demo cache only and has no cached response for this request"
TRUE_VALUES = ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    gpkg_path: Path | None
    ai_url: str
    cors_origins: tuple[str, ...]
    demo_cache: bool = False
    cache_dir: Path = CACHE_DIR

    @classmethod
    def from_env(cls) -> Settings:
        gpkg = os.environ.get("SUPLEX_GPKG", "").strip()
        origins = os.environ.get("SUPLEX_CORS_ORIGINS", "")
        return cls(
            data_dir=Path(os.environ.get("SUPLEX_DATA_DIR", "").strip() or DEFAULT_DATA_DIR),
            gpkg_path=Path(gpkg) if gpkg else None,
            ai_url=(os.environ.get("SUPLEX_AI_URL", "").strip() or DEFAULT_AI_URL).rstrip("/"),
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
            demo_cache=os.environ.get("SUPLEX_DEMO_CACHE", "").strip().lower() in TRUE_VALUES,
        )


# ---------- errors ----------

class ApiError(Exception):
    """Raised by a route; becomes {"error": ..., "detail"?: ...} with the status code."""

    def __init__(self, status_code: int, error: str, detail: str | None = None) -> None:
        super().__init__(error)
        self.status_code, self.error, self.detail = status_code, error, detail


def error_response(status_code: int, error: str, detail: str | None = None,
                   headers: dict[str, str] | None = None) -> JSONResponse:
    body: dict[str, Any] = {"error": error}
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(body, status_code=status_code, headers=headers)


_HTTP_ERRORS = {404: "not_found", 405: "method_not_allowed"}


async def _on_api_error(request: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status_code, exc.error, exc.detail)


async def _on_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code in _HTTP_ERRORS:
        return error_response(exc.status_code, _HTTP_ERRORS[exc.status_code], headers=exc.headers)
    return error_response(exc.status_code, "http_error", str(exc.detail), headers=exc.headers)


async def _on_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    parts = []
    for e in exc.errors():
        where = ".".join(str(p) for p in e.get("loc", ()) if p not in ("query", "path"))
        parts.append(f"{where}: {e.get('msg', 'invalid')}" if where else str(e.get("msg", "invalid")))
    return error_response(400, "bad_request", "; ".join(parts) or "invalid request")


async def _on_unexpected(request: Request, exc: Exception) -> JSONResponse:
    log.exception("suplex: unhandled error on %s", request.url.path)
    return error_response(500, "internal_error")


# ---------- middleware (added innermost first; CORS and gzip wrap both) ----------

class CatchUnexpected(BaseHTTPMiddleware):
    """Turns an unhandled error into the JSON 500 inside the CORS middleware, so the browser can read it.
    (Starlette's own 500 handler runs outside every middleware and its responses carry no CORS headers.)"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception as e:  # noqa: BLE001  everything the route handlers did not turn into an ApiError
            return await _on_unexpected(request, e)


class DemoCache(BaseHTTPMiddleware):
    """SUPLEX_DEMO_CACHE=1: a GET with a file in the cache directory is answered from it (api/demo_cache.py)."""

    def __init__(self, app: Any, cache_dir: Path) -> None:
        super().__init__(app)
        self.cache_dir = cache_dir

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method == "GET":
            hit = demo_cache.read(self.cache_dir, request.url.path, request.query_params)
            if hit is not None:
                name, doc = hit
                media_type = GEOJSON if name.endswith(demo_cache.GEOJSON_SUFFIX) else None
                return JSONResponse(doc, media_type=media_type, headers={demo_cache.HEADER: name})
        return await call_next(request)


# ---------- pure response builders ----------

def ward_response(entry: dict[str, Any], ward_id: str, ai_url: str) -> dict[str, Any]:
    """WardResponse: the ward's ward_summary.json entry plus the four urls."""
    return {
        **entry,
        "lots_url": f"/static/wards/{ward_id}.geojson",
        "permits_url": "/static/permits.geojson",
        "trend_url": f"/ward/{ward_id}/trend",
        "briefing_url": f"{ai_url.rstrip('/')}/b/{ward_id}",
    }


def read_trend_cache(cache_dir: Path, ward_id: str) -> dict[str, Any] | None:
    try:
        return json.loads((Path(cache_dir) / f"{ward_id}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def tiger_ward_trend(ward_id: str, since: str) -> list[dict[str, Any]]:
    """Monthly series from Tiger Data. Imported here so a missing psycopg is just another fallback."""
    import queries  # pipeline/tiger/queries.py, on sys.path through api/__init__.py

    return queries.ward_trend(ward_id, since)


def warm_tiger_import() -> bool:
    """Import the Tiger Data module (and psycopg) once at startup: a cold first load of the psycopg DLL can
    take longer than the whole 2 s trend budget. False when psycopg is missing (the trend serves the cache)."""
    try:
        import queries  # noqa: F401
    except ImportError as e:
        log.warning("suplex: Tiger Data module unavailable (%s); /ward/{id}/trend serves the cache", e)
        return False
    return True


async def trend_response(ward_id: str, cache_dir: Path, since: str,
                         fetch: Callable[[str, str], list[dict[str, Any]]] = tiger_ward_trend,
                         budget_s: float = TIGER_BUDGET_S) -> dict[str, Any] | None:
    """TrendResponse: Tiger Data when it answers within the budget, else the ward's cache file as is
    (its source is already "cache"); None when neither is available."""
    cached = read_trend_cache(cache_dir, ward_id)
    loop = asyncio.get_running_loop()
    try:
        series = await asyncio.wait_for(loop.run_in_executor(None, fetch, ward_id, since), timeout=budget_s)
    except Exception as e:  # noqa: BLE001  TigerUnavailable, the timeout, ImportError, anything: serve the cache
        log.info("suplex: trend %s from the cache (Tiger Data: %s %s)", ward_id, type(e).__name__, e)
        return cached
    return {
        "ward_id": ward_id,
        "source": "tigerdata",
        "since": since[:7],
        "series": series,
        "markers": cached["markers"] if cached and "markers" in cached else [],
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ---------- routes ----------

router = APIRouter()


def _store(request: Request) -> Store:
    store = request.app.state.store
    if store is None:                 # started on the demo cache alone, and the cache had no answer
        raise ApiError(503, "data_unavailable", CACHE_ONLY_HINT)
    return store


def _ward_or_404(store: Store, ward_id: str, error: str = "ward_not_found") -> None:
    if ward_id not in store.ward_ids:
        raise ApiError(404, error)


@router.get("/health")
def health(request: Request) -> JSONResponse:
    demo = request.app.state.settings.demo_cache
    if request.app.state.store is None:
        return JSONResponse({"status": "ok", "mode": "demo_cache_only", "demo_cache": demo,
                             "engine_version": ENGINE_VERSION})
    store = _store(request)
    return JSONResponse({
        "status": "ok",
        "mode": "data",
        "demo_cache": demo,
        "data_dates": store.data_dates,
        "lot_count": store.lot_count,
        "ward_count": len(store.ward_ids),
        "engine_version": ENGINE_VERSION,
        "designs_version": store.designs.version,
        "config_version": store.cfg.version,
        "layers": store.layer_counts,
        "load_seconds": round(store.load_seconds, 1),
        "ward_summary_loaded": store.ward_summary is not None,
        "tiger_dsn_set": bool(os.environ.get("TIGER_DSN")),
    })


@router.get("/designs")
def designs(request: Request) -> JSONResponse:
    store = request.app.state.store
    return JSONResponse(read_designs_json() if store is None else store.designs_json)


@router.get("/search")
def search(request: Request, q: str = "", limit: int = Query(SEARCH_MAX_RESULTS, ge=1)) -> JSONResponse:
    return JSONResponse({"query": q, "results": _store(request).search(q, limit)})


@router.get("/check")
def check(request: Request, address_id: str | None = None, lot_id: str | None = None,
          lon: float | None = None, lat: float | None = None) -> JSONResponse:
    address_id = (address_id or "").strip() or None
    lot_id = (lot_id or "").strip() or None
    by_point = lon is not None or lat is not None
    if (address_id is not None) + (lot_id is not None) + by_point != 1:
        raise ApiError(400, "bad_request", "give exactly one of address_id, lot_id, or lon and lat")
    if by_point and (lon is None or lat is None):
        raise ApiError(400, "bad_request", "lon and lat go together")
    if by_point and not (math.isfinite(lon) and math.isfinite(lat)):
        raise ApiError(400, "bad_request", "lon and lat must be finite numbers")

    store = _store(request)
    address_pos: int | None = None
    if address_id is not None:
        address_pos = store.address_pos(address_id)
        lot_pos = None if address_pos is None else store.lot_of_address(address_pos)
    elif lot_id is not None:
        lot_pos = store.lot_pos(lot_id)
    else:
        x, y = store.to_2952(lon, lat)
        lot_pos = store.lot_at(x, y)
        if lot_pos is None and not store.in_toronto(x, y):
            raise ApiError(404, "outside_toronto")
    if lot_pos is None:
        raise ApiError(404, "address_not_found")
    return JSONResponse(store.check(lot_pos, address_pos))


@router.get("/ward/{ward_id}")
def ward(request: Request, ward_id: str) -> JSONResponse:
    store = _store(request)
    _ward_or_404(store, ward_id)
    entry = ((store.ward_summary or {}).get("wards") or {}).get(ward_id)
    if entry is None:
        raise ApiError(503, "ward_summary_unavailable", BATCH_HINT)
    return JSONResponse(ward_response(entry, ward_id, request.app.state.settings.ai_url))


@router.get("/ward/{ward_id}/trend")
async def ward_trend(request: Request, ward_id: str) -> JSONResponse:
    store = _store(request)
    _ward_or_404(store, ward_id)
    body = await trend_response(ward_id, store.data_dir / "trend_cache", store.cfg.permits_trend_since)
    if body is None:
        raise ApiError(503, "trend_unavailable")
    return JSONResponse(body)


@router.get("/static/permits.geojson")
def static_permits(request: Request) -> FileResponse:
    path = _store(request).data_dir / "permits.geojson"
    if not path.is_file():
        raise ApiError(404, "not_found")
    return FileResponse(path, media_type=GEOJSON)


@router.get("/static/wards/{ward_id}.geojson")
def static_ward_lots(request: Request, ward_id: str) -> FileResponse:
    store = _store(request)
    _ward_or_404(store, ward_id, error="not_found")
    path = store.data_dir / "wards" / f"{ward_id}.geojson"
    if not path.is_file():
        raise ApiError(404, "not_found")      # the batch has not written it yet
    return FileResponse(path, media_type=GEOJSON)


# ---------- the app ----------

def load_store(settings: Settings) -> Store:
    try:
        store = load(settings.data_dir, settings.gpkg_path)
    except StoreError as e:
        log.error("suplex: cannot start: %s", e)
        raise
    layers = ", ".join(f"{k} {v:,}" for k, v in store.layer_counts.items())
    log.info("suplex: loaded %s in %.1f s (%s; %d multiplex permit points; ward_summary.json %s)",
             store.gpkg_path, store.load_seconds, layers, len(store.permit_geoms),
             "loaded" if store.ward_summary is not None else "missing")
    return store


def create_app(store: Store | Any | None = None, settings: Settings | None = None) -> FastAPI:
    """The app. With `store` given (tests) the lifespan does not load the data again."""
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if app.state.store is None:
            try:
                app.state.store = load_store(settings)
            except StoreError:
                if not settings.demo_cache:
                    raise
                log.warning("suplex: no data; serving the demo cache only from %s", settings.cache_dir)
        if settings.demo_cache:
            log.info("suplex: demo cache on (%s)", settings.cache_dir)
        warm_tiger_import()
        yield

    app = FastAPI(title="Suplex API", version=ENGINE_VERSION, lifespan=lifespan)
    app.state.settings = settings
    app.state.store = store
    app.add_exception_handler(ApiError, _on_api_error)
    app.add_exception_handler(StarletteHTTPException, _on_http_error)
    app.add_exception_handler(RequestValidationError, _on_validation_error)
    app.add_exception_handler(Exception, _on_unexpected)
    if settings.demo_cache:
        app.add_middleware(DemoCache, cache_dir=settings.cache_dir)
    app.add_middleware(CatchUnexpected)
    app.add_middleware(GZipMiddleware, minimum_size=GZIP_MIN_BYTES)
    app.add_middleware(CORSMiddleware, allow_origin_regex=LOCAL_ORIGINS, allow_origins=list(settings.cors_origins),
                       allow_methods=["GET"], allow_headers=["*"])
    app.include_router(router)
    return app


app = create_app()
