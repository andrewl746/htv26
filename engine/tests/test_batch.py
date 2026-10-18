"""A10 batch run (MASTERSPEC 3.4): the per-lot reduction, the counts, the ward summary and the strips.

The pure tests use the contract fixtures. The real-lot test (skipped without data/out/suplex.gpkg) runs one strip
holding the A8 hand-checked lots and checks every one against its expectation and against the API's /check.
"""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
from jsonschema import Draft202012Validator

from suplex_engine import batch
from suplex_engine.config import contracts_dir, load_config
from suplex_engine.designs import load_designs

from .real_lots import DATA_DIR, GPKG
from .test_lots import LOTS

FIXTURES = contracts_dir() / "fixtures"
SCHEMAS = contracts_dir() / "schemas"
DESIGN_ORDER = [(d.id, d.key) for d in load_designs().designs]


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def as_result(check: dict) -> SimpleNamespace:
    """A CheckResponse fixture shaped like the engine's CheckResult (the attributes lot_outcome reads)."""
    lot = check["lot"]
    designs = [SimpleNamespace(design_id=d["design_id"], result=d["result"], blocking_rule=d["blocking_rule"],
                               rules=[SimpleNamespace(rule_id=r["rule_id"], borderline=r["borderline"],
                                                      not_applicable=r["not_applicable"]) for r in d["rules"]])
               for d in check["designs"]]
    flags = [SimpleNamespace(id=f["id"]) for f in lot["flags"]]
    return SimpleNamespace(designs=designs, lot=SimpleNamespace(class_=lot["class"], flags=flags,
                                                                attached=lot["attached"], vacant=lot["vacant"]))


def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8")))


# ---------- one lot ----------

@pytest.mark.parametrize(("name", "b", "k", "f", "v"), [
    ("check.fits.json", "fits", None, [], 0),
    ("check.borderline.json", "borderline", "lot_width", [], 0),
    ("check.no_fit.json", "no_fit", "lot_width", ["vc"], 1),
    ("check.not_checked.json", "not_checked", None, [], 0),
])
def test_lot_outcome_from_the_check_fixtures(name: str, b: str, k: str | None, f: list[str], v: int) -> None:
    check = fixture(name)
    o = batch.lot_outcome(7, as_result(check), DESIGN_ORDER)
    assert (o.b, o.k, list(o.f), o.v, o.c) == (b, k, f, v, check["lot"]["class"])
    assert o.r == {key: next(d["result"] for d in check["designs"] if d["design_id"] == did) for did, key in DESIGN_ORDER}
    errors = list(validator("lot_feature.props").iter_errors(o.props()))
    assert not errors, errors[0].message


def test_best_design_ties_go_to_the_first_design_and_site_exceptions_never_reach_the_map() -> None:
    check = fixture("check.no_fit.json")
    check["lot"]["flags"] = [{"id": "heritage_district"}, {"id": "site_exception"}]
    # Make every design fail, each on a different rule: the limiting rule is Fourplex Narrow's.
    for d, rule in zip(check["designs"], ("lot_depth", "lot_width", "units_allowed", "height"), strict=True):
        d["result"], d["blocking_rule"] = "no_fit", rule
    o = batch.lot_outcome(1, as_result(check), DESIGN_ORDER)
    assert (o.b, o.k) == ("no_fit", "lot_depth")
    assert o.f == ("hd",) and o.flags == ("heritage_district", "site_exception")


def test_borderline_limiting_rule_is_the_first_borderline_row() -> None:
    rows = [SimpleNamespace(rule_id=r, borderline=r in ("lot_depth", "lot_coverage"), not_applicable=False)
            for r in batch.RULE_ORDER]
    design = SimpleNamespace(result="borderline", blocking_rule=None, rules=rows)
    assert batch.limiting_rule(design) == "lot_depth"
    assert batch.limiting_rule(SimpleNamespace(result="fits", blocking_rule=None, rules=rows)) is None


# ---------- counts and the summary ----------

def outcome(lot_id: int, c: str, b: str, k: str | None = None, flags: tuple = (), f: tuple = (), a: int = 0,
            v: int = 0) -> batch.LotOutcome:
    results = {key: "not_checked" if b == "not_checked" else "no_fit" for _, key in DESIGN_ORDER}
    results["fn"] = b
    return batch.LotOutcome(lot_id, c, b, results, k, flags, f, a, v)


OUTCOMES = [
    outcome(1, "checked", "fits", flags=("heritage_register", "site_exception"), f=("hr",)),
    outcome(2, "checked", "fits", flags=("site_exception",)),
    outcome(3, "checked", "borderline", "lot_width"),
    outcome(4, "checked", "no_fit", "lot_width", flags=("vacant",), f=("vc",), v=1),
    outcome(5, "attached", "no_fit", "detached_building", a=1),
    outcome(6, "attached", "no_fit", "detached_building", a=1),
    outcome(7, "condo", "not_checked"),
    outcome(8, "non_residential", "not_checked", flags=("ravine",), f=("rv",)),
]
PERMITS = {"rule": "A", "since_may_2023": 2, "by_kind_since_may_2023": {"multiplex": 2, "secondary_suite": 1,
           "laneway_garden": 0, "other": 0}, "by_year": {"2023": 1, "2024": 1}, "units_since_may_2023": 7,
           "source": "local"}


def test_ward_counts_and_entry() -> None:
    counts = batch.ward_counts(OUTCOMES, DESIGN_ORDER)
    entry = batch.summary_entry("04", "Parkdale-High Park", "full", len(OUTCOMES), counts, PERMITS, {"zoning": "2026-02-20"},
                                "2026-10-17T00:00:00Z")
    assert entry["classes"] == {"condo": 1, "non_residential": 1, "older_bylaw": 0, "larger_building": 0,
                                "unmeasurable": 0, "attached": 2, "checked": 4}
    assert entry["house_lots"] == 6
    assert entry["any_design"] == {"fits": 2, "borderline": 1, "no_fit": 3, "not_checked": 2}
    assert entry["top_blocking_rules"] == [{"rule_id": "detached_building", "count": 2},
                                           {"rule_id": "lot_width", "count": 1}]
    assert entry["attached_share_pct"] == 33.3
    # Flags count every lot that carries them; "need extra review" counts fitting lots with a review flag only.
    assert entry["flags"] == {"heritage_register": 1, "heritage_district": 0, "ravine": 1, "trca": 0,
                              "site_exception": 2, "vacant": 1, "any_on_fitting_lots": 1}
    assert entry["headline"] == {"could": 2, "could_pct_of_house_lots": 33.3, "did": 2, "lots_per_permit": 1}
    for counts_by_design in entry["by_design"].values():
        assert sum(counts_by_design.values()) == len(OUTCOMES)
    no_permits = dict(PERMITS, since_may_2023=0)
    entry = batch.summary_entry("04", "x", "full", 8, counts, no_permits, {}, "2026-10-17T00:00:00Z")
    assert entry["headline"]["lots_per_permit"] is None


def test_summary_file_validates_and_the_city_adds_the_unlocated_permits_only_when_complete() -> None:
    counts = batch.ward_counts(OUTCOMES, DESIGN_ORDER)
    parts = {w: {"lots_total": len(OUTCOMES), **counts} for w in ("04", "19")}
    wards = {"04": {"ward_name": "Parkdale-High Park", "sixplex_overlay": "full"},
             "19": {"ward_name": "Beaches-East York", "sixplex_overlay": "full"},
             "20": {"ward_name": "Scarborough Southwest", "sixplex_overlay": "none"}}
    unlocated = dict(PERMITS, since_may_2023=1, units_since_may_2023=3, by_year={"2025": 1})
    permits = batch.Permits("A", {w: json.loads(json.dumps(PERMITS)) for w in wards}, unlocated, PERMITS, "local", [])
    summary = batch.build_summary(parts, wards, permits, {"zoning": "2026-02-20"}, "2026-10-17T00:00:00Z")
    errors = list(validator("ward_summary.file").iter_errors(summary))
    assert not errors, errors[0].message
    city = summary["city"]
    assert (city["ward_id"], city["sixplex_overlay"], city["lots_total"]) == ("city", "full", 16)
    assert city["permits"]["since_may_2023"] == 4                     # two wards, no unlocated: ward 20 missing
    assert city["headline"]["could"] == 4

    parts["20"] = {"lots_total": len(OUTCOMES), **counts}
    summary = batch.build_summary(parts, wards, permits, {}, "2026-10-17T00:00:00Z")
    assert summary["city"]["sixplex_overlay"] == "partial"
    assert summary["city"]["permits"]["since_may_2023"] == 7         # three wards plus the one with no ward
    assert summary["city"]["permits"]["by_year"] == {"2023": 3, "2024": 3, "2025": 1}


# ---------- strips ----------

def test_strips_cover_every_lot_once_and_read_around_their_lots() -> None:
    rng = np.random.default_rng(3)
    n = 1003
    minx = rng.uniform(300_000, 305_000, n)
    miny = rng.uniform(4_830_000, 4_835_000, n)
    bounds = np.vstack([minx, miny, minx + 10, miny + 30])
    ids = list(range(5_000_000, 5_000_000 + n))
    strips = batch.plan_strips("04", ids, bounds, 250, 160.0, Path("d"), Path("g.gpkg"))
    assert len(strips) == 5 and all(len(s.lot_ids) in (200, 201) for s in strips)
    assert sorted(i for s in strips for i in s.lot_ids) == ids
    for s in strips:
        for i in s.lot_ids:
            j = i - ids[0]
            assert s.bbox[0] <= bounds[0, j] - 160 and s.bbox[2] >= bounds[2, j] + 160
            assert s.bbox[1] <= bounds[1, j] - 160 and s.bbox[3] >= bounds[3, j] + 160
    assert batch.plan_strips("04", [], np.zeros((4, 0)), 250, 160.0, Path("d"), Path("g.gpkg")) == []


# ---------- real lots: batch == /check == the hand-checked expectations ----------

def test_the_hand_checked_lots_in_one_strip_match_check_and_their_expectations() -> None:
    if not GPKG.is_file():
        pytest.skip(f"needs {GPKG}")
    ids, bounds = batch.ward_lots(GPKG, "04")
    keep = [j for j, pid in enumerate(ids) if pid in LOTS]
    if len(keep) < len(LOTS):
        pytest.skip("a hand-checked parcel is missing from the GeoPackage")
    cfg = load_config()
    strip = batch.plan_strips("04", [ids[j] for j in keep], bounds[:, keep], len(keep),
                              cfg.context_radius_m + batch.NEIGHBOUR_MARGIN_M, DATA_DIR, GPKG)[0]
    res = batch.run_strip(strip)
    assert not res.errors and len(res.outcomes) == len(LOTS) == len(res.features)

    api_store = batch._api_store().load(DATA_DIR, GPKG)
    keys = dict(DESIGN_ORDER)
    for o, feature in zip(res.outcomes, res.features, strict=True):
        exp = LOTS[o.lot_id]
        if "cls" in exp:
            assert o.c == exp["cls"], o.lot_id
        for did, result in exp.get("results", {}).items():
            assert o.r[keys[did]] == result, (o.lot_id, did)
        check = api_store.check(api_store.lot_pos(str(o.lot_id)))
        assert o.c == check["lot"]["class"] and o.v == int(check["lot"]["vacant"]), o.lot_id
        assert o.r == {keys[d["design_id"]]: d["result"] for d in check["designs"]}, o.lot_id
        doc = json.loads(feature)
        assert doc["id"] == doc["properties"]["id"] == o.lot_id
        assert doc["geometry"]["type"] in ("Polygon", "MultiPolygon")
        lon, lat = doc["geometry"]["coordinates"][0][0] if doc["geometry"]["type"] == "Polygon" else \
            doc["geometry"]["coordinates"][0][0][0]
        assert -79.7 < lon < -79.1 and 43.5 < lat < 43.9
        assert "address" not in feature and "area" not in feature
