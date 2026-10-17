"""`run_check`: the one entry point the API's /check and the batch run both call (MASTERSPEC 3.1, 5).

Footprints are clipped to the lot (5.3; section 0 item 6): `lot.existing_building` is the on-lot part
of the largest footprint, and a footprint that crosses the lot line goes into `context.buildings` as
its on-lot part plus its off-lot parts, so the neighbours' halves of a semi or row stay standing.
"""
from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache

from pyproj import Transformer
from shapely.geometry import Point
from shapely.geometry.base import BaseGeometry

from . import ENGINE_VERSION
from . import copy as copy_
from .classify import NOT_CHECKED_CLASSES, Classification, classify, flags_for
from .config import EngineConfig, load_config
from .designs import DesignsFile, load_designs
from .fit import check_design
from .geometry import LotGeometry, centroid_local, coords_rounded, cross_section_width, measure_lot, polygon_parts
from .models import (
    Address,
    CheckResult,
    Context,
    ContextBuilding,
    Coord,
    DesignResult,
    ExistingBuilding,
    Lot,
    LotInput,
    Meta,
    Origin,
    PermitsNearby,
    Reason,
    ZoneInfo,
)
from .rules import FRONT_SETBACK_M, zone_code

EPSG_METRES = "EPSG:2952"
EPSG_WGS84 = "EPSG:4326"


@lru_cache(maxsize=1)
def _to_wgs84() -> Transformer:
    return Transformer.from_crs(EPSG_METRES, EPSG_WGS84, always_xy=True)


def lonlat(x: float, y: float) -> tuple[float, float]:
    lon, lat = _to_wgs84().transform(x, y)
    return round(float(lon), 6), round(float(lat), 6)


def _wgs84_ring(geom: BaseGeometry) -> list[tuple[float, float]]:
    poly = geom if geom.geom_type == "Polygon" else max(geom.geoms, key=lambda g: g.area)
    return [lonlat(x, y) for x, y in poly.exterior.coords]


def _polygon_local(geom: BaseGeometry, centroid: Point) -> list[tuple[float, float]]:
    poly = geom if geom.geom_type == "Polygon" else max(geom.geoms, key=lambda g: g.area)
    pts = coords_rounded(centroid_local(poly, centroid))
    return pts + [pts[0]]


def _footprint_local(geom: BaseGeometry, centroid: Point) -> list[Coord]:
    """Exterior ring of the largest polygon part, in the centroid frame (no closing repeat)."""
    return coords_rounded(centroid_local(polygon_parts(geom)[0], centroid))


def _context_buildings(lot: LotInput, cls: Classification, centroid: Point, cfg: EngineConfig) -> list[ContextBuilding]:
    """Buildings within the context radius; an on-lot footprint splits into its on-lot and off-lot parts."""
    on_lot = {f.building.building_id: f for f in cls.footprints_on_lot}
    out = []
    for b in lot.buildings:
        if b.geometry is None or b.geometry.is_empty or b.geometry.distance(centroid) > cfg.context_radius_m:
            continue
        kind = "large" if b.avg_height_m is not None and b.avg_height_m >= cfg.larger_building.avg_height_m else "house"
        height = round(float(b.avg_height_m), 2)
        fp = on_lot.get(b.building_id)
        if fp is None:
            out.append(ContextBuilding(b.building_id, height, kind, False, _footprint_local(b.geometry, centroid)))
            continue
        out.append(ContextBuilding(b.building_id, height, kind, True, _footprint_local(fp.clip, centroid)))
        for part in polygon_parts(b.geometry.difference(lot.geometry)):
            if part.area > cfg.vacant_min_footprint_m2:
                out.append(ContextBuilding(b.building_id, height, kind, False, _footprint_local(part, centroid)))
    return out


def run_check(lot: LotInput, cfg: EngineConfig | None = None, designs: DesignsFile | None = None,
              data_dates: dict[str, str] | None = None) -> CheckResult:
    cfg = cfg or load_config()
    designs = designs or load_designs()
    centroid = lot.geometry.centroid

    # Geometry first (it also counts buildings for the unmeasurable test), then the 5.3 order.
    geo: LotGeometry = measure_lot(lot.geometry, lot.corridors, lot.address_point,
                                   [b.geometry for b in lot.buildings], cfg)
    cls = classify(lot, geo, cfg)
    zone = zone_code(lot.zn_zone)
    measured = cls.class_ not in NOT_CHECKED_CLASSES and not geo.unmeasurable and zone is not None

    width_m = depth_m = None
    if measured:
        width_m = cross_section_width(geo.lot_street, FRONT_SETBACK_M, geo.centroid_street.x)
        if width_m is None:
            width_m = geo.width_across_band(0.0, geo.depth_m)
        depth_m = geo.depth_m

    design_results: list[DesignResult] = []
    for d in designs.designs:
        if measured:
            design_results.append(check_design(d, lot, geo, zone, cls.class_, width_m, cfg, cls.vacant))
        else:
            design_results.append(DesignResult(d.id, "not_checked", None, [], None, None, None, []))

    reason = None
    if cls.class_ in NOT_CHECKED_CLASSES:
        c = copy_.class_reason(cls.class_)
        reason = Reason(id=cls.class_, label=c["label"], text=c["text"])

    existing = None
    if cls.existing is not None:
        b = cls.existing.building
        existing = ExistingBuilding(b.building_id, round(float(b.avg_height_m), 2), round(cls.existing.area_m2, 1),
                                    _footprint_local(cls.existing.clip, centroid))

    frontage_local = None
    if measured and geo.frontage is not None:
        (x1, y1), (x2, y2) = geo.frontage_edge_local()
        frontage_local = ((round(x1, 2), round(y1, 2)), (round(x2, 2), round(y2, 2)))

    lot_out = Lot(
        lot_id=lot.lot_id, class_=cls.class_, reason=reason, ward_id=lot.ward_id, ward_name=lot.ward_name,
        zone=ZoneInfo(lot.zn_zone, lot.zn_string, lot.gen_zone, lot.zbl_sectn, lot.zn_status, lot.frontage_min_m,
                      lot.units_max, lot.ht_overlay_m, lot.coverage_overlay_pct, lot.exception_no, bool(lot.sixplex_overlay)),
        width_m=round(width_m, 2) if width_m is not None else None,
        depth_m=round(depth_m, 2) if depth_m is not None else None,
        area_m2=round(lot.lot_area_m2, 2), stated_area=lot.stated_area,
        front_bearing_deg=round(geo.front_bearing_deg, 1) if measured and geo.front_bearing_deg is not None else None,
        frontage_edge_local=frontage_local,
        polygon_local=_polygon_local(lot.geometry, centroid),
        polygon_wgs84=_wgs84_ring(lot.geometry),
        existing_building=existing, attached=cls.attached, vacant=cls.vacant,
        flags=flags_for(lot, cls.vacant),
    )

    # Context: buildings and trees within the context radius, in the centroid frame.
    radius = cfg.context_radius_m
    buildings = _context_buildings(lot, cls, centroid, cfg)
    trees = [(round(t.x - centroid.x, 2), round(t.y - centroid.y, 2)) for t in lot.trees if t.distance(centroid) <= radius]
    lon, lat = lonlat(centroid.x, centroid.y)
    context = Context(Origin(lon, lat, round(centroid.x, 2), round(centroid.y, 2)), radius, buildings, trees)

    # Permits within the nearby radius.
    near = [p for p in lot.permit_points if p.distance(centroid) <= cfg.nearby_permits_radius_m]
    permits = PermitsNearby(cfg.nearby_permits_radius_m, cfg.permits_since, len(near),
                            [lonlat(p.x, p.y) for p in near],
                            [(round(p.x - centroid.x, 2), round(p.y - centroid.y, 2)) for p in near])

    if lot.address_point is not None:
        alon, alat = lonlat(lot.address_point.x, lot.address_point.y)
    else:
        alon, alat = lon, lat
    meta = Meta(ENGINE_VERSION, designs.version, cfg.version, dict(data_dates or {}), copy_.disclaimer("screening"),
                datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), False)
    return CheckResult(Address(lot.address_id, lot.address_full, alon, alat), lot_out, design_results,
                       copy_.not_checked_labels(), permits, context, meta)
