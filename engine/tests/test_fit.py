"""A6 tests: classification, attached check, fit test and placement (MASTERSPEC 5.3, 5.5, 5.7, 8.1).

The fixture tests rebuild each /contracts/fixtures/check.*.json lot from its local polygon and
origin, run the engine, and compare every rule row and polygon.
"""
from __future__ import annotations

import json

import pytest
from shapely.geometry import MultiPolygon, Point, Polygon, box

from suplex_engine.attached import is_attached
from suplex_engine.check import run_check
from suplex_engine.classify import review_flags
from suplex_engine.config import contracts_dir, load_config
from suplex_engine.models import BuildingInput, LotInput, NeighbourLot

CFG = load_config()
FIXTURES = contracts_dir() / "fixtures"
RULE_ORDER = ["detached_building", "units_allowed", "lot_width", "lot_depth", "building_length", "height", "lot_coverage"]
DESIGN_ORDER = ["fourplex_narrow", "fourplex_wide", "sixplex_narrow", "sixplex_wide"]

# World origin for synthetic lots (EPSG:2952 metres, somewhere in Toronto).
OX, OY = 311000.0, 4834000.0


def rect_lot(width: float, depth: float, **kw) -> LotInput:
    """A width x depth rectangle with the street along its south edge, zoned RD unless overridden."""
    lot = box(OX, OY, OX + width, OY + depth)
    corridor = box(OX - 20, OY - 10, OX + width + 20, OY)
    fields = dict(
        lot_id="t-1", geometry=lot, feature_type="COMMON", ward_id="04", ward_name="Parkdale-High Park",
        zn_zone="RD", zn_string="RD (f7.5; a230)", gen_zone=0, zbl_sectn="10.20", zn_status=0,
        frontage_min_m=7.5, units_max=None, ht_overlay_m=None, coverage_overlay_pct=None,
        zn_exception="N", exception_no=None, sixplex_overlay=True,
        corridors=[corridor], address_point=Point(OX + width / 2, OY + 3),
        buildings=[BuildingInput(building_id=1, geometry=box(OX + 1, OY + 8, OX + width - 1, OY + 18), avg_height_m=7.0,
                                 parcelid="t-1")],
    )
    fields.update(kw)
    return LotInput(**fields)


def results(res) -> dict[str, str]:
    return {d.design_id: d.result for d in res.designs}


def rule(res, design_id: str, rule_id: str):
    d = next(d for d in res.designs if d.design_id == design_id)
    return next(r for r in d.rules if r.rule_id == rule_id)


# ---------- the band ----------

def test_width_margin_inside_the_band_is_borderline_and_outside_is_fits():
    # Fourplex Narrow in RD f7.5 needs 5.5 + 1.2 + 0.9 = 7.6 m.
    inside = run_check(rect_lot(7.6 + 0.49, 40.0), CFG)
    outside = run_check(rect_lot(7.6 + 0.51, 40.0), CFG)
    assert results(inside)["fourplex_narrow"] == "borderline"
    assert results(outside)["fourplex_narrow"] == "fits"
    assert rule(inside, "fourplex_narrow", "lot_width").margin == pytest.approx(0.49, abs=0.005)
    assert rule(inside, "fourplex_narrow", "lot_width").borderline is True
    assert rule(outside, "fourplex_narrow", "lot_width").borderline is False
    assert inside.designs[0].blocking_rule is None


def test_width_failing_by_less_than_the_band_is_still_borderline():
    res = run_check(rect_lot(7.6 - 0.3, 40.0), CFG)
    assert results(res)["fourplex_narrow"] == "borderline"
    row = rule(res, "fourplex_narrow", "lot_width")
    assert row.pass_ is False and row.borderline is True


def test_width_failing_by_more_than_the_band_is_no_fit_with_the_blocking_rule():
    res = run_check(rect_lot(6.1, 40.0), CFG)
    d = res.designs[0]
    assert d.result == "no_fit" and d.blocking_rule == "lot_width"
    assert len(d.rules) == 7 and [r.rule_id for r in d.rules] == RULE_ORDER


def test_depth_band_applies_too():
    # RD, 8.0 m wide: rear = max(7.5, 25% depth). At depth 31.0 the rear is 7.75 -> required 30.75, margin 0.25.
    res = run_check(rect_lot(8.0, 31.0), CFG)
    row = rule(res, "fourplex_narrow", "lot_depth")
    assert row.required == pytest.approx(30.75, abs=0.01) and row.margin == pytest.approx(0.25, abs=0.01)
    assert results(res)["fourplex_narrow"] == "borderline"


def test_coverage_band_is_two_percentage_points():
    # Fourplex Narrow 94.7 m2 on a lot with a 45% allowance: borderline when coverage is within 2 pp of 45.
    # area for 44% = 215.2 m2 -> 8.0 x 26.9; keep depth passing by using the R zone (rear 7.5): 6 + 17 + 7.5 = 30.5 > 26.9,
    # so use width to set the area instead: 94.7 / 0.44 = 215.2 = 5.38 x 40 fails width. Use RT with overlay 35 -> 45 floor.
    lot = rect_lot(9.0, 40.0, coverage_overlay_pct=35)          # 360 m2 -> 26.3% : clean pass
    res = run_check(lot, CFG)
    assert rule(res, "fourplex_narrow", "lot_coverage").borderline is False
    big = rect_lot(14.0, 40.0, coverage_overlay_pct=35)           # Sixplex Wide 137.6 / 560 = 24.6%
    assert rule(run_check(big, CFG), "sixplex_wide", "lot_coverage").margin == pytest.approx(45 - 24.6, abs=0.1)
    tight = rect_lot(7.9, 40.0, coverage_overlay_pct=35)          # 316 m2: 94.7 / 316 = 30.0% ; still clean
    assert rule(run_check(tight, CFG), "fourplex_narrow", "lot_coverage").pass_ is True
    # Direct band check on a lot whose area puts the Sixplex Wide at 43.5%: 137.6 / 0.435 = 316.3 m2 = 10.5 x 30.12.
    edge = rect_lot(10.5, 30.12, zn_zone="RT", zbl_sectn="10.60", coverage_overlay_pct=35)   # RT rear 7.5 -> depth 30.5 needed
    row = rule(run_check(edge, CFG), "sixplex_wide", "lot_coverage")
    assert row.actual == pytest.approx(43.5, abs=0.1) and row.borderline is True


def test_non_geometric_rules_compare_exactly():
    res = run_check(rect_lot(12.0, 40.0), CFG)
    h = rule(res, "fourplex_narrow", "height")
    assert h.margin == 0.0 and h.pass_ is True and h.borderline is False
    bl = rule(res, "fourplex_narrow", "building_length")
    assert bl.borderline is False


# ---------- units, overlay, length ----------

def test_sixplex_outside_the_overlay_fails_on_units_allowed():
    res = run_check(rect_lot(14.0, 45.0, sixplex_overlay=False), CFG)
    r = results(res)
    assert r["fourplex_narrow"] == "fits" and r["fourplex_wide"] == "fits"
    assert r["sixplex_narrow"] == "no_fit" and r["sixplex_wide"] == "no_fit"
    for d in ("sixplex_narrow", "sixplex_wide"):
        assert next(x for x in res.designs if x.design_id == d).blocking_rule == "units_allowed"
        row = rule(res, d, "units_allowed")
        assert row.required == 6 and row.actual == 4 and row.margin == -2 and row.pass_ is False


def test_sixplex_narrow_needs_the_deep_lot_test_for_its_19_m_length():
    shallow = run_check(rect_lot(12.0, 39.0), CFG)        # frontage >= 10 needs 40 m
    deep = run_check(rect_lot(12.0, 40.0), CFG)
    row = rule(shallow, "sixplex_narrow", "building_length")
    assert row.required == 17.0 and row.actual == 19.0 and row.margin == -2.0 and row.pass_ is False
    assert results(shallow)["sixplex_narrow"] == "no_fit"
    assert next(d for d in shallow.designs if d.design_id == "sixplex_narrow").blocking_rule == "building_length"
    assert rule(deep, "sixplex_narrow", "building_length").required == 19.0
    assert results(deep)["sixplex_narrow"] == "fits"


def test_rt_length_rule_is_not_applicable_and_does_not_block():
    res = run_check(rect_lot(12.0, 35.0, zn_zone="RT", zbl_sectn="10.60"), CFG)
    row = rule(res, "sixplex_narrow", "building_length")
    assert row.not_applicable is True and row.pass_ is None and row.margin is None
    assert results(res)["sixplex_narrow"] == "fits"


def test_every_rule_row_carries_a_bylaw_section():
    res = run_check(rect_lot(12.0, 40.0), CFG)
    for d in res.designs:
        for r in d.rules:
            assert r.bylaw_section and r.bylaw_section[0].isdigit()


# ---------- classification ----------

def test_condo_is_not_checked_with_empty_rules():
    res = run_check(rect_lot(12.0, 40.0, feature_type="CONDO"), CFG)
    assert res.lot.class_ == "condo" and res.lot.reason.id == "condo"
    assert all(d.result == "not_checked" and d.rules == [] and d.placement_local is None for d in res.designs)
    assert res.lot.width_m is None and res.lot.depth_m is None


@pytest.mark.parametrize("zone", ["RA", "RAC", "CR", "E", "O", "I", "UT"])
def test_other_zones_are_non_residential(zone):
    res = run_check(rect_lot(12.0, 40.0, zn_zone=zone), CFG)
    assert res.lot.class_ == "non_residential"


def test_no_zone_or_status_5_is_older_bylaw():
    assert run_check(rect_lot(12.0, 40.0, zn_zone=None, zn_status=5), CFG).lot.class_ == "older_bylaw"
    assert run_check(rect_lot(12.0, 40.0, zn_status=5), CFG).lot.class_ == "older_bylaw"


def test_larger_building_by_height_footprint_or_address_count():
    over = CFG.larger_building.avg_height_m + 0.5
    tall = rect_lot(12.0, 40.0, buildings=[BuildingInput(1, box(OX + 1, OY + 8, OX + 11, OY + 18), over, parcelid="t-1")])
    assert run_check(tall, CFG).lot.class_ == "larger_building"
    house = rect_lot(12.0, 40.0, buildings=[BuildingInput(1, box(OX + 1, OY + 8, OX + 11, OY + 18), 13.4, parcelid="t-1")])
    assert run_check(house, CFG).lot.class_ == "checked"             # a 3-storey house (602 Indian Rd is 13.4 m) is not a larger building
    wide = rect_lot(30.0, 40.0, buildings=[BuildingInput(1, box(OX + 1, OY + 8, OX + 29, OY + 21), 8.0, parcelid="t-1")])
    assert run_check(wide, CFG).lot.class_ == "larger_building"       # 28 x 13 = 364 m2
    many = rect_lot(12.0, 40.0, address_count=4)
    assert run_check(many, CFG).lot.class_ == "larger_building"
    assert run_check(rect_lot(12.0, 40.0, address_count=3), CFG).lot.class_ == "checked"


def test_multipolygon_is_unmeasurable():
    lot = MultiPolygon([box(OX, OY, OX + 8, OY + 20), box(OX, OY + 25, OX + 8, OY + 40)])
    res = run_check(rect_lot(8.0, 40.0, geometry=lot), CFG)
    assert res.lot.class_ == "unmeasurable" and res.lot.reason.id == "unmeasurable"


def test_classification_order_condo_before_zone_before_building():
    res = run_check(rect_lot(12.0, 40.0, feature_type="CONDO", zn_zone="CR", address_count=9), CFG)
    assert res.lot.class_ == "condo"
    res = run_check(rect_lot(12.0, 40.0, zn_zone="CR", address_count=9), CFG)
    assert res.lot.class_ == "non_residential"


def test_attached_lot_is_no_fit_on_detached_building_but_still_measured():
    # A semi: the house footprint crosses the west lot line into the neighbour's COMMON lot by 30 m2 (over cross_lot_m2).
    house = BuildingInput(1, box(OX - 3.0, OY + 8, OX + 6.0, OY + 18), 7.0, parcelid="t-1")
    neighbour = NeighbourLot("t-0", box(OX - 7.62, OY, OX, OY + 40), "COMMON")
    res = run_check(rect_lot(7.62, 40.0, buildings=[house], neighbour_lots=[neighbour]), CFG)
    assert res.lot.class_ == "attached" and res.lot.attached is True
    for d in res.designs:
        assert d.result == "no_fit" and d.blocking_rule == "detached_building"
        assert len(d.rules) == 7
    row = rule(res, "fourplex_narrow", "detached_building")
    assert row.actual == "attached" and row.pass_ is False and row.margin is None
    assert res.lot.width_m == pytest.approx(7.62, abs=0.01)


def test_vacant_lot_is_checked_normally_and_flagged():
    res = run_check(rect_lot(12.0, 40.0, buildings=[]), CFG)
    assert res.lot.class_ == "checked" and res.lot.vacant is True
    assert "vacant" in [f.id for f in res.lot.flags]
    assert rule(res, "fourplex_narrow", "detached_building").actual == "vacant"
    assert results(res)["fourplex_narrow"] == "fits"
    assert res.lot.existing_building is None


# ---------- footprints clipped to the lot (MASTERSPEC section 0 item 6) ----------

ROW_LOT_W = 6.1


def _row_house_lot() -> LotInput:
    """The middle of 8 row lots of 6.1 m, under one 3D Massing polygon that covers the whole row (about 470 m2)."""
    row = BuildingInput(7, box(OX - 3 * ROW_LOT_W + 1, OY + 8, OX + 5 * ROW_LOT_W - 1, OY + 18), 8.0, parcelid="t-0")
    west = NeighbourLot("t-0", box(OX - ROW_LOT_W, OY, OX, OY + 40), "COMMON")
    east = NeighbourLot("t-2", box(OX + ROW_LOT_W, OY, OX + 2 * ROW_LOT_W, OY + 40), "COMMON")
    return rect_lot(ROW_LOT_W, 40.0, buildings=[row], neighbour_lots=[west, east])


def test_a_row_polygon_is_clipped_to_the_lot_and_reads_as_attached_not_larger():
    lot = _row_house_lot()
    assert lot.buildings[0].area_m2 > CFG.larger_building.footprint_m2        # the merged row polygon
    clipped_m2 = ROW_LOT_W * 10.0
    res = run_check(lot, CFG)
    assert res.lot.class_ == "attached" and res.lot.attached is True
    ex = res.lot.existing_building
    assert ex.building_id == 7 and ex.footprint_m2 == pytest.approx(clipped_m2, abs=0.5)
    lot_ring = Polygon(res.lot.polygon_local).buffer(0.01)
    assert all(lot_ring.covers(Point(p)) for p in ex.footprint_local)
    on = [b for b in res.context.buildings if b.on_lot]
    off = [b for b in res.context.buildings if not b.on_lot]
    assert len(on) == 1 and on[0].building_id == 7
    assert Polygon(on[0].footprint_local).area == pytest.approx(clipped_m2, abs=0.5)
    assert len(off) == 2 and {b.building_id for b in off} == {7}
    assert {(b.avg_height_m, b.kind) for b in res.context.buildings} == {(8.0, "house")}


def test_a_footprint_grazing_the_lot_under_the_vacant_threshold_leaves_it_vacant():
    graze = box(OX - 5.0, OY + 8, OX + 1.0, OY + 14)                         # 1 m x 6 m = 6 m2 on the lot
    lot = rect_lot(12.0, 40.0, buildings=[BuildingInput(9, graze, 7.0, parcelid="t-1")])
    assert graze.intersection(lot.geometry).area < CFG.vacant_min_footprint_m2
    res = run_check(lot, CFG)
    assert res.lot.vacant is True and res.lot.existing_building is None
    assert "vacant" in [f.id for f in res.lot.flags]
    [b] = res.context.buildings
    assert b.building_id == 9 and b.on_lot is False
    assert Polygon(b.footprint_local).area == pytest.approx(graze.area, abs=0.05)


def test_flags_come_from_the_lot_row_and_never_change_the_result():
    plain = run_check(rect_lot(12.0, 40.0), CFG)
    flagged = run_check(rect_lot(12.0, 40.0, flag_heritage_register=True, flag_ravine=True, flag_trca=True,
                                 flag_heritage_district=True, zn_exception="Y", exception_no=123), CFG)
    assert [f.id for f in flagged.lot.flags] == ["heritage_register", "heritage_district", "ravine", "trca", "site_exception"]
    ex = next(f for f in flagged.lot.flags if f.id == "site_exception")
    assert "123" in ex.detail
    assert results(flagged) == results(plain)
    assert all(f.label and f.text for f in flagged.lot.flags)


def test_site_exception_flag_names_the_exception_and_is_informational():
    plain = run_check(rect_lot(12.0, 40.0), CFG)
    res = run_check(rect_lot(12.0, 40.0, zn_exception="Y", exception_no=1234, flag_heritage_register=True), CFG)
    ex = next(f for f in res.lot.flags if f.id == "site_exception")
    assert ex.text == "This zone has a site-specific exception (x1234), which Suplex does not read."
    assert ex.detail == "x1234"
    assert [f.id for f in res.lot.flags] == ["heritage_register", "site_exception"]
    assert [f.id for f in review_flags(res.lot.flags)] == ["heritage_register"]
    assert results(res) == results(plain)


def test_site_exception_without_a_number_uses_the_plain_sentence():
    res = run_check(rect_lot(12.0, 40.0, zn_exception="Y", exception_no=None), CFG)
    [ex] = [f for f in res.lot.flags if f.id == "site_exception"]
    assert ex.text == "This zone has a site-specific exception, which Suplex does not read."
    assert ex.detail is None
    assert review_flags(res.lot.flags) == []


# ---------- placement ----------

def test_placement_sits_at_the_front_setback_centred_between_the_yards():
    res = run_check(rect_lot(7.62, 33.5), CFG)
    d = res.designs[0]                                   # fourplex_narrow: yards 1.2 (left) and 0.9 (right)
    xs = sorted({x for x, _ in d.placement_local})
    ys = sorted({y for _, y in d.placement_local})
    assert xs == pytest.approx([-2.6, 2.9], abs=0.01)
    assert ys == pytest.approx([-10.75, 6.25], abs=0.01)
    assert d.placement_local[0][1] == pytest.approx(-10.75, abs=0.01)      # front wall first
    assert d.fail_slices_local == []
    assert sorted({y for _, y in d.buildable_local}) == pytest.approx([-10.75, 8.375], abs=0.01)
    assert set(d.setbacks_local) == {"front", "rear", "left", "right"}


def test_too_wide_design_has_fail_slices_on_both_sides():
    res = run_check(rect_lot(7.62, 33.5), CFG)
    fw = next(d for d in res.designs if d.design_id == "fourplex_wide")
    assert len(fw.fail_slices_local) == 2
    xs = sorted({round(x, 2) for poly in fw.fail_slices_local for x, _ in poly})
    assert xs[0] == pytest.approx(-3.32, abs=0.01) and xs[-1] == pytest.approx(3.32, abs=0.01)


# ---------- the response ----------

def test_response_has_local_frame_context_and_disclaimer():
    tree = Point(OX + 3, OY - 2)
    big = BuildingInput(2, box(OX + 30, OY + 30, OX + 50, OY + 50), 20.0, parcelid="x")
    far = BuildingInput(3, box(OX + 400, OY, OX + 410, OY + 10), 5.0, parcelid="y")
    lot = rect_lot(12.0, 40.0, trees=[tree], permit_points=[Point(OX + 100, OY + 100), Point(OX + 900, OY)])
    lot.buildings = lot.buildings + [big, far]
    res = run_check(lot, CFG, data_dates={"zoning": "2026-02-20"})
    assert res.lot.front_bearing_deg == pytest.approx(180.0, abs=0.5)
    ring = res.lot.polygon_local
    assert ring[0] == ring[-1] and len(ring) == 5                        # closed ring, like the fixture
    assert {(round(x), round(y)) for x, y in ring} == {(-6, -20), (6, -20), (6, 20), (-6, 20)}
    assert res.lot.polygon_wgs84 and -80 < res.lot.polygon_wgs84[0][0] < -79 and 43 < res.lot.polygon_wgs84[0][1] < 44
    kinds = {b.building_id: (b.kind, b.on_lot) for b in res.context.buildings}
    assert kinds[1] == ("house", True) and kinds[2] == ("large", False) and 3 not in kinds
    assert res.context.trees == [pytest.approx((-3.0, -22.0), abs=0.01)]
    assert res.permits_nearby.count == 1 and res.permits_nearby.radius_m == CFG.nearby_permits_radius_m
    assert res.meta.disclaimer == "Screening only, not a permit or legal advice."
    assert res.meta.data_dates == {"zoning": "2026-02-20"}
    assert res.not_checked[0].startswith("Site-specific exceptions")
    d = res.to_dict()
    assert d["lot"]["class"] == "checked" and d["designs"][0]["rules"][0]["pass"] is True


def test_response_validates_against_the_check_schema():
    jsonschema = pytest.importorskip("jsonschema")
    schema_path = contracts_dir() / "schemas" / "check.response.schema.json"
    if not schema_path.exists():
        pytest.skip("check.response schema not written yet")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    for lot in (rect_lot(12.0, 40.0), rect_lot(7.62, 33.5), rect_lot(12.0, 40.0, feature_type="CONDO")):
        d = run_check(lot, CFG, data_dates={"zoning": "2026-02-20"}).to_dict()
        jsonschema.Draft202012Validator(schema).validate(d)


# ---------- attached.py ----------

def _lot_and_neighbour(gap_m: float):
    lot = box(OX, OY, OX + 7.62, OY + 40)
    neighbour = NeighbourLot("n", box(OX - 7.62, OY, OX, OY + 40), "COMMON")
    house = box(OX + 0.1 + gap_m / 2, OY + 8, OX + 6.5, OY + 19)
    other = box(OX - 6.5, OY + 8, OX - gap_m / 2 - 0.1, OY + 19)
    return lot, [neighbour], house, other


def test_semi_footprint_crossing_the_lot_line_is_attached():
    lot = box(OX, OY, OX + 7.62, OY + 40)
    neighbour = NeighbourLot("n", box(OX - 7.62, OY, OX, OY + 40), "COMMON")
    footprint = box(OX - 3.0, OY + 8, OX + 6.5, OY + 19)        # 33 m2 over the line, over cross_lot_m2 (20)
    assert is_attached(lot, [neighbour], [footprint], CFG) is True


def test_row_house_touching_along_a_shared_wall_is_attached():
    lot, neighbours, house, _ = _lot_and_neighbour(0.0)
    other = box(OX - 6.5, OY + 8, OX + 0.1, OY + 19)              # touches the house along 11 m
    assert is_attached(lot, neighbours, [house, other], CFG) is True


def test_detached_house_with_a_close_neighbour_is_not_attached():
    lot, neighbours, house, other = _lot_and_neighbour(1.0)       # 1 m gap, wider than the tolerance
    assert is_attached(lot, neighbours, [house, other], CFG) is False
    # Two roof outlines 0.2 m apart (eaves of detached houses 1.2 m apart) are not a shared wall either.
    lot, neighbours, house, other = _lot_and_neighbour(0.2)
    assert is_attached(lot, neighbours, [house, other], CFG) is False


def test_small_crossing_under_the_threshold_is_not_attached():
    lot = box(OX, OY, OX + 7.62, OY + 40)
    neighbour = NeighbourLot("n", box(OX - 7.62, OY, OX, OY + 40), "COMMON")
    footprint = box(OX - 0.5, OY + 8, OX + 6.5, OY + 19)         # 5.5 m2 over the line: eaves, under cross_lot_m2
    assert is_attached(lot, [neighbour], [footprint], CFG) is False


def test_crossing_into_a_condo_parcel_does_not_count_as_attached():
    lot = box(OX, OY, OX + 7.62, OY + 40)
    neighbour = NeighbourLot("n", box(OX - 7.62, OY, OX, OY + 40), "CONDO")
    footprint = box(OX - 1.0, OY + 8, OX + 6.5, OY + 19)
    assert is_attached(lot, [neighbour], [footprint], CFG) is False


# ---------- the fixtures ----------

def _fixture_lot(fx: dict) -> LotInput:
    lot = fx["lot"]
    ox, oy = fx["context"]["origin"]["x_2952"], fx["context"]["origin"]["y_2952"]
    world = lambda pts: [(ox + x, oy + y) for x, y in pts]
    geom = Polygon(world(lot["polygon_local"]))
    (fx1, fy1), (fx2, fy2) = lot["frontage_edge_local"] or ([-1, -1], [1, -1])
    # A corridor parcel just outside the frontage edge: a strip 10 m deep on the street side.
    minx, maxx = min(fx1, fx2) - 5, max(fx1, fx2) + 5
    corridor = Polygon(world([(minx, fy1 - 10), (maxx, fy1 - 10), (maxx, fy1), (minx, fy1)]))
    z = lot["zone"]
    buildings = [BuildingInput(b["building_id"], Polygon(world(b["footprint_local"])), b["avg_height_m"],
                               parcelid=lot["lot_id"] if b["on_lot"] else f"other-{b['building_id']}")
                 for b in fx["context"]["buildings"]]
    feature_type = "CONDO" if lot["class"] == "condo" else "COMMON"
    return LotInput(
        lot_id=lot["lot_id"], geometry=geom, feature_type=feature_type, stated_area=lot["stated_area"],
        ward_id=lot["ward_id"], ward_name=lot["ward_name"],
        zn_zone=z["zn_zone"], zn_string=z["zn_string"], gen_zone=z["gen_zone"], zbl_sectn=z["zbl_sectn"],
        zn_status=z["zn_status"], frontage_min_m=z["frontage_min_m"], units_max=z["units_max"],
        ht_overlay_m=z["ht_overlay_m"], coverage_overlay_pct=z["coverage_overlay_pct"],
        zn_exception="Y" if z["exception_no"] is not None else "N", exception_no=z["exception_no"],
        sixplex_overlay=z["sixplex_overlay"], corridors=[corridor], buildings=buildings,
        trees=[Point(ox + x, oy + y) for x, y in fx["context"]["trees"]],
        permit_points=[Point(ox + x, oy + y) for x, y in fx["permits_nearby"]["points_local"]],
        address_id=fx["address"]["address_id"], address_full=fx["address"]["address_full"],
        address_point=Point(ox, oy),
    )


def _poly(pts) -> Polygon:
    return Polygon(pts)


def _same_polygon(a, b, tol_area=0.05) -> bool:
    return _poly(a).symmetric_difference(_poly(b)).area < tol_area


FIXTURE_FILES = ["check.fits.json", "check.borderline.json", "check.no_fit.json", "check.not_checked.json"]


@pytest.mark.parametrize("name", FIXTURE_FILES)
def test_fixture_lots_reproduce_their_fixture(name):
    path = FIXTURES / name
    if not path.exists():
        pytest.skip(f"{name} not written yet")
    fx = json.loads(path.read_text(encoding="utf-8"))
    res = run_check(_fixture_lot(fx), CFG, data_dates=fx["meta"]["data_dates"]).to_dict()

    assert res["lot"]["class"] == fx["lot"]["class"]
    if fx["lot"]["reason"] is None:
        assert res["lot"]["reason"] is None
    else:
        assert res["lot"]["reason"]["id"] == fx["lot"]["reason"]["id"]
    for key in ("width_m", "depth_m"):
        if fx["lot"][key] is None:
            assert res["lot"][key] is None
        else:
            assert res["lot"][key] == pytest.approx(fx["lot"][key], abs=0.01), key
    assert res["lot"]["area_m2"] == pytest.approx(fx["lot"]["area_m2"], abs=0.05)
    assert res["lot"]["attached"] == fx["lot"]["attached"] and res["lot"]["vacant"] == fx["lot"]["vacant"]
    assert [f["id"] for f in res["lot"]["flags"]] == [f["id"] for f in fx["lot"]["flags"]]
    if fx["lot"]["front_bearing_deg"] is not None:
        assert res["lot"]["front_bearing_deg"] == pytest.approx(fx["lot"]["front_bearing_deg"], abs=0.5)

    assert [d["design_id"] for d in res["designs"]] == [d["design_id"] for d in fx["designs"]] == DESIGN_ORDER
    for got, want in zip(res["designs"], fx["designs"]):
        did = want["design_id"]
        assert got["result"] == want["result"], did
        assert got["blocking_rule"] == want["blocking_rule"], did
        assert [r["rule_id"] for r in got["rules"]] == [r["rule_id"] for r in want["rules"]], did
        for g, w in zip(got["rules"], want["rules"]):
            rid = f"{did}.{w['rule_id']}"
            for k in ("pass", "borderline", "not_applicable", "unit", "bylaw_section", "label"):
                assert g[k] == w[k], f"{rid}.{k}: {g[k]!r} != {w[k]!r}"
            for k in ("required", "actual", "margin"):
                if isinstance(w[k], (int, float)) and not isinstance(w[k], bool):
                    assert g[k] == pytest.approx(w[k], abs=0.011), f"{rid}.{k}: {g[k]!r} != {w[k]!r}"
                else:
                    assert g[k] == w[k], f"{rid}.{k}: {g[k]!r} != {w[k]!r}"
        for k in ("placement_local", "buildable_local"):
            if want[k] is None:
                assert got[k] is None, f"{did}.{k}"
            else:
                assert _same_polygon(got[k], want[k]), f"{did}.{k}: {got[k]} != {want[k]}"
        if want["setbacks_local"] is None:
            assert got["setbacks_local"] is None
        else:
            for side in ("front", "rear", "left", "right"):
                assert _same_polygon(got["setbacks_local"][side], want["setbacks_local"][side]), f"{did}.{side}"
        assert len(got["fail_slices_local"]) == len(want["fail_slices_local"]), f"{did}.fail_slices"
        for g, w in zip(sorted(got["fail_slices_local"]), sorted(want["fail_slices_local"])):
            assert _same_polygon(g, w), f"{did}.fail_slice"

    assert res["not_checked"] == fx["not_checked"]
    assert res["permits_nearby"]["count"] == fx["permits_nearby"]["count"]
    assert res["meta"]["disclaimer"] == fx["meta"]["disclaimer"]
    assert res["meta"]["designs_version"] == fx["meta"]["designs_version"]
    assert res["meta"]["config_version"] == fx["meta"]["config_version"]


# ---------- depth across the building's width when the design is wider than the lot (A8 finding) ----------

def test_depth_is_measured_inside_the_lot_when_the_design_is_wider_than_the_lot():
    # 34 Rexford Rd: a 6.40 x 33.5 m lot whose side lot lines lean 0.1 m over their length, as surveyed lines do.
    # The Fourplex Wide (6.64 m) overhangs both sides; its depth row must still report the lot's depth, not a
    # sample taken just past a leaning side line, which exits the lot halfway back.
    skewed = Polygon([(OX, OY), (OX + 6.4, OY), (OX + 6.3, OY + 33.5), (OX - 0.1, OY + 33.5)])
    lot = rect_lot(6.4, 33.5, geometry=skewed,
                   buildings=[BuildingInput(building_id=1, geometry=box(OX + 0.5, OY + 8, OX + 5.9, OY + 18), avg_height_m=7.0)])
    res = run_check(lot, CFG)
    assert rule(res, "fourplex_narrow", "lot_depth").actual == pytest.approx(33.5, abs=0.05)
    assert rule(res, "fourplex_wide", "lot_depth").actual == pytest.approx(33.5, abs=0.05)
    assert rule(res, "sixplex_wide", "lot_depth").actual == pytest.approx(33.5, abs=0.05)
