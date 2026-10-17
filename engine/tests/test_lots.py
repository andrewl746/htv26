"""A8: hand-checked real Ward 04 lots (MASTERSPEC 5.9, 8.1).

Each lot was picked from the Ward 04 GeoPackage (release data-2026-10-17), measured independently of the
engine (minimum rotated rectangle sides, lot area, cross-sections at the 6 m setback line and across the
building band, footprint clips) and checked by eye on an ASCII plot of the parcel fabric and the massing.
The expectations below are those hand values; the engine must land within 0.3 m of them (5.9).
The list, what each lot exercises and the thresholds it set are documented in docs/test-lots.md.

Skips when data/out/suplex.gpkg is absent (teammates without the data still get a green pytest).
"""
from __future__ import annotations

import pytest

from suplex_engine.check import run_check
from suplex_engine.config import load_config
from suplex_engine.designs import load_designs

from .real_lots import lot_input

CFG, DESIGNS = load_config(), load_designs()
TOL_M = 0.3                      # MASTERSPEC 5.9: width and depth within 0.3 m of the hand measurement
TOL_DEG = 15.0                   # front bearing: the street side must be right, not the exact degree

FN, FW, SN, SW = "fourplex_narrow", "fourplex_wide", "sixplex_narrow", "sixplex_wide"

# parcelid: (what it exercises, expected class, expected result per design, hand width m, hand depth m, extra checks)
LOTS = {
    5431267: dict(name="326 Quebec Ave: clear fit on a wide, deep detached R lot (12.5 x 48.2 m)",
                  cls="checked", results={FN: "fits", FW: "fits", SN: "fits", SW: "fits"}, width=12.51, depth=48.2),
    5465380: dict(name="281 Armadale Ave: 7.45 m lot, Fourplex Narrow too close to call (needs 7.6)",
                  cls="checked", results={FN: "borderline", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=7.45, depth=41.5,
                  blocking={FW: "lot_width", SN: "lot_width", SW: "lot_width"}),
    5427581: dict(name="32 Warren Cres: a true 25-foot lot (7.62 m) in RM f12, detached house 0.17 m from its neighbour's roof",
                  cls="checked", results={FN: "borderline", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=7.62, depth=33.5),
    5458247: dict(name="135 Colbeck St: borderline depth in R (30.1 m against 30.5), detached house with a close neighbour",
                  cls="checked", results={FN: "borderline", FW: "borderline", SN: "no_fit", SW: "borderline"}, width=10.2, depth=30.15,
                  blocking={SN: "lot_depth"}),
    5456573: dict(name="20 Humberview Rd: borderline depth in RD (30.5 m against 6 + 17 + 25%)",
                  cls="checked", results={FN: "borderline", FW: "borderline", SN: "no_fit", SW: "borderline"}, width=10.65, depth=30.5),
    5422686: dict(name="34 Rexford Rd: clear fail, 6.40 m RM lot (Fourplex Narrow short by 1.5 m)",
                  cls="checked", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=6.40, depth=33.5,
                  blocking={FN: "lot_width", FW: "lot_width", SN: "lot_width", SW: "lot_width"}, fn_width_margin=-1.5),
    5496138: dict(name="43 Tyndall Ave: corner lot, the shorter street edge (8.7 m) is the front, 37.5 m deep along Tyndall",
                  cls="checked", results={FN: "fits", FW: "borderline", SN: "borderline", SW: "no_fit"}, width=8.72, depth=37.5),
    5464574: dict(name="4 Olympus Ave: pie lot, 15.6 m at the setback line tapering to 2.4 m; depth across the building fails",
                  cls="checked", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=15.6, depth=37.05,
                  blocking={FN: "lot_depth", FW: "lot_depth", SN: "lot_depth", SW: "lot_depth"}, fn_band_width=10.9),
    5424074: dict(name="15 Rexford Rd: semi, one massing polygon over two 3.66 m lots",
                  cls="attached", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=3.66, depth=33.7,
                  blocking={FN: "detached_building"}),
    5442045: dict(name="602 Indian Rd: a 3-storey house (13.4 m in the massing) is not a larger building; its party wall is "
                       "split in the massing with a 0.19 m gap, so Suplex reads it as detached (known limit, docs/test-lots.md)",
                  not_cls="larger_building", width=6.60, depth=34.1),
    5521671: dict(name="552 Beresford Ave: semi split at the party wall in the massing, the two polygons touch (shared wall rule)",
                  cls="attached", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=7.61, depth=42.5,
                  blocking={FN: "detached_building"}),
    5411260: dict(name="155 Vine Ave: row house, one 883 m2 massing polygon over 12 lots (clipped: 81 m2)",
                  cls="attached", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=5.0, depth=31.35,
                  existing_footprint_m2=80.6),
    5494876: dict(name="1 Ripley Ave: condo parcel", cls="condo", results={FN: "not_checked", FW: "not_checked", SN: "not_checked", SW: "not_checked"}),
    5442016: dict(name="405 Jane St: CR zone, not a residential house zone", cls="non_residential",
                  results={FN: "not_checked", FW: "not_checked", SN: "not_checked", SW: "not_checked"}),
    5443123: dict(name="22 Baby Point Rd: heritage register and district flags on a lot that fits (10.66 x 35.0 m, RD)",
                  cls="checked", results={FN: "fits", FW: "fits", SN: "no_fit", SW: "borderline"}, width=10.66, depth=35.0,
                  blocking={SN: "building_length"}, flags={"heritage_register", "heritage_district"}),
    5489750: dict(name="74 Elm Grove Ave: heritage register flag on a 6.86 m lot that does not fit",
                  cls="checked", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=6.86, depth=30.9,
                  flags={"heritage_register"}),
    5491389: dict(name="20 Grafton Ave: vacant 6.1 m lot (no footprint in the massing), checked normally and flagged",
                  cls="checked", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=6.09, depth=30.6,
                  flags={"vacant"}, vacant=True),
    5452627: dict(name="62 Alhambra Ave: semi with a rear lane; the front is the street (east), not the lane",
                  cls="attached", results={FN: "no_fit", FW: "no_fit", SN: "no_fit", SW: "no_fit"}, width=5.75, depth=34.45,
                  bearing=73.0),
    5476952: dict(name="219 Geoffrey St: detached house whose roof outline crosses the lot line by 6.5 m2 (eaves), not a semi",
                  cls="checked", results={FN: "fits", FW: "borderline", SN: "fits", SW: "no_fit"}, width=9.22, depth=39.2),
}


@pytest.fixture(scope="module")
def results():
    """One CheckResponse per lot; a parcel missing from a rebuilt data release skips its own tests only."""
    out = {}
    for pid in LOTS:
        try:
            out[pid] = run_check(lot_input(pid), CFG, DESIGNS).to_dict()
        except pytest.skip.Exception as e:
            out[pid] = str(e)
    return out


def _result(results, pid):
    if isinstance(results[pid], str):
        pytest.skip(results[pid])
    return results[pid]


@pytest.mark.parametrize("pid", list(LOTS))
def test_class_and_results_per_design(results, pid):
    exp, d = LOTS[pid], _result(results, pid)
    if "not_cls" in exp:
        assert d["lot"]["class"] != exp["not_cls"], exp["name"]
        return
    assert d["lot"]["class"] == exp["cls"], exp["name"]
    got = {x["design_id"]: x["result"] for x in d["designs"]}
    assert got == exp["results"], exp["name"]
    for did, rule in exp.get("blocking", {}).items():
        assert next(x for x in d["designs"] if x["design_id"] == did)["blocking_rule"] == rule, exp["name"]


@pytest.mark.parametrize("pid", [p for p, e in LOTS.items() if "width" in e])
def test_width_and_depth_match_the_hand_measurement(results, pid):
    exp, lot = LOTS[pid], _result(results, pid)["lot"]
    assert lot["width_m"] == pytest.approx(exp["width"], abs=TOL_M), exp["name"]
    assert lot["depth_m"] == pytest.approx(exp["depth"], abs=TOL_M), exp["name"]


def test_flags_vacant_and_bearing(results):
    for pid, exp in LOTS.items():
        lot = _result(results, pid)["lot"]
        ids = {f["id"] for f in lot["flags"]} - {"site_exception"}
        if "flags" in exp:
            assert ids == exp["flags"], exp["name"]
        assert lot["vacant"] is exp.get("vacant", False), exp["name"]
        if "bearing" in exp:
            diff = abs((lot["front_bearing_deg"] - exp["bearing"] + 180) % 360 - 180)
            assert diff <= TOL_DEG, f"{exp['name']}: bearing {lot['front_bearing_deg']}"


def test_specific_margins_and_areas(results):
    d = _result(results, 5422686)             # 34 Rexford Rd
    fn = next(x for x in d["designs"] if x["design_id"] == FN)
    assert next(r for r in fn["rules"] if r["rule_id"] == "lot_width")["margin"] == pytest.approx(LOTS[5422686]["fn_width_margin"], abs=0.05)
    d = _result(results, 5464574)             # 4 Olympus Ave: width measured across the band, not at the street
    fn = next(x for x in d["designs"] if x["design_id"] == FN)
    assert next(r for r in fn["rules"] if r["rule_id"] == "lot_width")["actual"] == pytest.approx(LOTS[5464574]["fn_band_width"], abs=TOL_M)
    d = _result(results, 5411260)             # 155 Vine Ave: the clipped footprint, not the 883 m2 row polygon
    assert d["lot"]["existing_building"]["footprint_m2"] == pytest.approx(LOTS[5411260]["existing_footprint_m2"], abs=2.0)


def test_depth_actual_is_never_measured_outside_the_lot(results):
    """A design wider than the lot must still report the lot's real depth, not a sample taken past the side lot line."""
    d = _result(results, 5422686)             # 6.40 m lot, Fourplex Wide is 6.64 m wide
    fw = next(x for x in d["designs"] if x["design_id"] == FW)
    row = next(r for r in fw["rules"] if r["rule_id"] == "lot_depth")
    assert row["actual"] == pytest.approx(LOTS[5422686]["depth"], abs=TOL_M)
