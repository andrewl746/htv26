"""The demo cache writer (A11; MASTERSPEC 3.3, 6.7, 8.1). From the repo root, after the Hour-24 batch:

    python -m api.cache_demo                  # SUPLEX_DATA_DIR and SUPLEX_GPKG name the data, as for the API
    python -m api.cache_demo --gpkg data/out/suplex_citywide.gpkg --web-out D:/demo-cache

Calls the API in process (FastAPI's TestClient on the data, never on the demo cache) for every request the Ward 04
demo makes: the searches the presenter types, the three address checks, the ward, its trend, its lots and the
permits. Every answer must be a 200 that parses, and the JSON ones must match their contract schema, before anything
is written; then each file goes into api/cache/ (served with SUPLEX_DEMO_CACHE=1) and into --web-out (default
<data dir>/demo-cache/), the copy Jayden puts in web/public/demo-cache/. File names come from api/demo_cache.py,
so the API finds exactly what this writes. A CheckResponse is saved with `meta.cached` true: the web serves its
copy as is.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import warnings
from collections.abc import Mapping, Sequence
from dataclasses import replace
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match
from suplex_engine.config import contracts_dir

from .demo_cache import CACHE_DIR, GEOJSON_SUFFIX, HEADER, cache_name, search_slug
from .main import Settings, create_app
from .store import SEARCH_MIN_CHARS, StoreError, normalise_address

# The demo (MASTERSPEC 0.5, decision 18): Ward 04 and the three addresses the presenter types, by address_id.
WARD_ID = "04"
ADDRESSES = {
    "7986858": "326 Quebec Ave",     # all four designs fit: the opener
    "7955411": "281 Armadale Ave",   # the Fourplex Narrow is too close to call
    "9085619": "155 Vine Ave",       # a row house: the free designs don't apply
}

REPO = Path(__file__).resolve().parent.parent
WEB_COPY = "demo-cache"          # the web's copy goes to <data dir>/demo-cache/ unless --web-out says otherwise
SCHEMAS = {"search": "search.response", "check": "check.response", "ward": "ward.response", "trend": "trend.response"}


class CacheError(RuntimeError):
    """A demo request gave no usable answer; nothing has been written."""


def demo_requests(ward_id: str = WARD_ID, addresses: Mapping[str, str] = ADDRESSES) -> list[tuple[str, dict[str, str]]]:
    """Every GET the demo makes, as (path, query parameters): /search for every prefix of each address from
    SEARCH_MIN_CHARS characters to the whole address (the web searches 150 ms after each key, and again for the
    full address once one is chosen), /check for each address, then the ward, its trend, its lots and the permits."""
    searches: dict[str, str] = {}
    for full in addresses.values():
        for n in range(SEARCH_MIN_CHARS, len(full) + 1):
            slug = search_slug(full[:n])
            if slug is not None:
                searches.setdefault(slug, normalise_address(full[:n]))
    return [
        *(("/search", {"q": q}) for q in searches.values()),
        *(("/check", {"address_id": address_id}) for address_id in addresses),
        (f"/ward/{ward_id}", {}),
        (f"/ward/{ward_id}/trend", {}),
        (f"/static/wards/{ward_id}.geojson", {}),
        ("/static/permits.geojson", {}),
    ]


def _validators() -> dict[str, Draft202012Validator]:
    schemas = contracts_dir() / "schemas"
    return {kind: Draft202012Validator(json.loads((schemas / f"{name}.schema.json").read_text(encoding="utf-8")))
            for kind, name in SCHEMAS.items()}


def _problem(name: str, doc: Any, validators: Mapping[str, Draft202012Validator]) -> str | None:
    """Why this body cannot go into the cache, or None."""
    if name.endswith(GEOJSON_SUFFIX):
        ok = isinstance(doc, dict) and doc.get("type") == "FeatureCollection" and isinstance(doc.get("features"), list)
        return None if ok and doc["features"] else "not a FeatureCollection with features"
    errors = list(validators[name.split(".")[0]].iter_errors(doc))
    if not errors:
        return None
    first = best_match(errors)
    return f"does not match {SCHEMAS[name.split('.')[0]]}: {'/'.join(map(str, first.absolute_path))}: {first.message[:200]}"


def fetch(client: TestClient, requests: Sequence[tuple[str, Mapping[str, str]]]) -> dict[str, bytes]:
    """File name -> body for every request; raises CacheError at the first answer that is not a usable 200."""
    validators = _validators()
    files: dict[str, bytes] = {}
    for path, params in requests:
        url = f"{path}?{urlencode(params)}" if params else path
        name = cache_name(path, params)
        if name is None:
            raise CacheError(f"GET {url} has no demo cache file name (api/demo_cache.py)")
        r = client.get(path, params=params)
        if HEADER in r.headers:
            raise CacheError(f"GET {url} was answered from the demo cache ({r.headers[HEADER]}), not from the data")
        if r.status_code != 200:
            raise CacheError(f"GET {url} answered {r.status_code}: {r.text[:300]}")
        try:
            doc = r.json()
        except ValueError as e:
            raise CacheError(f"GET {url} answered a body that is not JSON ({e})") from e
        problem = _problem(name, doc, validators)
        if problem:
            raise CacheError(f"GET {url}: {problem}")
        if name.startswith("check."):
            doc["meta"]["cached"] = True
            files[name] = json.dumps(doc, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
        else:
            files[name] = r.content
    return files


def write(files: Mapping[str, bytes], folder: Path) -> None:
    """Every file into `folder`, each through a temporary file so a reader never sees half of one."""
    folder.mkdir(parents=True, exist_ok=True)
    for name, body in files.items():
        tmp = folder / f".{name}.tmp"
        tmp.write_bytes(body)
        os.replace(tmp, folder / name)


def write_demo_cache(client: TestClient, out_dirs: Sequence[Path], ward_id: str = WARD_ID,
                     addresses: Mapping[str, str] = ADDRESSES) -> dict[str, bytes]:
    """Fetch every demo response, then write them all into each folder: a failed request writes nothing."""
    files = fetch(client, demo_requests(ward_id, addresses))
    for folder in out_dirs:
        write(files, Path(folder))
    return files


def writer_settings(data_dir: Path, gpkg: Path | str | None) -> Settings:
    """The API's settings from the environment on this data, with the demo cache off: the writer reads the data,
    never the cache it is replacing."""
    return replace(Settings.from_env(), data_dir=Path(data_dir), gpkg_path=Path(gpkg) if gpkg else None,
                   demo_cache=False)


def _note(name: str, body: bytes) -> str:
    """What to eyeball before the demo: each address's results and the trend's source."""
    if name.startswith("check."):
        doc = json.loads(body)
        results = ", ".join(f"{d['design_id']} {d['result']}" for d in doc["designs"])
        return f"  {doc['address']['address_full']}, ward {doc['lot']['ward_id']}, {doc['lot']['class']}: {results}"
    if name.startswith("trend."):
        return f"  source {json.loads(body)['source']}"
    return ""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m api.cache_demo", description=__doc__.split("\n\n")[0])
    ap.add_argument("--data-dir", default=os.environ.get("SUPLEX_DATA_DIR") or str(REPO / "data" / "out"))
    ap.add_argument("--gpkg", default=os.environ.get("SUPLEX_GPKG") or None,
                    help="GeoPackage (default <data-dir>/suplex.gpkg, or SUPLEX_GPKG)")
    ap.add_argument("--out", default=str(CACHE_DIR), help="the API's cache folder (default api/cache/)")
    ap.add_argument("--web-out", help=f"the web's copy (default <data-dir>/{WEB_COPY}/)")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)       # one line per request otherwise
    warnings.filterwarnings("ignore", message="Using `httpx` with `starlette.testclient` is deprecated")

    data_dir = Path(args.data_dir)
    out_dirs = [Path(args.out), Path(args.web_out) if args.web_out else data_dir / WEB_COPY]
    t0 = time.perf_counter()
    try:
        with TestClient(create_app(settings=writer_settings(data_dir, args.gpkg))) as client:
            files = write_demo_cache(client, out_dirs)
    except (StoreError, CacheError) as e:
        print(f"cache_demo: {e}\nnothing was written", file=sys.stderr)
        return 1

    total = sum(len(body) for body in files.values())
    print(f"demo cache for ward {WARD_ID} and {len(ADDRESSES)} addresses: {len(files)} files, {total / 1e6:.1f} MB, "
          f"{time.perf_counter() - t0:.0f} s, written to")
    for folder in out_dirs:
        print(f"  {folder.resolve()}")
    for name in sorted(files):
        print(f"  {len(files[name]):>11,}  {name}{_note(name, files[name])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
