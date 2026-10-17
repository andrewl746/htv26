"""Lot classification (MASTERSPEC 5.3), first match wins, and the flags (5.8).

Footprints are clipped to the lot before `vacant`, the existing building and the larger-building
footprint test are decided: one 3D Massing polygon often covers a whole row of houses, so neither
its whole area nor the pipeline's `parcelid` says what stands on this lot (5.3; section 0 item 6).
The attached test (5.7) still uses the unclipped footprint, which is what crosses the lot line.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

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

INFORMATIONAL_FLAGS = ("site_exception",)
"""Flags that inform but never ask for extra review (MASTERSPEC section 0 item 7: 88% of Ward 04 lots
carry a site exception, so the flag says nothing on its own). They are listed on the address check
(`CheckResponse.lot.flags`), never drawn as an icon on the map (`LotFeatureProps.f`) and never counted in
`flags.any_on_fitting_lots` ("need extra review"); `ward_summary.flags.site_exception` still counts every
lot that carries the flag."""


@dataclass(frozen=True)
class LotFootprint:
    """A building and its footprint clipped to the lot: the part that stands on this lot."""

    building: BuildingInput
    clip: BaseGeometry

    @property
    def area_m2(self) -> float:
        return float(self.clip.area)


@dataclass
class Classification:
    class_: str
    attached: bool
    vacant: bool
    existing: LotFootprint | None           # the largest clipped footprint on the lot (over the vacant threshold)
    footprints_on_lot: list[LotFootprint]


def clip_to_lot(footprint: BaseGeometry, lot: BaseGeometry) -> BaseGeometry:
    """`footprint` intersected with `lot`; a footprint wholly on the lot comes back unchanged (same ring)."""
    return footprint if lot.covers(footprint) else footprint.intersection(lot)


def buildings_on_lot(lot: LotInput, min_area_m2: float) -> list[LotFootprint]:
    """Footprints whose clip to the lot is over the vacant threshold, largest clip first."""
    out = []
    for b in lot.buildings:
        if b.geometry is None or b.geometry.is_empty:
            continue
        clip = clip_to_lot(b.geometry, lot.geometry)
        if clip.area > min_area_m2:
            out.append(LotFootprint(b, clip))
    out.sort(key=lambda f: -f.area_m2)
    return out


def _is_larger_building(lot: LotInput, on_lot: list[LotFootprint], cfg: EngineConfig) -> bool:
    lb = cfg.larger_building
    if lot.address_count >= lb.address_points:
        return True
    for f in on_lot:
        if f.building.avg_height_m is not None and f.building.avg_height_m > lb.avg_height_m:
            return True
        if f.area_m2 > lb.footprint_m2:       # the clipped area, not the whole massing polygon
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


def exception_ref(exception_no: int) -> str:
    """The by-law's notation for a site-specific exception number, as in a zone string's "(x1234)"."""
    return f"x{exception_no}"


def _flag_text(fid: str, entry: dict[str, Any], detail: str | None) -> str:
    """The flag's sentence; the site exception's names its number when the zone row has one."""
    if fid == "site_exception":
        return entry["text"].replace("{exception}", detail) if detail is not None else entry["text_without_number"]
    return entry["text"]


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
        present["site_exception"] = exception_ref(lot.exception_no) if lot.exception_no is not None else None
    if vacant:
        present["vacant"] = None
    out = []
    for fid in FLAG_ORDER:
        if fid in present:
            c = copy_.flag_copy(fid)
            detail = present[fid]
            out.append(Flag(id=fid, label=c["label"], text=_flag_text(fid, c, detail), source_url=c.get("source_url"),
                            detail=detail))
    return out


def review_flags(flags: list[Flag]) -> list[Flag]:
    """The flags that count toward extra review: for the map's `f` and `flags.any_on_fitting_lots`."""
    return [f for f in flags if f.id not in INFORMATIONAL_FLAGS]


def should_drop(feature_type: str | None) -> bool:
    return (feature_type or "").upper() in DROPPED_FEATURE_TYPES


def lot_geometry_is_polygonal(geom: BaseGeometry) -> bool:
    return geom is not None and not geom.is_empty and geom.geom_type in ("Polygon", "MultiPolygon")
