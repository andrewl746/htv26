"""T20: skewed lots (side lot lines leaning from the frontage normal) and the placement that follows them.

Synthetic parallelograms with the street along the south edge: the frontage is horizontal and both side lot lines
lean by the same angle, so the lot's true depth square to the street is `depth` and its true width square to its
sides is `frontage * cos(lean)`.
"""
from __future__ import annotations

import math

import pytest
from shapely.geometry import Point, Polygon, box

from suplex_engine.check import run_check
from suplex_engine.config import load_config
from suplex_engine.geometry import measure_lot

from .test_fit import OX, OY, rect_lot, results, rule

CFG = load_config()


def skewed_lot(frontage: float, depth: float, lean_deg: float, **kw):
    shift = depth * math.tan(math.radians(lean_deg))
    lot = Polygon([(OX, OY), (OX + frontage, OY), (OX + frontage + shift, OY + depth), (OX + shift, OY + depth)])
    corridor = box(OX - 30, OY - 10, OX + frontage + 30, OY)
    return rect_lot(frontage, depth, geometry=lot, corridors=[corridor],
                    address_point=Point(OX + frontage / 2, OY + 3), buildings=[], **kw)


def design(res, design_id: str):
    return next(d for d in res.designs if d.design_id == design_id)


def geometry(lot):
    return measure_lot(lot.geometry, lot.corridors, lot.address_point, [], CFG)


def test_a_skewed_lot_is_as_deep_as_it_is_square_to_the_street() -> None:
    # Square to the frontage, the centre line of a 15 degree parallelogram leaves through a side lot line at about
    # 23 m; measured along the sides the lot is its full 40 m deep.
    geo = geometry(skewed_lot(12.0, 40.0, 15.0))
    assert geo.depth_m == pytest.approx(40.0, abs=0.01)
    assert math.degrees(geo.side_lean_rad) == pytest.approx(15.0, abs=0.01)


def test_the_building_turns_to_follow_the_side_lot_lines_and_fits() -> None:
    res = run_check(skewed_lot(12.0, 40.0, 15.0), CFG)
    fn = design(res, "fourplex_narrow")
    assert fn.result == "fits" and fn.fail_slices_local == []
    # Width is square to the sides: 12 cos 15 = 11.59 m, not the 12 m along the street.
    assert rule(res, "fourplex_narrow", "lot_width").actual == pytest.approx(12.0 * math.cos(math.radians(15)), abs=0.01)
    # The long walls are parallel to the side lot lines, the front wall square to them.
    fl, fr, _rr, rl = fn.placement_local
    along = math.degrees(math.atan2(rl[0] - fl[0], rl[1] - fl[1]))
    assert along == pytest.approx(15.0, abs=0.1)
    assert math.hypot(fr[0] - fl[0], fr[1] - fl[1]) == pytest.approx(5.5, abs=0.02)
    assert math.hypot(rl[0] - fl[0], rl[1] - fl[1]) == pytest.approx(17.0, abs=0.02)


def test_the_nearer_front_corner_sits_at_the_front_setback() -> None:
    lot = skewed_lot(12.0, 40.0, 15.0)
    res = run_check(lot, CFG)
    origin_y = res.context.origin.y_2952
    for d in res.designs:
        street_y = [origin_y + y - OY for _, y in d.placement_local]   # the street is the line y = OY
        assert min(street_y) == pytest.approx(6.0, abs=0.02), d.design_id


def test_depth_on_a_skewed_lot_counts_the_turned_building() -> None:
    # A turned building reaches further back than its length: 17 cos 15 + 5.5 sin 15 = 17.85 m square to the
    # street. On a 32 m lot (6 + 17 + 8 rear in RD) the turned Fourplex Narrow leaves 32 - 6 - 17.85 = 8.15 m
    # behind it, so the depth row reads 6 + 17 + 8.15 = 31.15 m against 31 required.
    res = run_check(skewed_lot(12.0, 32.0, 15.0), CFG)
    row = rule(res, "fourplex_narrow", "lot_depth")
    reach = 17.0 * math.cos(math.radians(15)) + 5.5 * math.sin(math.radians(15))
    assert row.actual == pytest.approx(6.0 + 17.0 + 32.0 - 6.0 - reach, abs=0.02)
    assert row.required == pytest.approx(6.0 + 17.0 + 8.0, abs=0.01)


def test_a_square_lot_is_measured_as_before() -> None:
    res = run_check(rect_lot(12.0, 40.0), CFG)
    geo = geometry(rect_lot(12.0, 40.0))
    assert geo.side_lean_rad == 0.0 and geo.depth_m == pytest.approx(40.0)
    fl, fr, _rr, rl = design(res, "fourplex_narrow").placement_local
    assert fl[0] == pytest.approx(rl[0], abs=0.005) and fl[1] == pytest.approx(fr[1], abs=0.005)


def test_a_lean_under_the_threshold_stays_square_to_the_frontage() -> None:
    lean = CFG.placement.align_to_sides_deg * 0.9
    res = run_check(skewed_lot(12.0, 40.0, lean), CFG)
    fl, _fr, _rr, rl = design(res, "fourplex_narrow").placement_local
    assert fl[0] == pytest.approx(rl[0], abs=0.005)
    assert geometry(skewed_lot(12.0, 40.0, lean)).side_lean_rad == 0.0


def test_a_pie_lot_tapers_rather_than_leans() -> None:
    # Left side square to the street, right side leaning in by 16 degrees (4 Olympus Ave in docs/test-lots.md):
    # not a skew, so the building and the depth stay square to the frontage.
    lot = Polygon([(OX, OY), (OX + 17.0, OY), (OX + 17.0 - 37.0 * math.tan(math.radians(16)), OY + 37.0),
                   (OX, OY + 37.0)])
    pie = rect_lot(17.0, 37.0, geometry=lot, buildings=[])
    assert geometry(pie).side_lean_rad == 0.0
    res = run_check(pie, CFG)
    fl, _fr, _rr, rl = design(res, "fourplex_narrow").placement_local
    assert fl[0] == pytest.approx(rl[0], abs=0.005)


def test_sides_leaning_opposite_ways_do_not_turn_the_building() -> None:
    lot = Polygon([(OX, OY), (OX + 12.0, OY), (OX + 12.0 + 4.0, OY + 40.0), (OX - 4.0, OY + 40.0)])
    res = run_check(rect_lot(12.0, 40.0, geometry=lot, buildings=[]), CFG)
    fl, _fr, _rr, rl = design(res, "fourplex_narrow").placement_local
    assert fl[0] == pytest.approx(rl[0], abs=0.005)
    assert results(res)["fourplex_narrow"] == "fits"
