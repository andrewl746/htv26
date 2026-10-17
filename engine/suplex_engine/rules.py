"""Rules by zone (MASTERSPEC 5.4): the required values and their Toronto Zoning By-law 569-2013 sections.

Bylaw constants live here beside their section strings. Thresholds that are tunable (the band,
the larger-building and attached tests) live in /contracts/engine_config.json instead.

Section numbers in the RD column were verified against the by-law text; RT and RM were read on
2026-10-17; R and RS use the parallel sections of their chapters (MASTERSPEC 5.4 note).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ZoneCode = Literal["R", "RD", "RS", "RT", "RM"]
HOUSE_ZONES: tuple[ZoneCode, ...] = ("R", "RD", "RS", "RT", "RM")

# Chapter of By-law 569-2013 for each residential house zone.
CHAPTER: dict[str, str] = {"R": "10.10", "RD": "10.20", "RS": "10.40", "RT": "10.60", "RM": "10.80"}

# Bylaw constants (metres, percent, units).
FRONT_SETBACK_M = 6.0
REAR_SETBACK_M = 7.5
REAR_DEPTH_SHARE = 0.25                 # "greater of 7.5 m and 25% of lot depth" in RD, RS, RM
HOUSEPLEX_HEIGHT_M = 10.0               # greater of the height overlay and 10.0 m
HOUSEPLEX_COVERAGE_FLOOR_PCT = 45.0     # By-law 848-2025: never below 45% for a houseplex
BUILDING_LENGTH_M = 17.0
DEEP_LOT_BUILDING_LENGTH_M = 19.0
DEEP_LOT_NARROW_DEPTH_M = 36.0          # 19.0 m allowed on a lot at least 36 m deep with frontage under 10 m
DEEP_LOT_WIDE_DEPTH_M = 40.0            # ... or at least 40 m deep with frontage of 10 m or more
DEEP_LOT_FRONTAGE_SPLIT_M = 10.0
UNITS_CITYWIDE = 4                      # multiplex permissions since May 2023
UNITS_SIXPLEX_OVERLAY = 6               # By-law 654-2025, 600.60.40(1)

# Side-yard brackets by the zone's required minimum frontage (the f value): (upper bound exclusive, yard).
RD_SIDE_BRACKETS: tuple[tuple[float, float], ...] = (
    (6.0, 0.6), (12.0, 0.9), (15.0, 1.2), (18.0, 1.5), (24.0, 1.8), (30.0, 2.4), (float("inf"), 3.0))
RS_SIDE_BRACKETS: tuple[tuple[float, float], ...] = ((6.0, 0.6), (12.0, 0.9), (15.0, 1.2), (float("inf"), 1.5))
R_SIDE_M = 0.9       # 10.10.40.70(3); the 0.45 m blank-wall option is not used
RT_SIDE_M = 0.9      # 10.60.40.70(3)(B), detached houseplex
RM_SIDE_M = 1.2      # 10.80.40.70(3), detached houseplex


@dataclass(frozen=True)
class Requirement:
    """A required value with the section that sets it."""

    value: float | None
    bylaw_section: str
    detail: str | None = None
    not_applicable: bool = False


def zone_code(zn_zone: str | None) -> ZoneCode | None:
    """The house-zone code, or None for every other zone (RA, RAC, CR, E, O, I, UT and so on)."""
    if zn_zone is None:
        return None
    z = str(zn_zone).strip().upper()
    return z if z in HOUSE_ZONES else None  # type: ignore[return-value]


def _ch(zone: str) -> str:
    return CHAPTER[zone]


def front_setback(zone: str) -> Requirement:
    """6.0 m in every house zone; neighbour averaging under 10.5.40.70(1) is not applied."""
    return Requirement(FRONT_SETBACK_M, f"{_ch(zone)}.40.70(1)")


def rear_setback(zone: str, lot_depth_m: float) -> Requirement:
    """7.5 m in R and RT; the greater of 7.5 m and 25% of lot depth in RD, RS and RM."""
    section = f"{_ch(zone)}.40.70(2)"
    if zone in ("R", "RT"):
        return Requirement(REAR_SETBACK_M, section)
    share = REAR_DEPTH_SHARE * lot_depth_m
    if share > REAR_SETBACK_M:
        return Requirement(share, section, f"{int(REAR_DEPTH_SHARE * 100)}% of {_fmt(lot_depth_m)} m")
    return Requirement(REAR_SETBACK_M, section)


def _bracket(brackets: tuple[tuple[float, float], ...], f: float) -> float:
    for upper, yard in brackets:
        if f < upper:
            return yard
    return brackets[-1][1]


def side_yard_min(zone: str, frontage_min_m: float | None, actual_width_m: float) -> Requirement:
    """The zone minimum side yard, each side, for a detached houseplex.

    RD and RS bracket on the zone's required minimum frontage (the f value); when it is -1 or null
    the lot's actual width is used instead and the detail says so.
    """
    ch = _ch(zone)
    if zone == "R":
        return Requirement(R_SIDE_M, f"{ch}.40.70(3)")
    if zone == "RT":
        return Requirement(RT_SIDE_M, f"{ch}.40.70(3)(B)", "detached houseplex")
    if zone == "RM":
        return Requirement(RM_SIDE_M, f"{ch}.40.70(3)", "detached houseplex")
    brackets = RD_SIDE_BRACKETS if zone == "RD" else RS_SIDE_BRACKETS
    if frontage_min_m is None or frontage_min_m < 0:
        yard = _bracket(brackets, actual_width_m)
        return Requirement(yard, f"{ch}.40.70(3)",
                           f"zone has no required frontage; bracket taken from the actual width of {_fmt(actual_width_m)} m")
    yard = _bracket(brackets, float(frontage_min_m))
    return Requirement(yard, f"{ch}.40.70(3)", f"required frontage {_fmt(frontage_min_m)} m")


def _deep_lot(frontage_m: float, depth_m: float) -> bool:
    if frontage_m < DEEP_LOT_FRONTAGE_SPLIT_M:
        return depth_m >= DEEP_LOT_NARROW_DEPTH_M
    return depth_m >= DEEP_LOT_WIDE_DEPTH_M


def building_length_allowed(zone: str, frontage_m: float, depth_m: float) -> Requirement:
    """17.0 m, or 19.0 m for a detached houseplex on a deep lot (RD 10.20.40.20(3) and parallels).

    RT has no building length rule for a houseplex (10.60.40.20 covers townhouses and apartment
    buildings on major streets only), so the rule is not applicable. RM's 17.0 m names detached and
    semi-detached houses and is applied to houseplexes conservatively.
    """
    ch = _ch(zone)
    if zone == "RT":
        return Requirement(None, f"{ch}.40.20", "no building length rule for a houseplex in RT", not_applicable=True)
    if zone == "RM":
        return Requirement(BUILDING_LENGTH_M, f"{ch}.40.20(1)", "17.0 m rule for houses, applied to houseplexes")
    deep_text = (f"19.0 m needs a lot at least {_fmt(DEEP_LOT_NARROW_DEPTH_M)} m deep with frontage under "
                 f"{_fmt(DEEP_LOT_FRONTAGE_SPLIT_M)} m, or at least {_fmt(DEEP_LOT_WIDE_DEPTH_M)} m deep with frontage of "
                 f"{_fmt(DEEP_LOT_FRONTAGE_SPLIT_M)} m or more")
    if _deep_lot(frontage_m, depth_m):
        return Requirement(DEEP_LOT_BUILDING_LENGTH_M, f"{ch}.40.20(3)",
                           f"deep lot: {_fmt(depth_m)} m deep with {_fmt(frontage_m)} m frontage")
    return Requirement(BUILDING_LENGTH_M, f"{ch}.40.20(1)",
                       f"{_fmt(depth_m)} m deep with {_fmt(frontage_m)} m frontage; {deep_text}")


def height_allowed(zone: str, ht_overlay_m: float | None) -> Requirement:
    """The greater of the height overlay value and 10.0 m for a detached houseplex."""
    section = f"{_ch(zone)}.40.10(1)(C)"
    if ht_overlay_m is not None and ht_overlay_m > HOUSEPLEX_HEIGHT_M:
        return Requirement(float(ht_overlay_m), section, f"height overlay {_fmt(ht_overlay_m)} m")
    detail = None if ht_overlay_m is None else f"overlay {_fmt(ht_overlay_m)} m raised to the {_fmt(HOUSEPLEX_HEIGHT_M)} m houseplex minimum"
    return Requirement(HOUSEPLEX_HEIGHT_M, section, detail)


def coverage_allowed(zone: str, coverage_overlay_pct: float | None) -> Requirement:
    """The coverage overlay, never below 45% for a houseplex; not applicable where the overlay has no value."""
    section = f"{_ch(zone)}.30.40(1)(D)"
    if coverage_overlay_pct is None:
        return Requirement(None, section, "no lot coverage overlay here", not_applicable=True)
    if coverage_overlay_pct >= HOUSEPLEX_COVERAGE_FLOOR_PCT:
        return Requirement(float(coverage_overlay_pct), section, f"coverage overlay {_fmt_pct(coverage_overlay_pct)}")
    return Requirement(HOUSEPLEX_COVERAGE_FLOOR_PCT, section,
                       f"overlay {_fmt_pct(coverage_overlay_pct)} raised to the {_fmt_pct(HOUSEPLEX_COVERAGE_FLOOR_PCT)} houseplex minimum")


def units_allowed(sixplex_overlay: bool) -> Requirement:
    """4 homes in every residential zone since May 2023; 6 inside the sixplex overlay (600.60.40(1))."""
    if sixplex_overlay:
        return Requirement(UNITS_SIXPLEX_OVERLAY, "600.60.40(1)", "inside the sixplex overlay")
    return Requirement(UNITS_CITYWIDE, "600.60.40(1)", "outside the sixplex overlay")


def _fmt(x: float) -> str:
    """Metres and percentages for `detail` strings: no trailing zeros beyond one decimal, two when needed."""
    r = round(float(x), 2)
    if abs(r - round(r, 1)) < 1e-9:
        return f"{r:.1f}"
    return f"{r:.2f}"


def _fmt_pct(x: float) -> str:
    """Percentages for `detail` strings: whole numbers without a decimal, otherwise one decimal."""
    r = round(float(x), 1)
    return f"{int(r)}%" if abs(r - int(r)) < 1e-9 else f"{r:.1f}%"
