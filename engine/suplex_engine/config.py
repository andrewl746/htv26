"""Loader for /contracts/engine_config.json (MASTERSPEC Appendix C).

The uncertainty band, every threshold and every radius live in that file. Nothing in the engine
may hold one of these numbers as a literal.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent
_DEFAULT_CONTRACTS_DIR = _PACKAGE_DIR.parent.parent / "contracts"


def contracts_dir() -> Path:
    """The /contracts folder: SUPLEX_CONTRACTS_DIR if set, else the repo's own."""
    return Path(os.environ.get("SUPLEX_CONTRACTS_DIR", _DEFAULT_CONTRACTS_DIR))


@dataclass(frozen=True)
class LargerBuilding:
    avg_height_m: float
    footprint_m2: float
    address_points: int


@dataclass(frozen=True)
class Attached:
    on_lot_m2: float
    cross_lot_m2: float
    shared_edge_m: float
    tolerance_m: float


@dataclass(frozen=True)
class StreetEdge:
    corridor_distance_m: float
    merge_angle_deg: float
    min_length_m: float


@dataclass(frozen=True)
class EngineConfig:
    version: str
    uncertainty_band_m: float
    uncertainty_band_coverage_pp: float
    larger_building: LargerBuilding
    attached: Attached
    vacant_min_footprint_m2: float
    street_edge: StreetEdge
    sample_step_m: float
    nearby_permits_radius_m: float
    context_radius_m: float
    permits_since: str
    permits_trend_since: str
    sixplex_wards: tuple[str, ...]
    partial_sixplex_wards: tuple[str, ...]

    @classmethod
    def from_dict(cls, d: dict) -> EngineConfig:
        return cls(
            version=d["version"],
            uncertainty_band_m=float(d["uncertainty_band_m"]),
            uncertainty_band_coverage_pp=float(d["uncertainty_band_coverage_pp"]),
            larger_building=LargerBuilding(**d["larger_building"]),
            attached=Attached(**d["attached"]),
            vacant_min_footprint_m2=float(d["vacant_min_footprint_m2"]),
            street_edge=StreetEdge(**d["street_edge"]),
            sample_step_m=float(d["sample_step_m"]),
            nearby_permits_radius_m=float(d["nearby_permits_radius_m"]),
            context_radius_m=float(d["context_radius_m"]),
            permits_since=d["permits_since"],
            permits_trend_since=d["permits_trend_since"],
            sixplex_wards=tuple(d["sixplex_wards"]),
            partial_sixplex_wards=tuple(d["partial_sixplex_wards"]),
        )


@lru_cache(maxsize=4)
def _load(path: str) -> EngineConfig:
    with open(path, encoding="utf-8") as f:
        return EngineConfig.from_dict(json.load(f))


def load_config(path: str | os.PathLike | None = None) -> EngineConfig:
    """Read engine_config.json (cached per path)."""
    p = Path(path) if path is not None else contracts_dir() / "engine_config.json"
    return _load(str(p.resolve()))
