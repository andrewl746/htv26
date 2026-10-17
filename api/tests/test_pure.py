"""Tests that need no data: search normalisation and prefix matching, data dates, error shapes,
`ward_response` and the trend fallback."""
from __future__ import annotations

import asyncio
import copy
import json
import re
import time
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api.main import create_app, trend_response, ward_response, warm_tiger_import
from api.store import normalise_address, normalise_data_dates, one_per_lot, prefix_range

FIXTURES = Path(__file__).resolve().parents[2] / "contracts" / "fixtures"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


# ---------- search ----------

def test_normalise_address_like_the_pipeline_address_norm() -> None:
    assert normalise_address("  32   Nineteenth\tST ") == "32 nineteenth st"
    assert normalise_address("32 NINE") == "32 nine"
    assert normalise_address(" \n ") == ""


def test_prefix_range_finds_every_address_starting_with_the_query() -> None:
    norms = np.array(sorted(["32 nineteenth st", "32 ninth st", "320 main st", "33 nineteenth st", "32 a st"]),
                     dtype=object)

    def match(q: str) -> list[str]:
        lo, hi = prefix_range(norms, q)
        return list(norms[lo:hi])

    assert match("32 nine") == ["32 nineteenth st"]
    assert match("32 ") == ["32 a st", "32 nineteenth st", "32 ninth st"]
    assert match("32") == ["32 a st", "32 nineteenth st", "32 ninth st", "320 main st"]
    assert match("99") == []
    assert match("33 nineteenth st") == ["33 nineteenth st"]


def test_one_per_lot_prefers_the_primary_address_and_keeps_address_order() -> None:
    # Candidates in address order. Lot 7 shows its secondary address first and its primary later.
    lot_of = np.array([7, 3, 7, 5, 3])
    primary = np.array([False, True, True, True, False])
    assert one_per_lot(lot_of, primary, 8).tolist() == [1, 2, 3]
    assert one_per_lot(lot_of, primary, 2).tolist() == [1, 2]
    # A lot whose primary address does not match keeps its first matching address.
    assert one_per_lot(np.array([4, 4, 9]), np.array([False, False, True]), 8).tolist() == [0, 2]
    assert one_per_lot(np.array([], dtype=np.int64), np.array([], dtype=bool), 8).tolist() == []


# ---------- data dates ----------

def test_normalise_data_dates_gives_contract_keys_and_dates() -> None:
    raw = {
        "3d-massing": "2025-12-05 13:38:35",
        "_fetched_at": "2026-10-17T08:11:14+00:00",
        "address-points-municipal-toronto-one-address-repository": "2026-10-16 11:40:29.039494",
        "building-permits-active-permits": "2026-10-16 10:23:31.559444",
        "zoning-by-law": "2026-02-20 21:29:39.13994",
        "city-wards": "2026-02-20 19:02:48.513254",
        "Some New-Dataset": "2026-01-02",
        "no-date": None,
        "bad-date": "yesterday",
    }
    out = normalise_data_dates(raw)
    assert out == {
        "massing": "2025-12-05",
        "address_points": "2026-10-16",
        "permits_active": "2026-10-16",
        "zoning": "2026-02-20",
        "wards": "2026-02-20",
        "some_new_dataset": "2026-01-02",
    }
    assert all(re.fullmatch(r"[a-z][a-z0-9_]*", k) for k in out)
    assert all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) for v in out.values())


# ---------- error shapes (decided before the store is touched) ----------

@pytest.fixture
def bare_client():
    with TestClient(create_app(store=SimpleNamespace())) as c:
        yield c


def test_unknown_route_is_json_not_found(bare_client) -> None:
    r = bare_client.get("/no/such/route")
    assert r.status_code == 404
    assert r.json() == {"error": "not_found"}


def test_wrong_method_is_json(bare_client) -> None:
    r = bare_client.post("/check")
    assert r.status_code == 405
    assert r.json()["error"] == "method_not_allowed"


@pytest.mark.parametrize("query", [
    "", "?address_id=", "?address_id=1&lot_id=2", "?lon=-79.4", "?lat=43.6",
    "?address_id=1&lon=-79.4&lat=43.6", "?lon=nan&lat=43.6", "?lon=-79.4&lat=inf",
])
def test_check_needs_exactly_one_lookup(bare_client, query: str) -> None:
    r = bare_client.get("/check" + query)
    assert r.status_code == 400, r.text
    body = r.json()
    assert body["error"] == "bad_request"
    assert isinstance(body["detail"], str) and body["detail"]


@pytest.mark.parametrize("path", ["/check?lon=abc&lat=43.6", "/search?q=ab&limit=0", "/search?q=ab&limit=x"])
def test_validation_errors_are_bad_request(bare_client, path: str) -> None:
    r = bare_client.get(path)
    assert r.status_code == 400, r.text
    body = r.json()
    assert body["error"] == "bad_request"
    assert isinstance(body["detail"], str) and body["detail"]


# ---------- /ward/{id} ----------

def test_ward_response_from_the_sample_entry(schema_errors) -> None:
    entry = fixture("ward_summary.sample.json")["wards"]["04"]
    before = copy.deepcopy(entry)
    body = ward_response(entry, "04", "http://localhost:8001/")
    assert body["lots_url"] == "/static/wards/04.geojson"
    assert body["permits_url"] == "/static/permits.geojson"
    assert body["trend_url"] == "/ward/04/trend"
    assert body["briefing_url"] == "http://localhost:8001/b/04"
    assert {k: v for k, v in body.items() if not k.endswith("_url")} == entry
    assert entry == before
    assert schema_errors("ward.response", body) == []


# ---------- /ward/{id}/trend ----------

def write_cache(folder: Path, ward_id: str = "04") -> dict:
    doc = fixture("trend.04.json")
    doc["ward_id"] = ward_id
    (folder / f"{ward_id}.json").write_text(json.dumps(doc), encoding="utf-8")
    return doc


def timed(coro) -> tuple[object, float]:
    async def run():
        t0 = time.perf_counter()
        result = await coro
        return result, time.perf_counter() - t0
    return asyncio.run(run())


def test_trend_serves_the_cache_at_once_when_tiger_dsn_is_unset(tmp_path, monkeypatch, schema_errors) -> None:
    monkeypatch.delenv("TIGER_DSN", raising=False)
    cached = write_cache(tmp_path)
    warm_tiger_import()                       # as the app's startup does; a cold psycopg load is not the point
    body, seconds = timed(trend_response("04", tmp_path, "2022-01-01"))   # the real queries.py path
    assert body == cached
    assert body["source"] == "cache"
    assert seconds < 1.0
    assert schema_errors("trend.response", body) == []


def test_trend_from_tiger_copies_the_markers_from_the_cache(tmp_path, schema_errors) -> None:
    cached = write_cache(tmp_path)
    series = [{"month": "2022-01", "permits": 2, "units": 7}, {"month": "2022-02", "permits": 0, "units": 0}]
    body, _ = timed(trend_response("04", tmp_path, "2022-01-01", fetch=lambda w, s: series))
    assert body["source"] == "tigerdata"
    assert body["ward_id"] == "04"
    assert body["since"] == "2022-01"
    assert body["series"] == series
    assert body["markers"] == cached["markers"]
    assert body["generated_at"].endswith("Z")
    assert schema_errors("trend.response", body) == []


def test_trend_from_tiger_without_a_cache_file_has_no_markers(tmp_path, schema_errors) -> None:
    body, _ = timed(trend_response("04", tmp_path, "2022-01-01", fetch=lambda w, s: []))
    assert body["source"] == "tigerdata"
    assert body["markers"] == []
    assert schema_errors("trend.response", body) == []


def test_trend_falls_back_to_the_cache_when_tiger_is_slow(tmp_path) -> None:
    cached = write_cache(tmp_path)

    def slow(ward_id: str, since: str) -> list[dict]:
        time.sleep(0.5)
        return []

    body, seconds = timed(trend_response("04", tmp_path, "2022-01-01", fetch=slow, budget_s=0.1))
    assert body == cached
    assert seconds < 0.4


def test_trend_falls_back_to_the_cache_on_any_error(tmp_path) -> None:
    cached = write_cache(tmp_path)

    def boom(ward_id: str, since: str) -> list[dict]:
        raise ImportError("no psycopg")

    body, _ = timed(trend_response("04", tmp_path, "2022-01-01", fetch=boom))
    assert body == cached


def test_trend_is_none_without_tiger_or_cache(tmp_path) -> None:
    def boom(ward_id: str, since: str) -> list[dict]:
        raise RuntimeError("down")

    body, _ = timed(trend_response("04", tmp_path, "2022-01-01", fetch=boom))
    assert body is None
