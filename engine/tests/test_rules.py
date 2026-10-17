"""A5 table-driven tests for suplex_engine.rules and suplex_engine.designs (MASTERSPEC 5.4, Appendix B)."""
from __future__ import annotations

import pytest

from suplex_engine.designs import load_designs, required_side_yards
from suplex_engine.rules import (
    building_length_allowed,
    coverage_allowed,
    front_setback,
    height_allowed,
    rear_setback,
    side_yard_min,
    units_allowed,
    zone_code,
)

# ---------- zone codes ----------

@pytest.mark.parametrize("zn_zone, expected", [
    ("R", "R"), ("RD", "RD"), ("RS", "RS"), ("RT", "RT"), ("RM", "RM"), (" rd ", "RD"),
    ("RA", None), ("RAC", None), ("CR", None), ("E", None), ("O", None), ("I", None), ("UT", None), (None, None), ("", None),
])
def test_zone_code_accepts_only_the_five_house_zones(zn_zone, expected):
    assert zone_code(zn_zone) == expected


# ---------- the section 5.4 table ----------
# zone, f value, lot depth, actual width -> front, rear, side, length, height(no overlay), coverage(no overlay)

TABLE = [
    # zone  f     depth  width  front rear   side  length
    ("R",   7.5,  30.0,  7.62,  6.0,  7.5,   0.9,  17.0),
    ("R",   7.5,  36.0,  9.0,   6.0,  7.5,   0.9,  19.0),    # deep lot, frontage under 10
    ("R",   12.0, 40.0,  12.2,  6.0,  7.5,   0.9,  19.0),    # deep lot, frontage 10 or more
    ("R",   12.0, 39.0,  12.2,  6.0,  7.5,   0.9,  17.0),    # 39 m is not deep enough at 12.2 m frontage
    ("RD",  7.5,  33.5,  7.62,  6.0,  8.375, 0.9,  17.0),    # 25% of 33.5 governs the rear
    ("RD",  7.5,  28.0,  7.62,  6.0,  7.5,   0.9,  17.0),    # 25% of 28 = 7.0, so 7.5 governs
    ("RD",  5.0,  30.0,  5.5,   6.0,  7.5,   0.6,  17.0),
    ("RD",  12.0, 40.0,  12.2,  6.0,  10.0,  1.2,  19.0),
    ("RD",  15.0, 36.0,  9.5,   6.0,  9.0,   1.5,  19.0),    # frontage 9.5 under 10 with depth 36
    ("RD",  18.0, 50.0,  18.0,  6.0,  12.5,  1.8,  19.0),
    ("RD",  24.0, 30.0,  24.0,  6.0,  7.5,   2.4,  17.0),
    ("RD",  30.0, 30.0,  30.0,  6.0,  7.5,   3.0,  17.0),
    ("RS",  7.5,  33.5,  7.62,  6.0,  8.375, 0.9,  17.0),
    ("RS",  12.0, 40.0,  12.2,  6.0,  10.0,  1.2,  19.0),
    ("RS",  15.0, 30.0,  15.0,  6.0,  7.5,   1.5,  17.0),
    ("RS",  30.0, 30.0,  30.0,  6.0,  7.5,   1.5,  17.0),    # RS caps at 1.5 (no 1.8/2.4/3.0 brackets)
    ("RT",  7.5,  33.5,  7.62,  6.0,  7.5,   0.9,  None),    # RT: rear 7.5 flat, no houseplex length rule
    ("RM",  7.5,  33.5,  7.62,  6.0,  8.375, 1.2,  17.0),    # RM: 1.2 m side, 17.0 m always
    ("RM",  12.0, 40.0,  12.2,  6.0,  10.0,  1.2,  17.0),
]


@pytest.mark.parametrize("zone, f, depth, width, front, rear, side, length", TABLE)
def test_required_values_match_section_5_4(zone, f, depth, width, front, rear, side, length):
    assert front_setback(zone).value == pytest.approx(front)
    assert rear_setback(zone, depth).value == pytest.approx(rear)
    assert side_yard_min(zone, f, width).value == pytest.approx(side)
    length_req = building_length_allowed(zone, frontage_m=width, depth_m=depth)
    if length is None:
        assert length_req.not_applicable and length_req.value is None
    else:
        assert not length_req.not_applicable and length_req.value == pytest.approx(length)
    assert height_allowed(zone, None).value == pytest.approx(10.0)
    assert coverage_allowed(zone, None).not_applicable


def test_rt_building_length_is_not_applicable_but_still_cites_its_section():
    req = building_length_allowed("RT", frontage_m=12.2, depth_m=40.0)
    assert req.not_applicable
    assert req.bylaw_section.startswith("10.60.40.20")


def test_rd_frontage_minus_one_falls_back_to_the_actual_width_bracket():
    req = side_yard_min("RD", -1, 13.0)
    assert req.value == pytest.approx(1.2)
    assert "actual" in (req.detail or "").lower()
    req = side_yard_min("RD", None, 7.62)
    assert req.value == pytest.approx(0.9)


def test_rs_frontage_minus_one_falls_back_to_the_actual_width_bracket():
    assert side_yard_min("RS", -1, 16.0).value == pytest.approx(1.5)


def test_every_requirement_carries_a_bylaw_section_string():
    for zone, ch in [("R", "10.10"), ("RD", "10.20"), ("RS", "10.40"), ("RT", "10.60"), ("RM", "10.80")]:
        assert front_setback(zone).bylaw_section == f"{ch}.40.70(1)"
        assert rear_setback(zone, 30.0).bylaw_section == f"{ch}.40.70(2)"
        assert side_yard_min(zone, 7.5, 7.62).bylaw_section.startswith(f"{ch}.40.70(3)")
        assert building_length_allowed(zone, 7.62, 30.0).bylaw_section.startswith(f"{ch}.40.20")
        assert height_allowed(zone, None).bylaw_section == f"{ch}.40.10(1)(C)"
        assert coverage_allowed(zone, 35).bylaw_section == f"{ch}.30.40(1)(D)"


def test_rear_setback_detail_explains_the_25_percent_rule():
    req = rear_setback("RD", 33.5)
    assert req.detail == "25% of 33.5 m"
    assert rear_setback("RD", 28.0).detail is None
    assert rear_setback("RT", 60.0).value == pytest.approx(7.5)


def test_deep_lot_length_cites_subsection_3_in_rd():
    assert building_length_allowed("RD", 9.0, 36.0).bylaw_section == "10.20.40.20(3)"
    assert building_length_allowed("RD", 9.0, 35.9).bylaw_section == "10.20.40.20(1)"
    assert building_length_allowed("RD", 10.0, 36.0).value == pytest.approx(17.0)     # frontage 10 needs 40 m


# ---------- overlays ----------

def test_height_is_the_greater_of_the_overlay_and_10_m():
    assert height_allowed("RD", 9.0).value == pytest.approx(10.0)
    assert height_allowed("RD", 12.0).value == pytest.approx(12.0)
    assert height_allowed("RD", None).value == pytest.approx(10.0)


def test_coverage_is_the_greater_of_the_overlay_and_45_or_not_applicable():
    req = coverage_allowed("RD", 35)
    assert req.value == pytest.approx(45.0)
    assert "45%" in (req.detail or "")
    assert coverage_allowed("RD", 50).value == pytest.approx(50.0)
    assert coverage_allowed("RD", None).not_applicable


def test_units_allowed_is_6_in_the_overlay_and_4_outside():
    inside = units_allowed(True)
    outside = units_allowed(False)
    assert inside.value == 6 and outside.value == 4
    assert inside.bylaw_section == "600.60.40(1)"
    assert inside.detail == "inside the sixplex overlay"
    assert outside.detail == "outside the sixplex overlay"


# ---------- designs ----------

def test_designs_load_from_the_contract():
    designs = load_designs()
    assert [d.id for d in designs.designs] == ["fourplex_narrow", "fourplex_wide", "sixplex_narrow", "sixplex_wide"]
    assert designs.version == "2026-10-17"
    fn = designs.by_id["fourplex_narrow"]
    assert fn.width_m == pytest.approx(5.5) and fn.length_m == pytest.approx(17.0)
    assert fn.side_yards_m == (1.2, 0.9)
    assert fn.where_allowed == "all_residential"
    assert designs.by_id["sixplex_narrow"].length_m == pytest.approx(19.0)
    assert designs.by_id["sixplex_wide"].where_allowed == "sixplex_overlay"


def test_required_side_yards_take_the_larger_of_design_and_zone():
    fn = load_designs().by_id["fourplex_narrow"]
    assert required_side_yards(fn, 0.9) == pytest.approx((1.2, 0.9))
    assert required_side_yards(fn, 1.2) == pytest.approx((1.2, 1.2))
    assert required_side_yards(fn, 0.6) == pytest.approx((1.2, 0.9))
    assert required_side_yards(fn, 3.0) == pytest.approx((3.0, 3.0))
