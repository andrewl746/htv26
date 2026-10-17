"""Lot geometry (MASTERSPEC 5.2): the street-facing edge, the street frame, depth and width.

All inputs are shapely geometries in EPSG:2952 metres. The *street frame* rotates the lot so the
frontage edge lies on the x axis with the lot in positive y; x grows to the right as seen from the
street. The *centroid frame* (section 3.9) is what the API reports: metres east and north of the
lot centroid.
"""
from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from shapely import affinity
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from .config import EngineConfig

Coord = tuple[float, float]

# Reasons a lot cannot be measured (the lot-level `unmeasurable` class, section 5.3 row 6).
NO_STREET_EDGE = "no_street_edge"
SHORT_STREET_EDGE = "short_street_edge"
MULTIPOLYGON = "multipolygon"
MULTIPLE_BUILDINGS = "multiple_buildings"


# ---------------------------------------------------------------------------
# Frames
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StreetFrame:
    """Rigid transform between world (EPSG:2952) and the street frame."""

    origin: Coord          # world point that maps to street (0, 0): the frontage chord's start
    angle_rad: float       # direction of the +x street axis in world coordinates

    def _matrix(self, inverse: bool = False) -> list[float]:
        c, s = math.cos(self.angle_rad), math.sin(self.angle_rad)
        ox, oy = self.origin
        if not inverse:
            # street = R(-angle) · (world - origin)
            return [c, s, -s, c, -(c * ox + s * oy), -(-s * ox + c * oy)]
        # world = R(angle) · street + origin
        return [c, -s, s, c, ox, oy]

    def to_street(self, geom: BaseGeometry) -> BaseGeometry:
        return affinity.affine_transform(geom, self._matrix())

    def to_world(self, geom: BaseGeometry) -> BaseGeometry:
        return affinity.affine_transform(geom, self._matrix(inverse=True))


def centroid_local(geom: BaseGeometry, centroid: Point) -> BaseGeometry:
    """Translate a world geometry into the centroid frame (metres east and north of the centroid)."""
    return affinity.translate(geom, xoff=-centroid.x, yoff=-centroid.y)


def coords_rounded(geom: BaseGeometry, ndigits: int = 2) -> list[Coord]:
    """Exterior coordinates of a polygon (without the closing repeat) or a line, rounded."""
    if isinstance(geom, Polygon):
        pts = list(geom.exterior.coords)[:-1]
    else:
        pts = list(geom.coords)
    return [(round(float(x), ndigits), round(float(y), ndigits)) for x, y in pts]


def polygon_parts(geom: BaseGeometry | None) -> list[Polygon]:
    """The polygons in an overlay result (Polygon, MultiPolygon or GeometryCollection), largest first.

    Lines and points left over where shapes only touch are dropped.
    """
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    parts = [p for g in getattr(geom, "geoms", ()) for p in polygon_parts(g)]
    return sorted(parts, key=lambda p: -p.area)


# ---------------------------------------------------------------------------
# Street-facing edge
# ---------------------------------------------------------------------------

def _segments(ring_coords: Sequence[Coord]) -> list[tuple[Coord, Coord]]:
    pts = list(ring_coords)
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def _direction(seg: tuple[Coord, Coord]) -> float:
    (x1, y1), (x2, y2) = seg
    return math.atan2(y2 - y1, x2 - x1)


def _angle_between_deg(a: float, b: float) -> float:
    d = abs((a - b + math.pi) % (2 * math.pi) - math.pi)
    return math.degrees(d)


def _merge_segments(segs: list[tuple[Coord, Coord]], flags: list[bool], merge_angle_deg: float) -> list[LineString]:
    """Chain consecutive flagged ring segments whose directions differ by under the merge angle."""
    n = len(segs)
    if n == 0 or not any(flags):
        return []
    # Start at a segment that begins a run (its predecessor is not flagged or bends away), so wraparound merges.
    def continues(i: int, j: int) -> bool:
        return flags[i] and flags[j] and _angle_between_deg(_direction(segs[i]), _direction(segs[j])) < merge_angle_deg

    start = None
    for i in range(n):
        if flags[i] and not continues((i - 1) % n, i):
            start = i
            break
    if start is None:                      # every segment is flagged and collinear: a degenerate ring
        start = 0
    edges: list[LineString] = []
    run: list[Coord] = []
    for k in range(n):
        i = (start + k) % n
        if not flags[i]:
            if run:
                edges.append(LineString(run))
                run = []
            continue
        if run and continues((i - 1) % n, i):
            run.append(segs[i][1])
        else:
            if run:
                edges.append(LineString(run))
            run = [segs[i][0], segs[i][1]]
    if run:
        edges.append(LineString(run))
    return edges


def _within_distance(seg: tuple[Coord, Coord], target: BaseGeometry, max_dist: float) -> bool:
    (x1, y1), (x2, y2) = seg
    for t in (0.0, 0.5, 1.0):
        p = Point(x1 + t * (x2 - x1), y1 + t * (y2 - y1))
        if p.distance(target) > max_dist:
            return False
    return True


def street_edges(lot: Polygon, corridors: Iterable[BaseGeometry], cfg: EngineConfig) -> list[LineString]:
    """Boundary edges of the lot that lie within `corridor_distance_m` of a CORRIDOR parcel, merged."""
    corridor_list = [c for c in corridors if c is not None and not c.is_empty]
    if not corridor_list:
        return []
    target = unary_union(corridor_list)
    segs = _segments(lot.exterior.coords)
    flags = [_within_distance(s, target, cfg.street_edge.corridor_distance_m) for s in segs]
    return _merge_segments(segs, flags, cfg.street_edge.merge_angle_deg)


def boundary_edges(lot: Polygon, cfg: EngineConfig) -> list[LineString]:
    """Every boundary edge of the lot, merged by the same angle rule (used for the address-point fallback)."""
    segs = _segments(lot.exterior.coords)
    return _merge_segments(segs, [True] * len(segs), cfg.street_edge.merge_angle_deg)


def _opposite(a: LineString, b: LineString, cfg: EngineConfig) -> bool:
    """Two street edges on opposite sides of the lot: parallel (directions within the merge angle, either way
    round) and apart by more than a dropped chamfer's length. A street and a rear lane, or a through lot."""
    d = _angle_between_deg(_direction((a.coords[0], a.coords[-1])), _direction((b.coords[0], b.coords[-1])))
    parallel = min(d, 180.0 - d) < cfg.street_edge.merge_angle_deg
    return parallel and a.distance(b) > cfg.street_edge.min_length_m


def _drop_opposite_edges(edges: list[LineString], address_point: Point, cfg: EngineConfig) -> list[LineString]:
    """Opposite street edges are not a corner. Walk the edges from the one nearest the lot's address point
    outward and drop every edge that lies opposite an edge already kept; the corner rule then applies to what
    is left. Of an opposite pair, the edge nearer the address point wins (an exact tie keeps boundary order),
    so a rear lane loses whenever the address point sits on the street half of the lot; on a corner lot
    addressed from its long side the lane is opposite the *other* street, which is why the test is pairwise.

    A8 finding on Ward 04 (2026-10-17): 78% of lots with two street edges have a public lane behind them, not a
    second street, and the shorter-edge rule alone faced the lane in half of those. Without an address point
    nothing says which side is the street and the by-law rule stands.
    """
    kept: list[LineString] = []
    for e in sorted(edges, key=lambda e: e.distance(address_point)):
        if not any(_opposite(e, k, cfg) for k in kept):
            kept.append(e)
    return kept


def choose_frontage(lot: Polygon, corridors: Iterable[BaseGeometry], address_point: Point | None,
                    cfg: EngineConfig) -> tuple[LineString | None, str | None]:
    """Section 5.2 step 1. Returns (edge, None) or (None, reason).

    Street edges are lot boundary runs within `corridor_distance_m` of street space. With several, edges on the
    far side of the lot from the address point (a rear lane) are dropped first; among the rest the shorter edge
    is the front lot line (the by-law's corner-lot convention). With no street space at all, the boundary edge
    nearest the address point is used.
    """
    min_len = cfg.street_edge.min_length_m
    edges = street_edges(lot, corridors, cfg)
    if edges:
        usable = [e for e in edges if e.length >= min_len]
        if not usable:
            return None, SHORT_STREET_EDGE
        if len(usable) > 1 and address_point is not None and not address_point.is_empty:
            usable = _drop_opposite_edges(usable, address_point, cfg)
        # Corner lot: the front lot line is the shorter street edge (the by-law's corner-lot convention).
        return min(usable, key=lambda e: e.length), None
    if address_point is None or address_point.is_empty:
        return None, NO_STREET_EDGE
    edges = boundary_edges(lot, cfg)
    if not edges:
        return None, NO_STREET_EDGE
    nearest = min(edges, key=lambda e: e.distance(address_point))
    if nearest.length < min_len:
        return None, SHORT_STREET_EDGE
    return nearest, None


# ---------------------------------------------------------------------------
# Measurements in the street frame
# ---------------------------------------------------------------------------

def _frange(start: float, stop: float, step: float) -> list[float]:
    """start .. stop inclusive, every step (stop always included)."""
    if stop < start:
        return []
    n = math.floor((stop - start) / step + 1e-9)
    vals = [start + i * step for i in range(n + 1)]
    if stop - vals[-1] > 1e-9:
        vals.append(stop)
    return vals


def _pieces(geom: BaseGeometry) -> list[LineString]:
    if geom.is_empty:
        return []
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return list(geom.geoms)
    if hasattr(geom, "geoms"):
        out: list[LineString] = []
        for g in geom.geoms:
            out.extend(_pieces(g))
        return out
    return []


def cross_section_width(lot_street: Polygon, y: float, x_ref: float) -> float | None:
    """Length of the lot's horizontal cross-section at height y, the piece containing x_ref (or nearest)."""
    minx, _, maxx, _ = lot_street.bounds
    line = LineString([(minx - 1.0, y), (maxx + 1.0, y)])
    pieces = _pieces(line.intersection(lot_street))
    if not pieces:
        return None
    containing = [p for p in pieces if p.bounds[0] - 1e-9 <= x_ref <= p.bounds[2] + 1e-9]
    piece = containing[0] if containing else min(pieces, key=lambda p: p.distance(Point(x_ref, y)))
    return piece.length


def depth_at_x(lot_street: Polygon, x: float) -> float | None:
    """Distance from the frontage line (y = 0) to the rear boundary along the vertical line at x.

    Uses the first piece of lot behind the frontage, so a notch or courtyard ends the depth.
    """
    _, miny, _, maxy = lot_street.bounds
    line = LineString([(x, min(miny, 0.0) - 1.0), (x, maxy + 1.0)])
    pieces = _pieces(line.intersection(lot_street))
    if not pieces:
        return None
    first = min(pieces, key=lambda p: abs(p.bounds[1]))      # the piece that starts at the frontage
    return first.bounds[3]


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

@dataclass
class LotGeometry:
    """Everything the fit test and the response need about a lot's shape."""

    lot: BaseGeometry
    cfg: EngineConfig
    centroid: Point
    unmeasurable: bool = False
    reason: str | None = None
    frontage: LineString | None = None          # world coordinates, the merged street edge
    frame: StreetFrame | None = None
    lot_street: Polygon | None = None           # the lot in the street frame
    centroid_street: Point | None = None
    depth_m: float | None = None                # section 5.2 step 3
    front_bearing_deg: float | None = None      # compass bearing centroid -> frontage midpoint
    building_count: int = 0
    _extra: dict = field(default_factory=dict, repr=False)

    # --- frontage ---
    @property
    def frontage_length_m(self) -> float | None:
        return None if self.frontage is None else self.frontage.length

    def frontage_chord(self) -> LineString | None:
        """The straight line between the frontage edge's endpoints (world)."""
        if self.frontage is None:
            return None
        c = list(self.frontage.coords)
        return LineString([c[0], c[-1]])

    def frontage_edge_coords(self) -> tuple[Coord, Coord] | None:
        ch = self.frontage_chord()
        if ch is None:
            return None
        (x1, y1), (x2, y2) = ch.coords
        return (float(x1), float(y1)), (float(x2), float(y2))

    def frontage_edge_local(self) -> tuple[Coord, Coord] | None:
        ch = self.frontage_chord()
        if ch is None:
            return None
        (x1, y1), (x2, y2) = centroid_local(ch, self.centroid).coords
        return (float(x1), float(y1)), (float(x2), float(y2))

    # --- measurements (street frame) ---
    def width_across_band(self, front_setback_m: float, length_m: float) -> float:
        """Section 5.2 step 4: the minimum cross-section width over the building band."""
        assert self.lot_street is not None and self.centroid_street is not None
        step = self.cfg.sample_step_m
        widths = []
        for y in _frange(front_setback_m, front_setback_m + length_m, step):
            w = cross_section_width(self.lot_street, y, self.centroid_street.x)
            if w is not None:
                widths.append(w)
        return min(widths) if widths else 0.0

    def depth_across_width(self, x_from: float, x_to: float) -> float:
        """Section 5.2 step 5: the minimum frontage-to-rear distance across the building's width."""
        assert self.lot_street is not None
        step = self.cfg.sample_step_m
        depths = []
        for x in _frange(min(x_from, x_to), max(x_from, x_to), step):
            d = depth_at_x(self.lot_street, x)
            if d is not None:
                depths.append(d)
        return min(depths) if depths else 0.0

    def side_lines_at(self, y: float) -> tuple[float, float] | None:
        """The lot's left and right x at height y in the street frame (the piece under the centroid)."""
        assert self.lot_street is not None and self.centroid_street is not None
        minx, _, maxx, _ = self.lot_street.bounds
        line = LineString([(minx - 1.0, y), (maxx + 1.0, y)])
        pieces = _pieces(line.intersection(self.lot_street))
        if not pieces:
            return None
        xr = self.centroid_street.x
        containing = [p for p in pieces if p.bounds[0] - 1e-9 <= xr <= p.bounds[2] + 1e-9]
        piece = containing[0] if containing else min(pieces, key=lambda p: p.distance(Point(xr, y)))
        return piece.bounds[0], piece.bounds[2]


def _bearing_deg(from_pt: Point, to_pt: Point) -> float:
    """Compass bearing, 0 = north, clockwise, from one world point to another."""
    dx, dy = to_pt.x - from_pt.x, to_pt.y - from_pt.y
    return (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0


def _count_buildings_on_lot(lot: BaseGeometry, buildings: Iterable[BaseGeometry], min_area_m2: float) -> int:
    n = 0
    for b in buildings:
        if b is None or b.is_empty:
            continue
        if b.intersection(lot).area > min_area_m2:
            n += 1
    return n


def measure_lot(lot: BaseGeometry, corridors: Iterable[BaseGeometry], address_point: Point | None,
                buildings: Iterable[BaseGeometry], cfg: EngineConfig) -> LotGeometry:
    """Section 5.2 end to end. Never raises for a bad shape: it returns `unmeasurable` with a reason."""
    geo = LotGeometry(lot=lot, cfg=cfg, centroid=lot.centroid)
    geo.building_count = _count_buildings_on_lot(lot, buildings, cfg.vacant_min_footprint_m2)

    if isinstance(lot, MultiPolygon) or not isinstance(lot, Polygon):
        if isinstance(lot, MultiPolygon) and len(lot.geoms) == 1:
            lot = lot.geoms[0]
            geo.lot = lot
        else:
            geo.unmeasurable, geo.reason = True, MULTIPOLYGON
            return geo

    if geo.building_count >= 2:
        geo.unmeasurable, geo.reason = True, MULTIPLE_BUILDINGS
        return geo

    edge, reason = choose_frontage(lot, corridors, address_point, cfg)
    if edge is None:
        geo.unmeasurable, geo.reason = True, reason
        return geo
    geo.frontage = edge

    # Street frame: frontage chord on the x axis, lot in positive y, +x to the right seen from the street.
    c = list(edge.coords)
    (x1, y1), (x2, y2) = c[0], c[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    frame = StreetFrame(origin=(float(x1), float(y1)), angle_rad=angle)
    centroid_s = frame.to_street(lot.centroid)
    if centroid_s.y < 0:
        # Flip so the lot lies above the frontage: start the chord from the other end.
        angle = math.atan2(y1 - y2, x1 - x2)
        frame = StreetFrame(origin=(float(x2), float(y2)), angle_rad=angle)
        centroid_s = frame.to_street(lot.centroid)
    geo.frame = frame
    geo.lot_street = frame.to_street(lot)
    geo.centroid_street = centroid_s

    depth = depth_at_x(geo.lot_street, centroid_s.x)
    geo.depth_m = depth if depth is not None else 0.0
    chord_mid = Point((x1 + x2) / 2.0, (y1 + y2) / 2.0)
    geo.front_bearing_deg = _bearing_deg(lot.centroid, chord_mid)
    return geo
