"""Data-backed API tests against the Ward 04 store (or SUPLEX_GPKG). Skipped without the GeoPackage."""
from __future__ import annotations

import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
import shapely
from pyproj import Transformer
from suplex_engine.classify import NOT_CHECKED_CLASSES

from api.store import normalise_address

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
WARD = "04"
TO_WGS84 = Transformer.from_crs("EPSG:2952", "EPSG:4326", always_xy=True)


def lonlat(x: float, y: float) -> tuple[float, float]:
    lon, lat = TO_WGS84.transform(x, y)
    return float(lon), float(lat)


def ward_lots_with_address(store: Any) -> Iterator[tuple[int, int]]:
    """(lot position, primary address position) for the dev ward's lots, in file order."""
    for lot in range(store.lot_count):
        if str(store.lot_cols["ward_id"][lot]) == WARD and store.primary_address(lot) is not None:
            yield lot, store.primary_address(lot)


# ---------- /health, /designs ----------

def test_health(client, store) -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["lot_count"] == store.lot_count > 0
    assert body["ward_count"] == 25
    assert set(body["layers"]) == {"lots", "buildings", "addresses", "corridors", "trees"}
    assert body["layers"]["lots"] == body["lot_count"]
    assert isinstance(body["load_seconds"], float)
    assert body["ward_summary_loaded"] is (store.ward_summary is not None)
    assert isinstance(body["tiger_dsn_set"], bool)
    assert body["data_dates"] == store.data_dates
    assert {"engine_version", "designs_version", "config_version"} <= set(body)


def test_designs_is_the_contract_file(client) -> None:
    r = client.get("/designs")
    assert r.status_code == 200
    assert r.json() == json.loads((CONTRACTS / "designs.json").read_text(encoding="utf-8"))


# ---------- /search ----------

def test_search_prefix_matches_one_result_per_lot(client, store, schema_errors) -> None:
    _, address = next(ward_lots_with_address(store))
    full = str(store.adr_full[address])
    q = normalise_address(full)[:-2]
    body = client.get("/search", params={"q": q}).json()
    assert schema_errors("search.response", body) == []
    assert body["query"] == q
    results = body["results"]
    assert 1 <= len(results) <= 8
    norms = [normalise_address(r["address_full"]) for r in results]
    assert all(n.startswith(q) for n in norms)
    assert norms == sorted(norms)
    lots = [store.lot_of_address(store.address_pos(r["address_id"])) for r in results]
    assert len(set(lots)) == len(lots)
    assert all(r["ward_id"] == WARD and r["ward_name"] for r in results)

    # Case and spacing do not matter; the full address finds itself (it is its lot's primary address).
    shouty = client.get("/search", params={"q": "  " + full.upper().replace(" ", "   ") + " "}).json()
    assert str(store.adr_ids[address]) in [r["address_id"] for r in shouty["results"]]


def test_search_short_or_unmatched_query_is_empty(client) -> None:
    assert client.get("/search", params={"q": "2"}).json() == {"query": "2", "results": []}
    assert client.get("/search", params={"q": " "}).json()["results"] == []
    assert client.get("/search", params={"q": "zzzz no such street"}).json()["results"] == []
    assert client.get("/search").json() == {"query": "", "results": []}


def test_search_limit_is_capped_at_eight(client) -> None:
    assert len(client.get("/search", params={"q": "10"}).json()["results"]) == 8
    assert len(client.get("/search", params={"q": "10", "limit": 3}).json()["results"]) == 3
    assert len(client.get("/search", params={"q": "10", "limit": 50}).json()["results"]) == 8


# ---------- /check ----------

def test_check_by_address_is_valid_and_under_a_second(client, store, schema_errors) -> None:
    sample = [pair for pair, _ in zip(ward_lots_with_address(store), range(10), strict=False)]
    client.get("/check", params={"address_id": str(store.adr_ids[sample[0][1]])})        # warm-up
    timings = []
    for lot, address in sample:
        aid = str(store.adr_ids[address])
        t0 = time.perf_counter()
        r = client.get("/check", params={"address_id": aid})
        timings.append(time.perf_counter() - t0)
        assert r.status_code == 200, r.text
        body = r.json()
        assert schema_errors("check.response", body) == []
        assert body["address"]["address_id"] == aid
        assert body["address"]["address_full"] == str(store.adr_full[address])
        assert body["lot"]["lot_id"] == str(store.lot_ids[lot])
        assert body["meta"]["data_dates"] == store.data_dates
    print("/check ms:", [round(1000 * t) for t in timings])
    assert max(timings) < 1.0


def test_check_validates_for_a_checked_an_attached_and_a_not_checked_lot(client, store, schema_errors) -> None:
    wanted = {"checked": None, "attached": None, "not_checked": None}
    for lot, address in ward_lots_with_address(store):
        cls = store.check(lot, address)["lot"]["class"]
        key = "not_checked" if cls in NOT_CHECKED_CLASSES else cls
        if key in wanted and wanted[key] is None:
            wanted[key] = str(store.adr_ids[address])
        if all(wanted.values()):
            break
    assert all(wanted.values()), wanted
    for key, aid in wanted.items():
        body = client.get("/check", params={"address_id": aid}).json()
        assert schema_errors("check.response", body) == [], key
        results = {d["result"] for d in body["designs"]}
        assert (results == {"not_checked"}) is (key == "not_checked")


def test_check_by_lot_id_uses_the_primary_address(client, store, schema_errors) -> None:
    lot, address = next(ward_lots_with_address(store))
    body = client.get("/check", params={"lot_id": str(store.lot_ids[lot])}).json()
    assert body["lot"]["lot_id"] == str(store.lot_ids[lot])
    assert body["address"]["address_id"] == str(store.adr_ids[address])

    bare = next(i for i in range(store.lot_count) if store.primary_address(i) is None)
    body = client.get("/check", params={"lot_id": str(store.lot_ids[bare])}).json()
    assert schema_errors("check.response", body) == []
    assert body["address"]["address_id"] is None and body["address"]["address_full"] is None
    assert (body["address"]["lon"], body["address"]["lat"]) == (body["context"]["origin"]["lon"],
                                                                 body["context"]["origin"]["lat"])


def test_check_unknown_ids_are_address_not_found(client) -> None:
    for params in ({"address_id": "999999999999"}, {"address_id": "not-an-id"}, {"lot_id": "999999999999"}):
        r = client.get("/check", params=params)
        assert r.status_code == 404
        assert r.json() == {"error": "address_not_found"}


def test_check_lon_lat_inside_a_lot_returns_that_lot(client, store) -> None:
    lot, _ = next(ward_lots_with_address(store))
    p = shapely.point_on_surface(store.lot_geoms[lot])
    lon, lat = lonlat(p.x, p.y)
    r = client.get("/check", params={"lon": lon, "lat": lat})
    assert r.status_code == 200, r.text
    assert r.json()["lot"]["lot_id"] == str(store.lot_ids[lot])


def test_check_lon_lat_in_the_lake_is_outside_toronto(client) -> None:
    r = client.get("/check", params={"lon": -79.38, "lat": 43.60})
    assert r.status_code == 404
    assert r.json() == {"error": "outside_toronto"}


def test_check_lon_lat_on_a_street_is_address_not_found(client, store) -> None:
    ward = store.ward_geoms[list(store.ward_names).index(WARD)]
    for geom in store.cor_geoms:
        p = shapely.point_on_surface(geom)
        if ward.contains(p) and store.lot_at(p.x, p.y) is None:
            break
    else:
        pytest.fail("no street point found in the ward")
    lon, lat = lonlat(p.x, p.y)
    r = client.get("/check", params={"lon": lon, "lat": lat})
    assert r.status_code == 404
    assert r.json() == {"error": "address_not_found"}


# ---------- /ward/{id}, /ward/{id}/trend ----------

def test_ward_needs_the_batch_summary(client, store, schema_errors) -> None:
    r = client.get(f"/ward/{WARD}")
    if store.ward_summary is None:
        assert r.status_code == 503
        assert r.json() == {"error": "ward_summary_unavailable",
                            "detail": "run the batch (python -m suplex_engine.batch --all)"}
    else:
        assert r.status_code == 200
        assert schema_errors("ward.response", r.json()) == []
    for bad in ("99", "4", "city"):
        r = client.get(f"/ward/{bad}")
        assert r.status_code == 404
        assert r.json() == {"error": "ward_not_found"}


def test_trend_without_tiger_dsn_is_the_cache(client, store, monkeypatch, schema_errors) -> None:
    monkeypatch.delenv("TIGER_DSN", raising=False)
    r = client.get(f"/ward/{WARD}/trend")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "cache"
    assert schema_errors("trend.response", body) == []
    cache = json.loads((store.data_dir / "trend_cache" / f"{WARD}.json").read_text(encoding="utf-8"))
    assert body == cache
    r = client.get("/ward/99/trend")
    assert r.status_code == 404
    assert r.json() == {"error": "ward_not_found"}


# ---------- /static ----------

def test_static_permits_is_gzipped_geojson(client) -> None:
    r = client.get("/static/permits.geojson", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/geo+json")
    assert r.headers.get("content-encoding") == "gzip"
    assert r.json()["type"] == "FeatureCollection"


def test_static_serves_nothing_else(client, store) -> None:
    lots = client.get(f"/static/wards/{WARD}.geojson")
    if not (store.data_dir / "wards" / f"{WARD}.geojson").is_file():
        assert lots.status_code == 404
        assert lots.json() == {"error": "not_found"}
    for path in ("/static/wards/99.geojson", "/static/suplex.gpkg", "/static/data_dates.json",
                 "/static/trend_cache/04.json", "/static/wards/..%2Fsuplex.gpkg"):
        r = client.get(path)
        assert r.status_code == 404, path
        assert r.json() == {"error": "not_found"}, path
