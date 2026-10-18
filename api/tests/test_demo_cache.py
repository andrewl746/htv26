"""SUPLEX_DEMO_CACHE (MASTERSPEC 3.3, 6.7): cache file names, serving from api/cache/, starting without data.
No data needed: the cache is a temporary folder of contract fixtures."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from api.demo_cache import HEADER, cache_name, search_slug
from api.main import Settings, create_app

FIXTURES = Path(__file__).resolve().parents[2] / "contracts" / "fixtures"
ORIGIN = "http://localhost:5173"


@pytest.mark.parametrize(("path", "params", "name"), [
    ("/search", {"q": "326  Quebec Ave"}, "search.326-quebec-ave.json"),
    ("/search", {"q": "32 Nine", "limit": "3"}, "search.32-nine.json"),
    ("/search", {"q": " a "}, None),
    ("/check", {"address_id": "7986858"}, "check.7986858.json"),
    ("/check", {"lot_id": "5431267"}, "check.lot.5431267.json"),
    ("/check", {"address_id": "1", "lot_id": "2"}, None),
    ("/check", {"lon": "-79.4", "lat": "43.6"}, None),
    ("/check", {"address_id": "../suplex"}, None),
    ("/ward/04", {}, "ward.04.json"),
    ("/ward/04/trend", {}, "trend.04.json"),
    ("/static/wards/04.geojson", {}, "lots.04.geojson"),
    ("/static/permits.geojson", {}, "permits.geojson"),
    ("/ward/99", {}, None),
    ("/ward/city", {}, None),
    ("/static/wards/..%2Fsuplex.geojson", {}, None),
    ("/designs", {}, None),
    ("/health", {}, None),
])
def test_cache_names_follow_the_web_demo_cache(path: str, params: dict, name: str | None) -> None:
    assert cache_name(path, params) == name


def test_search_slug_is_the_normalised_query() -> None:
    assert search_slug("  32 NINETEENTH St ") == "32-nineteenth-st"
    assert search_slug("St. Clair Ave W") == "st-clair-ave-w"
    assert search_slug("x") is None


@pytest.fixture
def cache_dir(tmp_path: Path) -> Path:
    d = tmp_path / "cache"
    d.mkdir()
    shutil.copy(FIXTURES / "check.fits.json", d / "check.123.json")
    shutil.copy(FIXTURES / "ward.04.json", d / "ward.04.json")
    shutil.copy(FIXTURES / "trend.04.json", d / "trend.04.json")
    shutil.copy(FIXTURES / "lots.04.sample.geojson", d / "lots.04.geojson")
    shutil.copy(FIXTURES / "search.json", d / "search.100-fixture.json")
    return d


def settings(data_dir: Path, cache_dir: Path, demo: bool = True) -> Settings:
    return Settings(data_dir=data_dir, gpkg_path=None, ai_url="http://localhost:8001", cors_origins=(),
                    demo_cache=demo, cache_dir=cache_dir)


def test_cached_responses_are_served_with_cors_and_gzip(tmp_path: Path, cache_dir: Path) -> None:
    def no_search(q: str, limit: int) -> list:
        raise AssertionError("a cached search must not reach the store")

    app = create_app(store=SimpleNamespace(search=no_search), settings=settings(tmp_path, cache_dir))
    with TestClient(app) as c:
        r = c.get("/check", params={"address_id": "123"}, headers={"Origin": ORIGIN})
        assert r.status_code == 200
        assert r.headers[HEADER] == "check.123.json"
        assert r.headers["access-control-allow-origin"] == ORIGIN
        body = r.json()
        assert body["meta"]["cached"] is True
        expected = json.loads((FIXTURES / "check.fits.json").read_text(encoding="utf-8"))
        expected["meta"]["cached"] = True
        assert body == expected

        r = c.get("/ward/04")
        assert r.json() == json.loads((FIXTURES / "ward.04.json").read_text(encoding="utf-8"))
        assert c.get("/ward/04/trend").json()["ward_id"] == "04"
        assert c.get("/search", params={"q": "100 Fixture"}).json()["results"]

        r = c.get("/static/wards/04.geojson", headers={"Accept-Encoding": "gzip"})
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/geo+json")
        assert r.headers.get("content-encoding") == "gzip"
        assert r.json()["type"] == "FeatureCollection"


def test_a_cached_trend_says_it_came_from_the_cache(tmp_path: Path, cache_dir: Path) -> None:
    """The trend was written while Tiger Data answered, but on stage it comes from a file: the briefing page and
    the ward panel show their "Cached data" badge only when `source` is "cache" (Simone, 2026-10-18)."""
    trend = json.loads((FIXTURES / "trend.04.json").read_text(encoding="utf-8")) | {"source": "tigerdata"}
    (cache_dir / "trend.04.json").write_text(json.dumps(trend), encoding="utf-8")
    with TestClient(create_app(settings=settings(tmp_path / "renamed-away", cache_dir))) as c:
        body = c.get("/ward/04/trend").json()
    assert body == trend | {"source": "cache"}


def test_a_cache_miss_goes_to_the_live_route(tmp_path: Path, cache_dir: Path) -> None:
    store = SimpleNamespace(search=lambda q, limit: [{"live": q}])
    with TestClient(create_app(store=store, settings=settings(tmp_path, cache_dir))) as c:
        assert c.get("/search", params={"q": "nothing cached"}).json() == {"query": "nothing cached",
                                                                           "results": [{"live": "nothing cached"}]}


def test_the_cache_is_ignored_when_the_mode_is_off(tmp_path: Path, cache_dir: Path) -> None:
    store = SimpleNamespace(search=lambda q, limit: [])
    with TestClient(create_app(store=store, settings=settings(tmp_path, cache_dir, demo=False))) as c:
        r = c.get("/search", params={"q": "100 Fixture"})
        assert r.json()["results"] == []
        assert HEADER not in r.headers


def test_without_data_the_api_starts_on_the_cache_alone(tmp_path: Path, cache_dir: Path) -> None:
    with TestClient(create_app(settings=settings(tmp_path / "renamed-away", cache_dir))) as c:
        health = c.get("/health").json()
        assert health["mode"] == "demo_cache_only" and health["demo_cache"] is True
        assert c.get("/check", params={"address_id": "123"}).json()["meta"]["cached"] is True
        assert c.get("/ward/04").status_code == 200
        assert c.get("/designs").json()["designs"]
        for path in ("/check?address_id=999", "/ward/05", "/search?q=elsewhere", "/static/permits.geojson"):
            r = c.get(path, headers={"Origin": ORIGIN})
            assert r.status_code == 503, path
            assert r.json()["error"] == "data_unavailable", path
            assert r.headers["access-control-allow-origin"] == ORIGIN, path
