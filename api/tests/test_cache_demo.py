"""A11 (MASTERSPEC 3.3, 6.7, 8.1): `python -m api.cache_demo` saves the demo's responses under the names
api/demo_cache.py looks up, in api/cache/ and in the web's copy. The writer runs here on a store made of the
contract fixtures; the last two tests run it on the real data and are skipped without it."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from api.cache_demo import ADDRESSES, WARD_ID, CacheError, demo_requests, write_demo_cache, writer_settings
from api.demo_cache import HEADER, cache_name
from api.main import Settings, create_app
from api.store import normalise_address

FIXTURES = Path(__file__).resolve().parents[2] / "contracts" / "fixtures"

# What the presenter types and opens (MASTERSPEC 0.5, decision 18), spelled out rather than derived.
EXPECTED = {
    "search.326-que.json", "search.281-arm.json", "search.155-vin.json",
    "search.326-quebec-ave.json", "search.281-armadale-ave.json", "search.155-vine-ave.json",
    "check.7986858.json", "check.7955411.json", "check.9085619.json",
    "ward.04.json", "trend.04.json", "lots.04.geojson", "permits.geojson",
}
SCHEMAS = {"search": "search.response", "check": "check.response", "ward": "ward.response", "trend": "trend.response"}


def fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FixtureStore:
    """Just enough of api.store.Store for the routes the demo calls, answered from contracts/fixtures."""

    def __init__(self, data_dir: Path, address_ids: list[str]) -> None:
        self.data_dir = data_dir
        self.cfg = SimpleNamespace(permits_trend_since="2022-01-01")
        self.ward_ids = frozenset({WARD_ID})
        self.ward_summary = {"wards": {WARD_ID: fixture("ward.04.json")}}
        self.address_ids = address_ids

    def search(self, q: str, limit: int) -> list[dict[str, Any]]:
        results = fixture("search.json")["results"]
        return [r for r in results if normalise_address(r["address_full"]).startswith(normalise_address(q))][:limit]

    def address_pos(self, address_id: str) -> int | None:
        return self.address_ids.index(address_id) if address_id in self.address_ids else None

    def lot_of_address(self, address_pos: int) -> int:
        return address_pos

    def check(self, lot_pos: int, address_pos: int | None = None) -> dict[str, Any]:
        doc = fixture("check.fits.json")
        doc["address"]["address_id"] = self.address_ids[lot_pos]
        return doc


@pytest.fixture
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A data directory with the files the static and trend routes read; Tiger Data off, so the trend is the cache."""
    monkeypatch.delenv("TIGER_DSN", raising=False)
    d = tmp_path / "data"
    (d / "wards").mkdir(parents=True)
    (d / "trend_cache").mkdir()
    shutil.copy(FIXTURES / "lots.04.sample.geojson", d / "wards" / f"{WARD_ID}.geojson")
    shutil.copy(FIXTURES / "permits.sample.geojson", d / "permits.geojson")
    shutil.copy(FIXTURES / "trend.04.json", d / "trend_cache" / f"{WARD_ID}.json")
    return d


def settings(data_dir: Path, cache_dir: Path | None = None) -> Settings:
    return Settings(data_dir=data_dir, gpkg_path=None, ai_url="http://localhost:8001", cors_origins=(),
                    demo_cache=cache_dir is not None, cache_dir=cache_dir or data_dir / "no-cache")


def fixture_client(data_dir: Path, address_ids: list[str] | None = None) -> TestClient:
    store = FixtureStore(data_dir, list(ADDRESSES) if address_ids is None else address_ids)
    return TestClient(create_app(store=store, settings=settings(data_dir)))


def files_in(folder: Path) -> dict[str, bytes]:
    return {p.name: p.read_bytes() for p in folder.iterdir()} if folder.is_dir() else {}


def test_the_searches_cover_every_prefix_the_presenter_types() -> None:
    """The web searches 150 ms after each key from 2 characters on, and again for the full address once one is
    chosen, so every prefix from 2 characters to the full address has a file."""
    names = [cache_name(path, params) for path, params in demo_requests()]
    assert None not in names
    assert len(names) == len(set(names))
    assert EXPECTED <= set(names)
    vine = {n for n in names if n.startswith("search.15")}
    assert vine == {"search.15.json", "search.155.json", "search.155-v.json", "search.155-vi.json",
                    "search.155-vin.json", "search.155-vine.json", "search.155-vine-a.json",
                    "search.155-vine-av.json", "search.155-vine-ave.json"}


def test_the_writer_saves_every_response_in_both_folders(data_dir: Path, tmp_path: Path, schema_errors) -> None:
    api_out, web_out = tmp_path / "api-cache", tmp_path / "web-cache"
    with fixture_client(data_dir) as c:
        written = write_demo_cache(c, [api_out, web_out])

    api_files, web_files = files_in(api_out), files_in(web_out)
    assert set(api_files) == set(written)
    assert EXPECTED <= set(api_files)
    assert web_files == api_files
    for name, body in api_files.items():
        doc = json.loads(body.decode("utf-8"))
        kind = name.split(".")[0]
        if name.endswith(".geojson"):
            assert doc["type"] == "FeatureCollection" and doc["features"], name
        else:
            assert schema_errors(SCHEMAS[kind], doc) == [], name
        if kind == "check":
            assert doc["meta"]["cached"] is True, name          # the web serves its copy as is (6.7)
            assert name == f"check.{doc['address']['address_id']}.json"
    assert json.loads(api_files["lots.04.geojson"]) == fixture("lots.04.sample.geojson")
    assert json.loads(api_files["trend.04.json"]) == fixture("trend.04.json")


def test_the_cache_mode_answers_the_demo_from_the_written_files(data_dir: Path, tmp_path: Path) -> None:
    """The A11 acceptance check on the fixtures: the data directory gone, SUPLEX_DEMO_CACHE on, the demo still runs."""
    api_out = tmp_path / "api-cache"
    with fixture_client(data_dir) as c:
        write_demo_cache(c, [api_out])
    shutil.rmtree(data_dir)

    with TestClient(create_app(settings=settings(data_dir, cache_dir=api_out))) as c:
        assert c.get("/health").json()["mode"] == "demo_cache_only"
        for url in ("/check?address_id=7986858", "/check?address_id=7955411", "/check?address_id=9085619",
                    "/ward/04", "/ward/04/trend", "/search?q=326%20que", "/search?q=281+Arm", "/search?q=155%20Vine%20Ave",
                    "/static/wards/04.geojson", "/static/permits.geojson"):
            r = c.get(url)
            assert r.status_code == 200, url
            assert HEADER in r.headers, url
            if url.startswith("/check"):
                assert r.json()["meta"]["cached"] is True
        for path, params in demo_requests():
            assert c.get(path, params=params).status_code == 200, (path, params)


@pytest.mark.parametrize("breakage", ["check without designs", "empty lots file"])
def test_an_answer_that_breaks_its_contract_writes_nothing(data_dir: Path, tmp_path: Path, breakage: str) -> None:
    store = FixtureStore(data_dir, list(ADDRESSES))
    if breakage == "check without designs":
        good_check = store.check
        store.check = lambda lot_pos, address_pos=None: {k: v for k, v in good_check(lot_pos).items() if k != "designs"}
        expected = "check.response"
    else:
        (data_dir / "wards" / f"{WARD_ID}.geojson").write_text('{"type":"FeatureCollection","features":[]}')
        expected = "FeatureCollection with features"
    api_out = tmp_path / "api-cache"
    with (TestClient(create_app(store=store, settings=settings(data_dir))) as c,
          pytest.raises(CacheError, match=expected)):
        write_demo_cache(c, [api_out])
    assert files_in(api_out) == {}


def test_a_failed_request_writes_nothing(data_dir: Path, tmp_path: Path) -> None:
    api_out = tmp_path / "api-cache"
    with (fixture_client(data_dir, address_ids=["7986858", "7955411"]) as c,   # 155 Vine Ave is missing
          pytest.raises(CacheError, match="9085619.*404")):
        write_demo_cache(c, [api_out])
    assert files_in(api_out) == {}


def test_the_writer_never_copies_the_old_cache(data_dir: Path, tmp_path: Path) -> None:
    old = tmp_path / "old-cache"
    old.mkdir()
    shutil.copy(FIXTURES / "ward.04.json", old / "ward.04.json")
    store = FixtureStore(data_dir, list(ADDRESSES))
    with (TestClient(create_app(store=store, settings=settings(data_dir, cache_dir=old))) as c,
          pytest.raises(CacheError, match="demo cache")):
        write_demo_cache(c, [tmp_path / "api-cache"])


def test_the_writer_reads_the_data_even_with_the_cache_mode_on(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPLEX_DEMO_CACHE", "1")
    s = writer_settings(tmp_path / "data", tmp_path / "data" / "suplex_citywide.gpkg")
    assert s.demo_cache is False
    assert (s.data_dir, s.gpkg_path) == (tmp_path / "data", tmp_path / "data" / "suplex_citywide.gpkg")


# ---------- on the real data (skipped without it) ----------

def test_the_demo_addresses_are_in_the_data(store: Any) -> None:
    for address_id, full in ADDRESSES.items():
        pos = store.address_pos(address_id)
        assert pos is not None, f"address_id {address_id} ({full}) is not in {store.gpkg_path}"
        assert str(store.adr_full[pos]) == full
        assert str(store.adr_ward[pos]) == WARD_ID


def test_the_writer_runs_on_the_real_data(client: TestClient, store: Any, tmp_path: Path,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
    needed = [store.data_dir / p for p in ("ward_summary.json", f"wards/{WARD_ID}.geojson", "permits.geojson",
                                           f"trend_cache/{WARD_ID}.json")]
    missing = [str(p) for p in needed if not p.is_file()]
    if missing:
        pytest.skip(f"the batch outputs are not in the data directory: {', '.join(missing)}")
    monkeypatch.delenv("TIGER_DSN", raising=False)
    written = write_demo_cache(client, [tmp_path / "api-cache"])
    assert EXPECTED <= set(written)
    for address_id, full in ADDRESSES.items():
        doc = json.loads(written[f"check.{address_id}.json"])
        assert (doc["address"]["address_id"], doc["address"]["address_full"]) == (address_id, full)
        assert doc["lot"]["ward_id"] == WARD_ID
