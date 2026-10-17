"""Lot classification (MASTERSPEC 5.3), first match wins, and the flags (5.8)."""
from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry.base import BaseGeometry

from . import copy as copy_
from .attached import is_attached
from .config import EngineConfig
from .geometry import LotGeometry
from .models import BuildingInput, Flag, LotInput
from .rules import zone_code

DROPPED_FEATURE_TYPES = ("CORRIDOR", "RESERVE")
NOT_CHECKED_CLASSES = ("condo", "non_residential", "older_bylaw", "larger_building", "unmeasurable")
FLAG_ORDER = ("heritage_register", "heritage_district", "ravine", "trca", "site_exception", "vacant")


@dataclass
class Classification:
    class_: str
    attached: bool
    vacant: bool
    existing: BuildingInput | None          # the largest footprint on the lot (over the vacant threshold)
    footprints_on_lot: list[BuildingInput]


def buildings_on_lot(lot: LotInput, min_area_m2: float) -> list[BuildingInput]:
    """Footprints that sit on the lot by more than the vacant threshold, largest overlap first."""
    out = []
    for b in lot.buildings:
        if b.geometry is None or b.geometry.is_empty:
            continue
        overlap = b.geometry.intersection(lot.geometry).area
        if overlap > min_area_m2:
            out.append((overlap, b))
    out.sort(key=lambda t: -t[0])
    return [b for _, b in out]


def _is_larger_building(lot: LotInput, on_lot: list[BuildingInput], cfg: EngineConfig) -> bool:
    lb = cfg.larger_building
    if lot.address_count >= lb.address_points:
        return True
    for b in on_lot:
        if b.avg_height_m is not None and b.avg_height_m > lb.avg_height_m:
            return True
        if b.area_m2 > lb.footprint_m2:
            return True
    return False


def classify(lot: LotInput, geo: LotGeometry | None, cfg: EngineConfig) -> Classification:
    """Apply the 5.3 table. `geo` may be None when the lot was never measured (rows 1 to 5)."""
    on_lot = buildings_on_lot(lot, cfg.vacant_min_footprint_m2)
    existing = on_lot[0] if on_lot else None
    vacant = existing is None
    attached = False

    ft = (lot.feature_type or "").upper()
    if ft == "CONDO":
        cls = "condo"
    elif zone_code(lot.zn_zone) is None:
        cls = "older_bylaw" if lot.zn_zone is None else "non_residential"
    elif lot.zn_status == 5:
        cls = "older_bylaw"
    elif _is_larger_building(lot, on_lot, cfg):
        cls = "larger_building"
    elif geo is None or geo.unmeasurable:
        cls = "unmeasurable"
    else:
        attached = is_attached(lot.geometry, lot.neighbour_lots, [b.geometry for b in lot.buildings], cfg)
        cls = "attached" if attached else "checked"
    return Classification(class_=cls, attached=attached, vacant=vacant, existing=existing, footprints_on_lot=on_lot)


def flags_for(lot: LotInput, vacant: bool) -> list[Flag]:
    """Flags in the fixed order; copy from contracts/copy/reasons.json."""
    present: dict[str, str | None] = {}
    if lot.flag_heritage_register:
        present["heritage_register"] = None
    if lot.flag_heritage_district:
        present["heritage_district"] = None
    if lot.flag_ravine:
        present["ravine"] = None
    if lot.flag_trca:
        present["trca"] = None
    if (lot.zn_exception or "").upper() == "Y" or lot.exception_no is not None:
        present["site_exception"] = f"Exception {lot.exception_no}" if lot.exception_no is not None else None
    if vacant:
        present["vacant"] = None
    out = []
    for fid in FLAG_ORDER:
        if fid in present:
            c = copy_.flag_copy(fid)
            out.append(Flag(id=fid, label=c["label"], text=c["text"], source_url=c.get("source_url"), detail=present[fid]))
    return out


def should_drop(feature_type: str | None) -> bool:
    return (feature_type or "").upper() in DROPPED_FEATURE_TYPES


def lot_geometry_is_polygonal(geom: BaseGeometry) -> bool:
    return geom is not None and not geom.is_empty and geom.geom_type in ("Polygon", "MultiPolygon")
