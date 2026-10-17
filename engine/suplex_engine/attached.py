"""Attached houses (MASTERSPEC 5.7): semis and row houses, detected from 3D Massing footprints.

A lot is attached when a footprint on it also extends into a neighbouring COMMON lot by more than
`attached.cross_lot_m2`, or when a footprint on this lot touches a footprint on a neighbouring lot
along a shared edge longer than `attached.shared_edge_m` (within `attached.tolerance_m`). The
footprint must sit on the lot by more than `attached.on_lot_m2`. All four numbers live in
/contracts/engine_config.json.
"""
from __future__ import annotations

from collections.abc import Iterable

from shapely.geometry.base import BaseGeometry

from .config import EngineConfig
from .models import NeighbourLot


def footprints_on_lot(lot: BaseGeometry, footprints: Iterable[BaseGeometry], min_area_m2: float) -> list[BaseGeometry]:
    return [f for f in footprints if f is not None and not f.is_empty and f.intersection(lot).area > min_area_m2]


def shared_edge_length(a: BaseGeometry, b: BaseGeometry, tolerance_m: float) -> float:
    """Length of b's boundary that runs within `tolerance_m` of a's boundary."""
    if a.distance(b) > tolerance_m:
        return 0.0
    return float(b.boundary.intersection(a.boundary.buffer(tolerance_m)).length)


def is_attached(lot: BaseGeometry, neighbours: Iterable[NeighbourLot], footprints: Iterable[BaseGeometry],
                cfg: EngineConfig) -> bool:
    a = cfg.attached
    footprints = [f for f in footprints if f is not None and not f.is_empty]
    on_lot = footprints_on_lot(lot, footprints, a.on_lot_m2)
    if not on_lot:
        return False
    neighbour_list = [n for n in neighbours if n.geometry is not None and not n.geometry.is_empty]
    common = [n.geometry for n in neighbour_list if (n.feature_type or "").upper() == "COMMON"]

    # Case 1: one footprint crossing the side lot line (the usual semi or row).
    for f in on_lot:
        for g in common:
            if f.intersection(g).area > a.cross_lot_m2:
                return True

    # Case 2: this lot's footprint touching a neighbour's footprint along a shared wall.
    others = [f for f in footprints if f not in on_lot]
    for f in on_lot:
        for o in others:
            if o.intersection(lot).area > a.on_lot_m2:
                continue                      # also on this lot: not a neighbour's building
            if shared_edge_length(f, o, a.tolerance_m) > a.shared_edge_m:
                return True
    return False
