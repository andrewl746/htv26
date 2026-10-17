"""The fit test and placement (MASTERSPEC 5.5) for one design on one measured lot.

Code decides fit. The uncertainty band comes from engine_config.json; the bylaw values and
sections come from rules.py.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.geometry.base import BaseGeometry

from . import copy as copy_
from . import rules
from .config import EngineConfig
from .designs import Design, required_side_yards
from .geometry import LotGeometry, _frange, _pieces, centroid_local, coords_rounded
from .models import Coord, DesignResult, LotInput, RuleRow

RULE_ORDER = ("detached_building", "units_allowed", "lot_width", "lot_depth", "building_length", "height", "lot_coverage")
BANDED_RULES = ("lot_width", "lot_depth", "lot_coverage")
DETACHED_SECTION = "600.60.20 (detached houseplex)"
_PAD = 1.0                  # margin around the lot for the half-plane boxes below (geometry only, not a rule)


@dataclass(frozen=True)
class Axis:
    """The building's long axis in the street frame, leaning `lean` radians from the frontage normal toward +x
    (T20). The *side frame* turns the street frame so that the axis is +y: s = x cos - y sin, t = x sin + y cos.
    With a lean of 0 the side frame is the street frame."""

    lean: float = 0.0

    @property
    def cos(self) -> float:
        return math.cos(self.lean)

    @property
    def sin(self) -> float:
        return math.sin(self.lean)

    def to_side(self, geom: BaseGeometry) -> BaseGeometry:
        return affinity.rotate(geom, self.lean, origin=(0.0, 0.0), use_radians=True)

    def to_street(self, geom: BaseGeometry) -> BaseGeometry:
        return affinity.rotate(geom, -self.lean, origin=(0.0, 0.0), use_radians=True)

    def street_xy(self, s: float, t: float) -> Coord:
        return s * self.cos + t * self.sin, -s * self.sin + t * self.cos


def side_lean(geo: LotGeometry, design: Design) -> Axis:
    """T20: the skew of the lot across the design's band (front setback to front setback plus length). When both
    side lot lines lean the same way by `placement.align_to_sides_deg` or more, the building turns to follow
    them, as houses on a diagonal street do; otherwise it stays square to the frontage (5.5)."""
    f = design.front_setback_m
    return Axis(geo.side_lean_between(f, f + design.length_m))


@dataclass
class Placement:
    """The building in the side frame (the street frame when the axis does not lean), its corners and every
    polygon in the street frame; converted to the centroid frame when reported."""

    x_left: float
    x_right: float
    y_front: float
    y_rear: float
    yard_left: float
    yard_right: float
    rear_setback_m: float
    footprint: Polygon
    buildable: BaseGeometry
    setbacks: dict[str, BaseGeometry]
    fail_slices: list[Polygon]
    axis: Axis
    corners: list[Coord]            # street frame: front-left, front-right, rear-right, rear-left
    lot_side: BaseGeometry | None   # the lot in the side frame (None when the axis does not lean)


def _m(x: float) -> float:
    return round(float(x), 2)


def _pct(x: float) -> float:
    return round(float(x), 1)


def _piece_bounds(lot: BaseGeometry, line: LineString, ref: Point) -> tuple[float, float, float, float] | None:
    """Bounds of the piece of `line` inside `lot` that contains `ref`, else the nearest piece."""
    pieces = _pieces(line.intersection(lot))
    if not pieces:
        return None
    containing = [p for p in pieces if p.distance(ref) <= 1e-9]
    return (containing[0] if containing else min(pieces, key=lambda p: p.distance(ref))).bounds


def side_lines_side_frame(lot_side: BaseGeometry, t: float, s_ref: float) -> tuple[float, float] | None:
    """The lot's left and right s at height t in the side frame (the piece at s_ref, or the nearest)."""
    minx, _, maxx, _ = lot_side.bounds
    b = _piece_bounds(lot_side, LineString([(minx - _PAD, t), (maxx + _PAD, t)]), Point(s_ref, t))
    return None if b is None else (b[0], b[2])


def place(design: Design, geo: LotGeometry, yard_left: float, yard_right: float, rear_setback_m: float,
          axis: Axis | None = None) -> Placement:
    """Section 5.5 'Placement': a rectangle aligned to the frontage, front wall at the front setback,
    centred between the side lot lines after the two required yards, computed for every design.

    T20: when `axis` leans, the rectangle turns to follow the side lot lines instead. It is centred between them
    (measured square to the sides) and pushed back until its nearer front corner is the front setback from the
    front lot line; the front and rear setbacks stay parallel to the frontage, the side yards follow the sides."""
    assert geo.lot_street is not None and geo.depth_m is not None
    axis = axis or Axis()
    if axis.lean != 0.0:
        return _place_turned(design, geo, yard_left, yard_right, rear_setback_m, axis)
    f = design.front_setback_m
    y_front, y_rear = f, f + design.length_m
    sides = geo.side_lines_at(f + design.length_m / 2.0) or geo.side_lines_at(f) or geo.lot_street.bounds[0::2]
    lot_left, lot_right = sides
    x_min, x_max = lot_left + yard_left, lot_right - yard_right
    extra = (x_max - x_min) - design.width_m
    x_left = x_min + extra / 2.0
    x_right = x_left + design.width_m
    footprint = box(x_left, y_front, x_right, y_rear)

    rear_line = geo.depth_m - rear_setback_m
    lot = geo.lot_street
    minx, miny, maxx, maxy = lot.bounds
    pad = _PAD
    buildable = lot.intersection(box(x_min, y_front, x_max, rear_line))
    setbacks = {
        "front": lot.intersection(box(minx - pad, miny - pad, maxx + pad, y_front)),
        "rear": lot.intersection(box(minx - pad, rear_line, maxx + pad, maxy + pad)),
        "left": lot.intersection(box(minx - pad, y_front, x_min, rear_line)),
        "right": lot.intersection(box(x_max, y_front, maxx + pad, rear_line)),
    }
    diff = footprint.difference(buildable)
    slices = [g for g in getattr(diff, "geoms", [diff]) if not g.is_empty and g.area > 1e-6 and g.geom_type == "Polygon"]
    corners = [(x_left, y_front), (x_right, y_front), (x_right, y_rear), (x_left, y_rear)]
    return Placement(x_left, x_right, y_front, y_rear, yard_left, yard_right, rear_setback_m,
                     footprint, buildable, setbacks, slices, axis, corners, None)


def _place_turned(design: Design, geo: LotGeometry, yard_left: float, yard_right: float, rear_setback_m: float,
                  axis: Axis) -> Placement:
    assert geo.lot_street is not None and geo.centroid_street is not None and geo.depth_m is not None
    f, length, width = design.front_setback_m, design.length_m, design.width_m
    lot = geo.lot_street
    lot_side = axis.to_side(lot)
    s_ref = axis.to_side(geo.centroid_street).x
    fallback = lot_side.bounds[0::2]

    # The front wall's distance along the axis depends on where the building sits across the lot and vice
    # versa; the sides are nearly upright in the side frame, so two or three rounds settle it.
    t_front = f / axis.cos
    x_min = x_max = x_left = x_right = 0.0
    for _ in range(4):
        sides = (side_lines_side_frame(lot_side, t_front + length / 2.0, s_ref)
                 or side_lines_side_frame(lot_side, t_front, s_ref) or fallback)
        x_min, x_max = sides[0] + yard_left, sides[1] - yard_right
        x_left = x_min + ((x_max - x_min) - width) / 2.0
        x_right = x_left + width
        nxt = (f + max(x_left * axis.sin, x_right * axis.sin)) / axis.cos
        done = abs(nxt - t_front) < 1e-9
        t_front = nxt
        if done:
            break
    t_rear = t_front + length
    footprint = axis.to_street(box(x_left, t_front, x_right, t_rear))

    rear_line = geo.depth_m - rear_setback_m
    minx, miny, maxx, maxy = lot.bounds
    sminx, sminy, smaxx, smaxy = lot_side.bounds
    pad = _PAD
    front_strip = lot.intersection(box(minx - pad, miny - pad, maxx + pad, f))
    rear_strip = lot.intersection(box(minx - pad, rear_line, maxx + pad, maxy + pad))
    middle = lot.intersection(box(minx - pad, f, maxx + pad, rear_line))
    between = axis.to_street(box(x_min, sminy - pad, x_max, smaxy + pad))
    buildable = middle.intersection(between)
    setbacks = {
        "front": front_strip,
        "rear": rear_strip,
        "left": middle.intersection(axis.to_street(box(sminx - pad, sminy - pad, x_min, smaxy + pad))),
        "right": middle.intersection(axis.to_street(box(x_max, sminy - pad, smaxx + pad, smaxy + pad))),
    }
    diff = footprint.difference(buildable)
    slices = [g for g in getattr(diff, "geoms", [diff]) if not g.is_empty and g.area > 1e-6 and g.geom_type == "Polygon"]
    corners = [axis.street_xy(x_left, t_front), axis.street_xy(x_right, t_front),
               axis.street_xy(x_right, t_rear), axis.street_xy(x_left, t_rear)]
    return Placement(x_left, x_right, t_front, t_rear, yard_left, yard_right, rear_setback_m,
                     footprint, buildable, setbacks, slices, axis, corners, lot_side)


def turned_width(pl: Placement, geo: LotGeometry, step: float) -> float:
    """T20: the lot's width square to the side lot lines, the minimum over the turned building's length."""
    assert pl.lot_side is not None and geo.centroid_street is not None
    s_ref = pl.axis.to_side(geo.centroid_street).x
    widths = []
    for t in _frange(pl.y_front, pl.y_rear, step):
        sides = side_lines_side_frame(pl.lot_side, t, s_ref)
        if sides is not None:
            widths.append(sides[1] - sides[0])
    return min(widths) if widths else 0.0


def turned_rear_clearance(pl: Placement, step: float) -> float | None:
    """T20: the smallest distance, square to the frontage, from the turned building's rear wall to the lot's
    boundary straight behind it along the axis, sampled across the building's width. Measured this way the rear
    setback is the same yard the setback strip draws when the rear lot line is parallel to the street. None when
    no sample line crosses the lot."""
    assert pl.lot_side is not None
    _, sminy, _, smaxy = pl.lot_side.bounds
    mid = (pl.y_front + pl.y_rear) / 2.0
    gaps = []
    for s in _frange(pl.x_left, pl.x_right, step):
        b = _piece_bounds(pl.lot_side, LineString([(s, sminy - _PAD), (s, smaxy + _PAD)]), Point(s, mid))
        if b is not None:
            gaps.append((b[3] - pl.y_rear) * pl.axis.cos)
    return min(gaps) if gaps else None


def _local(geo: LotGeometry, geom_street: BaseGeometry) -> list[Coord]:
    """Street-frame geometry -> centroid-frame coordinates, rounded to centimetres."""
    assert geo.frame is not None
    world = geo.frame.to_world(geom_street)
    return coords_rounded(centroid_local(world, geo.centroid))


def _largest_polygon(geom: BaseGeometry) -> Polygon | None:
    if geom.is_empty:
        return None
    if geom.geom_type == "Polygon":
        return geom
    polys = [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    return max(polys, key=lambda g: g.area) if polys else None


def _banded(margin: float, band: float) -> tuple[bool, bool]:
    """(pass, borderline) for a banded rule: borderline when |margin| is within the band."""
    return margin >= 0, abs(margin) <= band + 1e-9


def check_design(design: Design, lot: LotInput, geo: LotGeometry, zone: str, lot_class: str,
                 lot_width_m: float, cfg: EngineConfig, vacant: bool) -> DesignResult:
    """Run the seven rules in order and place the building. `lot_class` is `attached` or `checked`."""
    rows: list[RuleRow] = []
    band_m = cfg.uncertainty_band_m
    band_pp = cfg.uncertainty_band_coverage_pp

    # 1. detached_building
    actual = "attached" if lot_class == "attached" else ("vacant" if vacant else "detached")
    ok = lot_class != "attached"
    rows.append(RuleRow("detached_building", copy_.rule_label("detached_building"), "detached", actual, None, None,
                        ok, False, False, DETACHED_SECTION, None))

    # 2. units_allowed
    u = rules.units_allowed(lot.sixplex_overlay)
    rows.append(RuleRow("units_allowed", copy_.rule_label("units_allowed"), design.units, int(u.value), "units",
                        int(u.value) - design.units, int(u.value) >= design.units, False, False, u.bylaw_section, u.detail))

    # Placement before the width and depth rows: on a lot whose sides lean (T20) both are measured around the
    # turned building, square to the side lot lines.
    side = rules.side_yard_min(zone, lot.frontage_min_m, lot_width_m)
    yard_l, yard_r = required_side_yards(design, side.value)
    front = rules.front_setback(zone)
    rear = rules.rear_setback(zone, geo.depth_m)
    pl = place(design, geo, yard_l, yard_r, rear.value, side_lean(geo, design))
    turned = pl.axis.lean != 0.0

    # 3. lot_width
    req_w = design.width_m + yard_l + yard_r
    act_w = turned_width(pl, geo, cfg.sample_step_m) if turned else geo.width_across_band(design.front_setback_m,
                                                                                         design.length_m)
    margin_w = act_w - req_w
    pass_w, bord_w = _banded(margin_w, band_m)
    detail_w = f"{_fmt(design.width_m)} m building + {_fmt(yard_l)} m + {_fmt(yard_r)} m side yards"
    if side.detail and "actual" in side.detail:
        detail_w += f"; {side.detail}"
    rows.append(RuleRow("lot_width", copy_.rule_label("lot_width"), _m(req_w), _m(act_w), "m", _m(margin_w),
                        pass_w, bord_w, False, side.bylaw_section, detail_w))

    # 4. lot_depth (placement first, so the depth is measured across the building's width)
    req_d = front.value + design.length_m + rear.value
    # A design that, with its required side yards, is wider than the lot's band width (margin_w < 0, a borderline
    # miss included) cannot be placed
    # inside the side lot lines, so sampling the depth under it would run past a leaning side line and read a
    # false short depth (24.6 m on the 33.5 m lot at 34 Rexford Rd); its depth row reports the lot's own
    # centre-line depth instead (5.2 step 3). A design that fits the width is measured under the placed
    # rectangle as 5.5 step 4 says. On a lot whose sides lean (T20) the rectangle follows them, and the row
    # reports the front setback, the building and the clearance behind its rear wall: the depth the lot offers
    # this design, which is the frontage-to-rear depth again on a lot that does not lean.
    if margin_w < 0:
        act_d = geo.depth_m
    elif turned:
        clearance = turned_rear_clearance(pl, cfg.sample_step_m)
        act_d = 0.0 if clearance is None else design.front_setback_m + design.length_m + clearance
    else:
        act_d = geo.depth_across_width(pl.x_left, pl.x_right)
    margin_d = act_d - req_d
    pass_d, bord_d = _banded(margin_d, band_m)
    rear_txt = f"{_fmt(rear.value)} m rear" + (f" ({rear.detail})" if rear.detail else "")
    detail_d = f"{_fmt(front.value)} m front + {_fmt(design.length_m)} m building + {rear_txt}"
    rows.append(RuleRow("lot_depth", copy_.rule_label("lot_depth"), _m(req_d), _m(act_d), "m", _m(margin_d),
                        pass_d, bord_d, False, f"{front.bylaw_section}, {rear.bylaw_section}", detail_d))

    # 5. building_length (no band)
    bl = rules.building_length_allowed(zone, lot_width_m, geo.depth_m)
    if bl.not_applicable:
        rows.append(RuleRow("building_length", copy_.rule_label("building_length"), None, _m(design.length_m), "m", None,
                            None, False, True, bl.bylaw_section, bl.detail))
    else:
        margin_l = bl.value - design.length_m
        rows.append(RuleRow("building_length", copy_.rule_label("building_length"), _m(bl.value), _m(design.length_m), "m",
                            _m(margin_l), margin_l >= 0, False, False, bl.bylaw_section, bl.detail if margin_l < 0 else None))

    # 6. height (no band)
    h = rules.height_allowed(zone, lot.ht_overlay_m)
    margin_h = h.value - design.height_m
    rows.append(RuleRow("height", copy_.rule_label("height"), _m(h.value), _m(design.height_m), "m", _m(margin_h),
                        margin_h >= 0, False, False, h.bylaw_section, h.detail))

    # 7. lot_coverage (band in percentage points)
    cov = rules.coverage_allowed(zone, lot.coverage_overlay_pct)
    area = lot.lot_area_m2
    act_c = design.building_area_m2 / area * 100.0 if area > 0 else 0.0
    if cov.not_applicable:
        rows.append(RuleRow("lot_coverage", copy_.rule_label("lot_coverage"), None, _pct(act_c), "pct", None,
                            None, False, True, cov.bylaw_section, cov.detail))
    else:
        margin_c = cov.value - act_c
        pass_c, bord_c = _banded(margin_c, band_pp)
        detail_c = f"{_fmt(design.building_area_m2)} m² building on a {_fmt(area)} m² lot" + (f"; {cov.detail}" if cov.detail else "")
        rows.append(RuleRow("lot_coverage", copy_.rule_label("lot_coverage"), _pct(cov.value), _pct(act_c), "pct",
                            _pct(margin_c), pass_c, bord_c, False, cov.bylaw_section, detail_c))

    result, blocking = decide(rows, cfg)
    setbacks_local = {k: _local(geo, _largest_polygon(v) or Polygon()) for k, v in pl.setbacks.items()}
    buildable_poly = _largest_polygon(pl.buildable)
    return DesignResult(
        design_id=design.id, result=result, blocking_rule=blocking, rules=rows,
        placement_local=_placement_coords(geo, pl),
        buildable_local=_local(geo, buildable_poly) if buildable_poly is not None else None,
        setbacks_local=setbacks_local,
        fail_slices_local=[_local(geo, s) for s in pl.fail_slices],
    )


def _placement_coords(geo: LotGeometry, pl: Placement) -> list[Coord]:
    """Four corners, front wall first (front-left, front-right, rear-right, rear-left)."""
    return _local(geo, LineString(pl.corners))


def decide(rows: list[RuleRow], cfg: EngineConfig) -> tuple[str, str | None]:
    """Result per design (5.5): no_fit beyond the band or on any no-band failure; else borderline; else fits."""
    for r in rows:
        if r.not_applicable or r.pass_ is None:
            continue
        if r.rule_id in BANDED_RULES:
            if not r.pass_ and not r.borderline:
                return "no_fit", r.rule_id
        elif not r.pass_:
            return "no_fit", r.rule_id
    if any(r.borderline for r in rows if r.rule_id in BANDED_RULES and not r.not_applicable):
        return "borderline", None
    return "fits", None


def _fmt(x: float) -> str:
    return rules._fmt(x)
