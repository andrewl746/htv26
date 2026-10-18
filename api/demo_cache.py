"""Cached demo mode (MASTERSPEC 3.3, 6.7): with SUPLEX_DEMO_CACHE=1 the API answers a GET from `api/cache/`
whenever a file exists for it, and starts even when the data directory is gone.

File names follow the web app's `public/demo-cache/` (6.7), so the A11 writer (`python -m api.cache_demo`) can
fill both folders from one list: `search.<query>.json`, `check.<address_id>.json` (`check.lot.<lot_id>.json` for
a lot lookup), `ward.<id>.json`, `trend.<id>.json`, `lots.<id>.geojson`, `permits.geojson`. A cached
`CheckResponse` is served with `meta.cached` true. Lookups by lon/lat are never cached.
"""
from __future__ import annotations

import json
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .store import SEARCH_MIN_CHARS, normalise_address

CACHE_DIR = Path(__file__).resolve().parent / "cache"
HEADER = "X-Suplex-Cache"
GEOJSON_SUFFIX = ".geojson"

_ID = re.compile(r"^\d{1,12}$")
_WARD = re.compile(r"^(0[1-9]|1[0-9]|2[0-5])$")
_SLUG_SEP = re.compile(r"[^a-z0-9]+")
_ROUTES = (
    (re.compile(r"^/ward/([^/]+)$"), "ward.{}.json"),
    (re.compile(r"^/ward/([^/]+)/trend$"), "trend.{}.json"),
    (re.compile(r"^/static/wards/([^/]+)\.geojson$"), "lots.{}.geojson"),
)


def search_slug(q: str) -> str | None:
    """The file-name form of a search query: normalised as /search does, then runs of anything but a-z and 0-9
    become one '-' ("326  Quebec Ave" -> "326-quebec-ave"). None when /search would not search."""
    norm = normalise_address(q)
    if len(norm) < SEARCH_MIN_CHARS:
        return None
    return _SLUG_SEP.sub("-", norm).strip("-") or None


def cache_name(path: str, params: Mapping[str, str]) -> str | None:
    """The cache file that answers GET `path` with these query parameters, or None when it is not cacheable."""
    if path == "/search":
        slug = search_slug(params.get("q", ""))
        return None if slug is None else f"search.{slug}.json"
    if path == "/check":
        address_id, lot_id = (params.get("address_id") or "").strip(), (params.get("lot_id") or "").strip()
        if address_id and not lot_id and _ID.match(address_id):
            return f"check.{address_id}.json"
        if lot_id and not address_id and _ID.match(lot_id):
            return f"check.lot.{lot_id}.json"
        return None
    if path == "/static/permits.geojson":
        return "permits.geojson"
    for pattern, name in _ROUTES:
        m = pattern.match(path)
        if m and _WARD.match(m.group(1)):
            return name.format(m.group(1))
    return None


def read(cache_dir: Path, path: str, params: Mapping[str, str]) -> tuple[str, Any] | None:
    """(file name, parsed body) for a cached answer, or None. A cached CheckResponse gets `meta.cached` true."""
    name = cache_name(path, params)
    if name is None:
        return None
    file = Path(cache_dir) / name
    if not file.is_file():
        return None
    doc = json.loads(file.read_text(encoding="utf-8"))
    if name.startswith("check.") and isinstance(doc.get("meta"), dict):
        doc["meta"]["cached"] = True
    return name, doc
