"""Loader for /contracts/designs.json (MASTERSPEC Appendix B): the City's four free multiplex designs."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import contracts_dir


@dataclass(frozen=True)
class Design:
    id: str
    key: str
    name: str
    units: int
    bedrooms: int
    width_m: float
    length_m: float
    height_m: float
    storeys: int
    building_area_m2: float
    gfa_m2: float
    side_yards_m: tuple[float, float]           # (left, right) as seen from the street
    front_setback_m: float
    rear_setback_m: float
    min_lot_width_m: float
    min_lot_depth_m: dict[str, float]
    where_allowed: str                          # "all_residential" | "sixplex_overlay"
    top_floor_stepback_m: float
    homes: tuple[dict[str, Any], ...]
    levels: tuple[dict[str, Any], ...]
    source: dict[str, Any]

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Design:
        return cls(
            id=d["id"], key=d["key"], name=d["name"], units=int(d["units"]), bedrooms=int(d["bedrooms"]),
            width_m=float(d["width_m"]), length_m=float(d["length_m"]), height_m=float(d["height_m"]),
            storeys=int(d["storeys"]), building_area_m2=float(d["building_area_m2"]), gfa_m2=float(d["gfa_m2"]),
            side_yards_m=(float(d["side_yards_m"][0]), float(d["side_yards_m"][1])),
            front_setback_m=float(d["front_setback_m"]), rear_setback_m=float(d["rear_setback_m"]),
            min_lot_width_m=float(d["min_lot_width_m"]), min_lot_depth_m=dict(d["min_lot_depth_m"]),
            where_allowed=d["where_allowed"], top_floor_stepback_m=float(d["top_floor_stepback_m"]),
            homes=tuple(d["homes"]), levels=tuple(d["levels"]), source=dict(d["source"]),
        )


@dataclass(frozen=True)
class DesignsFile:
    version: str
    released: str
    designs: tuple[Design, ...]

    @property
    def by_id(self) -> dict[str, Design]:
        return {d.id: d for d in self.designs}


@lru_cache(maxsize=4)
def _load(path: str) -> DesignsFile:
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    return DesignsFile(version=d["version"], released=d["released"],
                       designs=tuple(Design.from_dict(x) for x in d["designs"]))


def load_designs(path: str | os.PathLike | None = None) -> DesignsFile:
    p = Path(path) if path is not None else contracts_dir() / "designs.json"
    return _load(str(p.resolve()))


def required_side_yards(design: Design, zone_min_m: float) -> tuple[float, float]:
    """Each yard is the larger of the design's own side yard and the zone minimum (MASTERSPEC 5.5 step 3)."""
    left, right = design.side_yards_m
    return max(left, zone_min_m), max(right, zone_min_m)
