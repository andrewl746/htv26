"""A4 acceptance tests for suplex_engine.geometry (MASTERSPEC 5.2 and 8.1).

Every lot is synthetic and drawn in EPSG:2952-like metres. The street frame puts the frontage
edge on the x axis with the lot in positive y; x grows to the right as seen from the street.
"""
from __future__ import annotations

import pytest
from shapely.geometry import MultiPolygon, Point, Polygon, box

from suplex_engine.config import load_config
from suplex_engine.geometry import LotGeometry, measure_lot

CFG = load_config()

# A classic 25-foot lot: 7.62 m wide, 30.5 m deep, street along the south edge.
RECT = box(0, 0, 7.62, 30.5)
SOUTH_STREET = box(-20, -10, 30, 0)        # corridor parcel touching y = 0
WEST_STREET = box(-10, -10, 0, 50)          # corridor parcel touching x = 0


def measure(lot, corridors=(), address_point=None, buildings=()) -> LotGeometry:
    return measure_lot(lot, list(corridors), address_point, list(buildings), CFG)


# ---------- configuration ----------

def test_config_comes_from_contracts_file():
    assert CFG.uncertainty_band_m == pytest.approx(0.5)
    assert CFG.uncertainty_band_coverage_pp == pytest.approx(2)
    assert CFG.street_edge.min_length_m == pytest.approx(3)
    assert CFG.sample_step_m == pytest.approx(0.5)


# ---------- the acceptance check ----------

def test_rectangle_width_and_depth():
    geo = measure(RECT, [SOUTH_STREET])
    assert not geo.unmeasurable
    assert geo.depth_m == pytest.approx(30.5, abs=0.01)
    assert geo.width_across_band(front_setback_m=6.0, length_m=17.0) == pytest.approx(7.62, abs=0.01)


def test_rectangle_front_bearing_points_at_the_street():
    geo = measure(RECT, [SOUTH_STREET])
    assert geo.front_bearing_deg == pytest.approx(180.0, abs=0.5)
    (x1, y1), (x2, y2) = geo.frontage_edge_coords()
    assert y1 == pytest.approx(0.0, abs=0.01) and y2 == pytest.approx(0.0, abs=0.01)
    assert sorted([x1, x2]) == pytest.approx([0.0, 7.62], abs=0.01)


def test_corner_lot_picks_the_shorter_street_edge():
    lot = box(0, 0, 10, 30)
    geo = measure(lot, [SOUTH_STREET, WEST_STREET])
    assert not geo.unmeasurable
    assert geo.front_bearing_deg == pytest.approx(180.0, abs=0.5)   # the 10 m south edge, not the 30 m west edge
    assert geo.depth_m == pytest.approx(30.0, abs=0.01)


def test_corner_lot_shorter_edge_can_be_the_side_street():
    lot = box(0, 0, 30, 10)        # 30 m along the south street, 10 m along the west street
    geo = measure(lot, [SOUTH_STREET, WEST_STREET])
    assert geo.front_bearing_deg == pytest.approx(270.0, abs=0.5)
    assert geo.depth_m == pytest.approx(30.0, abs=0.01)
    assert geo.width_across_band(6.0, 17.0) == pytest.approx(10.0, abs=0.01)


def test_pie_lot_width_is_the_minimum_across_the_building_band():
    # 6 m at the street, 14 m at the rear, 30 m deep: the band starts at y = 6 where the lot is 7.6 m wide.
    pie = Polygon([(4, 0), (10, 0), (14, 30), (0, 30)])
    geo = measure(pie, [SOUTH_STREET])
    assert geo.width_across_band(6.0, 17.0) == pytest.approx(7.6, abs=0.02)


def test_reverse_pie_lot_width_is_measured_at_the_rear_of_the_band():
    # 14 m at the street tapering to 6 m at the rear: the narrowest row of the band is y = 23.
    pie = Polygon([(0, 0), (14, 0), (10, 30), (4, 30)])
    geo = measure(pie, [SOUTH_STREET])
    expected = 14 - 8 * 23 / 30
    assert geo.width_across_band(6.0, 17.0) == pytest.approx(expected, abs=0.02)


def test_flag_lot_is_unmeasurable():
    # A 2.5 m pole to the street and a 15 x 20 m body behind it.
    flag = Polygon([(0, 0), (2.5, 0), (2.5, 20), (15, 20), (15, 40), (-5, 40), (-5, 20), (0, 20)])
    geo = measure(flag, [SOUTH_STREET])
    assert geo.unmeasurable
    assert geo.reason == "short_street_edge"


# ---------- street edge selection ----------

def test_corridor_edges_are_merged_when_nearly_collinear():
    # The south edge is split into two segments that bend by 5 degrees; they merge into one 10 m edge.
    lot = Polygon([(0, 0), (5, 0), (10, 0.44), (10, 30), (0, 30)])
    street = Polygon([(-20, -10), (30, -10), (30, 0.44), (5, 0), (-20, 0)])
    geo = measure(lot, [street])
    assert not geo.unmeasurable
    assert geo.frontage_length_m == pytest.approx(10.0, abs=0.1)


def test_no_corridor_falls_back_to_edge_nearest_the_address_point():
    geo = measure(RECT, [], address_point=Point(3.8, 1.0))
    assert not geo.unmeasurable
    assert geo.front_bearing_deg == pytest.approx(180.0, abs=0.5)


def test_no_corridor_and_no_address_point_is_unmeasurable():
    geo = measure(RECT, [])
    assert geo.unmeasurable
    assert geo.reason == "no_street_edge"


def test_corridor_further_than_half_a_metre_does_not_count():
    far_street = box(-20, -10, 30, -0.6)
    geo = measure(RECT, [far_street])
    assert geo.unmeasurable
    assert geo.reason == "no_street_edge"


# ---------- the street frame ----------

def test_rotated_lot_measures_the_same_as_the_axis_aligned_one():
    # The same 7.62 x 30.5 lot with the street to the east: frontage along x = 0 at bearing 90.
    lot = Polygon([(0, 0), (0, 7.62), (-30.5, 7.62), (-30.5, 0)])
    east_street = box(0, -10, 10, 20)
    geo = measure(lot, [east_street])
    assert not geo.unmeasurable
    assert geo.front_bearing_deg == pytest.approx(90.0, abs=0.5)
    assert geo.depth_m == pytest.approx(30.5, abs=0.01)
    assert geo.width_across_band(6.0, 17.0) == pytest.approx(7.62, abs=0.01)


def test_street_frame_puts_the_lot_in_positive_y_with_the_frontage_on_the_x_axis():
    geo = measure(RECT, [SOUTH_STREET])
    minx, miny, maxx, maxy = geo.lot_street.bounds
    assert miny == pytest.approx(0.0, abs=1e-6)
    assert maxy == pytest.approx(30.5, abs=1e-6)
    assert maxx - minx == pytest.approx(7.62, abs=1e-6)
    # x grows to the right as seen from the street: in the south-street case that is east (+x world).
    west_corner = geo.frame.to_street(Point(0, 0))
    east_corner = geo.frame.to_street(Point(7.62, 0))
    assert west_corner.x < east_corner.x


def test_street_frame_round_trips():
    geo = measure(RECT, [SOUTH_STREET])
    p = Point(2.0, 5.0)
    back = geo.frame.to_world(geo.frame.to_street(p))
    assert back.x == pytest.approx(2.0, abs=1e-9) and back.y == pytest.approx(5.0, abs=1e-9)


def test_centroid_frame_is_metres_from_the_lot_centroid():
    geo = measure(RECT, [SOUTH_STREET])
    (x1, y1), (x2, y2) = geo.frontage_edge_local()
    assert y1 == pytest.approx(-15.25, abs=0.01) and y2 == pytest.approx(-15.25, abs=0.01)
    assert sorted([x1, x2]) == pytest.approx([-3.81, 3.81], abs=0.01)


# ---------- depth across the building's width ----------

def test_depth_across_width_takes_the_minimum_over_the_building():
    # Rear right corner notched out by 5 m: a building spanning x 1.2 .. 6.7 sees a 25.5 m depth on its right side.
    notched = Polygon([(0, 0), (7.62, 0), (7.62, 25.5), (4.0, 25.5), (4.0, 30.5), (0, 30.5)])
    geo = measure(notched, [SOUTH_STREET])
    assert geo.depth_m == pytest.approx(30.5, abs=0.01)           # the centroid line (x about 3.3) misses the notch
    assert geo.depth_across_width(1.2, 6.7) == pytest.approx(25.5, abs=0.01)
    assert geo.depth_across_width(0.5, 3.0) == pytest.approx(30.5, abs=0.01)


def test_depth_uses_the_first_piece_of_lot_behind_the_frontage():
    # An interior courtyard hole at y 12..14 means the rear boundary along x = 3.8 is at y = 12.
    with_hole = Polygon([(0, 0), (7.62, 0), (7.62, 30.5), (0, 30.5)], holes=[[(3, 12), (5, 12), (5, 14), (3, 14)]])
    geo = measure(with_hole, [SOUTH_STREET])
    assert geo.depth_m == pytest.approx(12.0, abs=0.01)


# ---------- unmeasurable by shape or buildings ----------

def test_multipolygon_is_unmeasurable():
    lot = MultiPolygon([box(0, 0, 7.62, 20), box(0, 25, 7.62, 30.5)])
    geo = measure(lot, [SOUTH_STREET])
    assert geo.unmeasurable
    assert geo.reason == "multipolygon"


def test_two_separate_buildings_over_20_m2_is_unmeasurable():
    lot = box(0, 0, 15, 40)
    front_house = box(2, 8, 10, 18)      # 80 m2
    rear_house = box(2, 25, 8, 32)       # 42 m2
    geo = measure(lot, [SOUTH_STREET], buildings=[front_house, rear_house])
    assert geo.unmeasurable
    assert geo.reason == "multiple_buildings"


def test_a_shed_under_20_m2_does_not_make_the_lot_unmeasurable():
    lot = box(0, 0, 15, 40)
    house = box(2, 8, 10, 18)
    shed = box(10, 35, 13, 39)           # 12 m2
    geo = measure(lot, [SOUTH_STREET], buildings=[house, shed])
    assert not geo.unmeasurable


def test_neighbours_footprint_crossing_the_line_is_not_a_second_building():
    lot = box(0, 0, 7.62, 30.5)
    house = box(0.9, 8, 6.7, 18)
    neighbour = box(-6, 8, 0.3, 18)      # crosses the side lot line by 3 m2
    geo = measure(lot, [SOUTH_STREET], buildings=[house, neighbour])
    assert not geo.unmeasurable
