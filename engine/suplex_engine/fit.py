"""The fit test and placement (MASTERSPEC 5.5) for one design on one measured lot.

Code decides fit. The uncertainty band comes from engine_config.json; the bylaw values and
sections come from rules.py.
"""
from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon, box
from shapely.geometry.base import BaseGeometry

from . import copy as copy_
from . import rules
from .config import EngineConfig
from .designs import Design, required_side_yards
from .geometry import LotGeometry, centroid_local, coords_rounded
from .models import Coord, DesignResult, LotInput, RuleRow

RULE_ORDER = ("detached_building", "units_allowed", "lot_width", "lot_depth", "building_length", "height", "lot_coverage")
BANDED_RULES = ("lot_width", "lot_depth", "lot_coverage")
DETACHED_SECTION = "600.60.20 (detached houseplex)"


@dataclass
class Placement:
    """Everything in the street frame; converted to the centroid frame when reported."""

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


def _m(x: float) -> float:
    return round(float(x), 2)


def _pct(x: float) -> float:
    return round(float(x), 1)


def place(design: Design, geo: LotGeometry, yard_left: float, yard_right: float, rear_setback_m: float) -> Placement:
    """Section 5.5 'Placement': a rectangle aligned to the frontage, front wall at the front setback,
    centred between the side lot lines after the two required yards, computed for every design."""
    assert geo.lot_street is not None and geo.depth_m is not None
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
    pad = 1.0
    buildable = lot.intersection(box(x_min, y_front, x_max, rear_line))
    setbacks = {
        "front": lot.intersection(box(minx - pad, miny - pad, maxx + pad, y_front)),
        "rear": lot.intersection(box(minx - pad, rear_line, maxx + pad, maxy + pad)),
        "left": lot.intersection(box(minx - pad, y_front, x_min, rear_line)),
        "right": lot.intersection(box(x_max, y_front, maxx + pad, rear_line)),
    }
    diff = footprint.difference(buildable)
    slices = [g for g in getattr(diff, "geoms", [diff]) if not g.is_empty and g.area > 1e-6 and g.geom_type == "Polygon"]
    return Placement(x_left, x_right, y_front, y_rear, yard_left, yard_right, rear_setback_m,
                     footprint, buildable, setbacks, slices)


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

    # 3. lot_width
    side = rules.side_yard_min(zone, lot.frontage_min_m, lot_width_m)
    yard_l, yard_r = required_side_yards(design, side.value)
    req_w = design.width_m + yard_l + yard_r
    act_w = geo.width_across_band(design.front_setback_m, design.length_m)
    margin_w = act_w - req_w
    pass_w, bord_w = _banded(margin_w, band_m)
    detail_w = f"{_fmt(design.width_m)} m building + {_fmt(yard_l)} m + {_fmt(yard_r)} m side yards"
    if side.detail and "actual" in side.detail:
        detail_w += f"; {side.detail}"
    rows.append(RuleRow("lot_width", copy_.rule_label("lot_width"), _m(req_w), _m(act_w), "m", _m(margin_w),
                        pass_w, bord_w, False, side.bylaw_section, detail_w))

    # 4. lot_depth (placement first, so the depth is measured across the building's width)
    front = rules.front_setback(zone)
    rear = rules.rear_setback(zone, geo.depth_m)
    pl = place(design, geo, yard_l, yard_r, rear.value)
    req_d = front.value + design.length_m + rear.value
    # A design that, with its required side yards, is wider than the lot's band width (margin_w < 0, a borderline
    # miss included) cannot be placed
    # inside the side lot lines, so sampling the depth under it would run past a leaning side line and read a
    # false short depth (24.6 m on the 33.5 m lot at 34 Rexford Rd); its depth row reports the lot's own
    # centre-line depth instead (5.2 step 3). A design that fits the width is measured under the placed
    # rectangle as 5.5 step 4 says, even on a skewed lot where the frontage-aligned rectangle leans over a side
    # (542 Ward 04 results; aligning the placement to the lot's sides is the fix, see docs/test-lots.md).
    act_d = geo.depth_m if margin_w < 0 else geo.depth_across_width(pl.x_left, pl.x_right)
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
    from shapely.geometry import LineString

    pts = LineString([(pl.x_left, pl.y_front), (pl.x_right, pl.y_front), (pl.x_right, pl.y_rear), (pl.x_left, pl.y_rear)])
    return _local(geo, pts)


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
