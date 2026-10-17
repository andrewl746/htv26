"""Dataclasses mirroring /contracts/types.ts (MASTERSPEC Appendix A), plus the engine's input model.

Output classes serialize with `to_dict()` to the exact JSON shape of `CheckResponse`; the API
and the batch run never build that JSON by hand.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from shapely.geometry import Point, Polygon
from shapely.geometry.base import BaseGeometry

Coord = tuple[float, float]

# ---------------------------------------------------------------------------
# Inputs (what the API or the batch run hands the engine, all in EPSG:2952 metres)
# ---------------------------------------------------------------------------


@dataclass
class BuildingInput:
    """A 3D Massing footprint near the lot."""

    building_id: int
    geometry: Polygon
    avg_height_m: float
    footprint_m2: float | None = None       # computed from the geometry when None
    parcelid: str | None = None             # the lot it was assigned to by largest overlap

    @property
    def area_m2(self) -> float:
        return self.footprint_m2 if self.footprint_m2 is not None else float(self.geometry.area)


@dataclass
class NeighbourLot:
    """A neighbouring parcel, for the attached-house test."""

    lot_id: str
    geometry: Polygon
    feature_type: str                       # COMMON or CONDO


@dataclass
class LotInput:
    """One row of the `lots` layer (MASTERSPEC 4.4) plus its surroundings."""

    lot_id: str
    geometry: BaseGeometry
    ward_id: str
    ward_name: str
    feature_type: str = "COMMON"
    area_m2: float | None = None            # from the geometry when None
    stated_area: str | None = None
    zn_zone: str | None = None
    zn_string: str | None = None
    gen_zone: int | None = None
    zbl_sectn: str | None = None
    zn_status: int | None = None
    frontage_min_m: float | None = None
    units_max: int | None = None
    ht_overlay_m: float | None = None
    coverage_overlay_pct: float | None = None
    zn_exception: str | None = None         # "Y" / "N"
    exception_no: int | None = None
    sixplex_overlay: bool = False
    flag_heritage_register: bool = False
    flag_heritage_district: bool = False
    flag_ravine: bool = False
    flag_trca: bool = False
    address_count: int = 0
    address_id: str | None = None
    address_full: str | None = None
    address_point: Point | None = None
    corridors: list[BaseGeometry] = field(default_factory=list)
    neighbour_lots: list[NeighbourLot] = field(default_factory=list)
    buildings: list[BuildingInput] = field(default_factory=list)       # within the context radius
    trees: list[Point] = field(default_factory=list)                   # within the context radius
    permit_points: list[Point] = field(default_factory=list)           # multiplex permits since May 2023, any distance

    @property
    def lot_area_m2(self) -> float:
        return self.area_m2 if self.area_m2 is not None else float(self.geometry.area)


# ---------------------------------------------------------------------------
# Output (CheckResponse)
# ---------------------------------------------------------------------------


@dataclass
class Reason:
    id: str
    label: str
    text: str


@dataclass
class Flag:
    id: str
    label: str
    text: str
    source_url: str | None
    detail: str | None


@dataclass
class ZoneInfo:
    zn_zone: str | None
    zn_string: str | None
    gen_zone: int | None
    zbl_sectn: str | None
    zn_status: int | None
    frontage_min_m: float | None
    units_max: int | None
    ht_overlay_m: float | None
    coverage_overlay_pct: float | None
    exception_no: int | None
    sixplex_overlay: bool


@dataclass
class ExistingBuilding:
    building_id: int
    avg_height_m: float
    footprint_m2: float
    footprint_local: list[Coord]


@dataclass
class Lot:
    lot_id: str
    class_: str
    reason: Reason | None
    ward_id: str
    ward_name: str
    zone: ZoneInfo
    width_m: float | None
    depth_m: float | None
    area_m2: float
    stated_area: str | None
    front_bearing_deg: float | None
    frontage_edge_local: tuple[Coord, Coord] | None
    polygon_local: list[Coord]
    polygon_wgs84: list[Coord]
    existing_building: ExistingBuilding | None
    attached: bool
    vacant: bool
    flags: list[Flag]


@dataclass
class RuleRow:
    rule_id: str
    label: str
    required: float | str | None
    actual: float | str | None
    unit: str | None                    # "m" | "pct" | "units" | None
    margin: float | None                # positive = passes by this much
    pass_: bool | None                  # None when not applicable
    borderline: bool
    not_applicable: bool
    bylaw_section: str
    detail: str | None


@dataclass
class DesignResult:
    design_id: str
    result: str
    blocking_rule: str | None
    rules: list[RuleRow]
    placement_local: list[Coord] | None
    buildable_local: list[Coord] | None
    setbacks_local: dict[str, list[Coord]] | None
    fail_slices_local: list[list[Coord]]


@dataclass
class PermitsNearby:
    radius_m: float
    since: str
    count: int
    points: list[Coord]
    points_local: list[Coord]


@dataclass
class ContextBuilding:
    building_id: int
    avg_height_m: float
    kind: str                           # "house" | "large"
    on_lot: bool
    footprint_local: list[Coord]


@dataclass
class Origin:
    lon: float
    lat: float
    x_2952: float
    y_2952: float


@dataclass
class Context:
    origin: Origin
    radius_m: float
    buildings: list[ContextBuilding]
    trees: list[Coord]


@dataclass
class Meta:
    engine_version: str
    designs_version: str
    config_version: str
    data_dates: dict[str, str]
    disclaimer: str
    generated_at: str
    cached: bool


@dataclass
class Address:
    address_id: str | None
    address_full: str | None
    lon: float
    lat: float


@dataclass
class CheckResult:
    """The engine's answer; `to_dict()` is the `CheckResponse` JSON."""

    address: Address
    lot: Lot
    designs: list[DesignResult]
    not_checked: list[str]
    permits_nearby: PermitsNearby
    context: Context
    meta: Meta

    def to_dict(self) -> dict[str, Any]:
        return _clean(asdict(self))


_RENAMES = {"class_": "class", "pass_": "pass"}


def _clean(obj: Any) -> Any:
    """Rename the Python-safe field names and turn tuples into lists."""
    if isinstance(obj, dict):
        return {_RENAMES.get(k, k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    return obj
