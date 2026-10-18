"""The numbers map and allowed numbers (MASTERSPEC 7.3).

Every number the model may mention is a key in the numbers map, `{key: {value, unit, label,
source_url}}`. The model writes `{{key}}`; the renderer fills in the value. `allowed_numbers` is
the set of literal strings the validator accepts in prose.
"""
from __future__ import annotations

import re
from functools import cache
from typing import Any

from ai.config import (
    ALLOWED_YEARS,
    BYLAW_NUMBERS,
    ELECTION_DAY,
    PROMPTS_DIR,
    SOURCE_URLS,
    contract,
    load_json,
)

# Which rule-row fields feed which keys: rule_id -> (key for `required`, key for `actual`, key for `margin`).
# In the units row the engine puts the design's homes in `required` and the lot's allowance in `actual`.
RULE_KEYS: dict[str, tuple[str | None, str | None, str | None]] = {
    "lot_width": ("lot_width_required", "lot_width_actual", "lot_width_margin"),
    "lot_depth": ("lot_depth_required", "lot_depth_actual", "lot_depth_margin"),
    "building_length": ("building_length_allowed", "building_length_design", None),
    "height": ("height_allowed", "height_design", None),
    "lot_coverage": ("coverage_allowed_pct", "coverage_actual_pct", None),
    "units_allowed": ("units_design", "units_allowed", None),
}

RESULT_ORDER = ("fits", "borderline", "no_fit", "not_checked")


def _labels(lang: str = "en") -> dict[str, str]:
    """The number labels in `lang` where numbers.json has them (labels_fr), English otherwise."""
    copy = load_json(PROMPTS_DIR / "numbers.json")
    return {**copy["labels"], **copy.get(f"labels_{lang}", {})}


def _top_rule_labels(lang: str = "en") -> dict[str, str]:
    copy = load_json(PROMPTS_DIR / "numbers.json")
    return {**copy["top_rule_count"], **copy.get(f"top_rule_count_{lang}", {})}


def design_name(design_id: str) -> str:
    return contract("copy/labels.json")["designs"][design_id]


def design_spec(design_id: str) -> dict:
    return next(d for d in contract("designs.json")["designs"] if d["id"] == design_id)


def pick_design(check: dict, design_id: str | None) -> dict:
    """The chosen design's result, or the best one (fits, then borderline, then no_fit) when none is chosen."""
    designs = check["designs"]
    if design_id is not None:
        return next(d for d in designs if d["design_id"] == design_id)
    return min(designs, key=lambda d: RESULT_ORDER.index(d["result"]))


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def build_check_numbers(
    check: dict, design_id: str | None, *, web_url: str, ai_url: str, lang: str = "en"
) -> tuple[str, dict[str, dict]]:
    """Returns (design_id, numbers map) for one design of a CheckResponse, labelled in `lang`."""
    design = pick_design(check, design_id)
    did = design["design_id"]
    name = design_name(did)
    spec = design_spec(did)
    labels = _labels(lang)
    cfg = contract("engine_config.json")
    lot = check["lot"]
    address_id = check["address"]["address_id"]

    checklist = f"{web_url}/?a={address_id}#checklist" if address_id else f"{web_url}/?lot={lot['lot_id']}#checklist"
    methodology = f"{ai_url}/b/{lot['ward_id']}#methodology"
    sources = {
        "lot_width_actual": SOURCE_URLS["property_boundaries"],
        "lot_depth_actual": SOURCE_URLS["property_boundaries"],
        "lot_area_m2": SOURCE_URLS["property_boundaries"],
        "building_length_design": spec["source"]["url"],
        "height_design": spec["source"]["url"],
        "units_design": spec["source"]["url"],
        "design_bedrooms": spec["source"]["url"],
        "permits_nearby_count": SOURCE_URLS["building_permits"],
        "permits_nearby_radius_m": methodology,
        "uncertainty_band_m": methodology,
        "uncertainty_band_coverage_pp": methodology,
    }

    numbers: dict[str, dict] = {}

    def add(key: str, value: Any, unit: str | None) -> None:
        if _is_number(value):
            numbers[key] = {
                "value": value,
                "unit": unit,
                "label": labels[key].format(design=name),
                "source_url": sources.get(key, checklist),
            }

    for row in design["rules"]:
        keys = RULE_KEYS.get(row["rule_id"])
        if keys is None or row["not_applicable"]:
            continue
        for key, field in zip(keys, ("required", "actual", "margin")):
            if key is not None:
                value = row[field]
                if field == "margin" and _is_number(value):
                    value = abs(value)  # a difference to name ("short by"), never a signed number to misread
                add(key, value, row["unit"])

    permits = check["permits_nearby"]
    add("permits_nearby_count", permits["count"], None)
    add("permits_nearby_radius_m", permits["radius_m"], "m")
    add("lot_area_m2", lot["area_m2"], "m2")
    add("design_bedrooms", spec["bedrooms"], None)
    add("uncertainty_band_m", cfg["uncertainty_band_m"], "m")
    add("uncertainty_band_coverage_pp", cfg["uncertainty_band_coverage_pp"], "pp")
    return did, numbers


def build_ward_numbers(ward: dict, *, web_url: str, lang: str = "en") -> dict[str, dict]:
    """The numbers map for one ward (a WardSummaryEntry, or a WardResponse with its urls), labelled in `lang`."""
    labels = _labels(lang)
    ward_map = f"{web_url}/?ward={ward['ward_id']}"
    permits_url = SOURCE_URLS["building_permits"]
    headline, any_design, permits = ward["headline"], ward["any_design"], ward["permits"]
    numbers: dict[str, dict] = {}

    def add(key: str, value: Any, unit: str | None, label: str, source_url: str = ward_map) -> None:
        if _is_number(value):
            numbers[key] = {"value": value, "unit": unit, "label": label, "source_url": source_url}

    add("could_lots", headline["could"], None, labels["could_lots"])
    add("could_pct", headline["could_pct_of_house_lots"], "pct", labels["could_pct"])
    add("did_permits", headline["did"], None, labels["did_permits"], permits_url)
    add("lots_per_permit", headline["lots_per_permit"], None, labels["lots_per_permit"])
    add("borderline_lots", any_design["borderline"], None, labels["borderline_lots"])
    add("nofit_lots", any_design["no_fit"], None, labels["nofit_lots"])
    add("not_checked_lots", any_design["not_checked"], None, labels["not_checked_lots"])
    add("house_lots", ward["house_lots"], None, labels["house_lots"])
    add("attached_pct", ward["attached_share_pct"], "pct", labels["attached_pct"])
    if ward["top_blocking_rules"]:
        top = ward["top_blocking_rules"][0]
        add("top_rule_count", top["count"], None, _top_rule_labels(lang)[top["rule_id"]])
    add("flagged_fitting_lots", ward["flags"]["any_on_fitting_lots"], None, labels["flagged_fitting_lots"])
    first_year = int(contract("engine_config.json")["permits_since"][:4])
    for year, count in sorted(permits["by_year"].items()):
        if int(year) >= first_year:
            add(f"permits_{year}", count, None, labels["permits_year"].format(year=year), permits_url)
    add("units_since_may_2023", permits["units_since_may_2023"], None, labels["units_since_may_2023"], permits_url)
    for design_id, counts in ward["by_design"].items():
        add(f"by_design_{design_id}_fits", counts["fits"], None,
            labels["by_design_fits"].format(design=design_name(design_id)))
    return numbers


# --- allowed numbers ---------------------------------------------------------------------------


def _plain(value: float) -> str:
    text = f"{value:.6f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def literal_forms(value: float) -> set[str]:
    """Raw, rounded to 0 and 1 decimals, with and without thousands separators; magnitudes too,
    so a negative margin can be written as a positive difference."""
    forms: set[str] = set()
    for v in {value, abs(value)}:
        forms |= {_plain(v), f"{v:.0f}", f"{v:.1f}", f"{v:,.0f}", f"{v:,.1f}"}
        if "." in _plain(v):
            forms.add(f"{v:,.{len(_plain(v).split('.')[1])}f}")
    return forms


def _numbers_in(obj: Any) -> list[float]:
    if _is_number(obj):
        return [obj]
    if isinstance(obj, dict):
        return [n for v in obj.values() for n in _numbers_in(v)]
    if isinstance(obj, list):
        return [n for v in obj for n in _numbers_in(v)]
    return []


DESIGN_DIMENSIONS = (
    "units", "bedrooms", "width_m", "length_m", "height_m", "building_area_m2", "gfa_m2", "side_yards_m",
    "front_setback_m", "rear_setback_m", "min_lot_width_m", "min_lot_depth_m", "top_floor_stepback_m",
)


@cache
def _base_allowed() -> frozenset[str]:
    cfg = contract("engine_config.json")
    values: list[float] = [*ALLOWED_YEARS, ELECTION_DAY, *BYLAW_NUMBERS]
    values += [cfg["nearby_permits_radius_m"], cfg["uncertainty_band_m"], cfg["uncertainty_band_coverage_pp"]]
    for design in contract("designs.json")["designs"]:
        for key in DESIGN_DIMENSIONS:
            values += _numbers_in(design.get(key))
    return frozenset(form for v in values for form in literal_forms(v))


def base_allowed_numbers() -> set[str]:
    """The fixed allow-list: years, election day, by-law numbers, design dimensions, radius, band."""
    return set(_base_allowed())


def allowed_numbers(numbers: dict[str, dict]) -> set[str]:
    allowed = base_allowed_numbers()
    for entry in numbers.values():
        allowed |= literal_forms(entry["value"])
    return allowed


# --- rendering ---------------------------------------------------------------------------------

# Decimal and grouping separators per language, the way Intl.NumberFormat writes them.
SEPARATORS = {"fr": (",", " "), "es": (",", "."), "pt": (",", ".")}
_PLACEHOLDER = re.compile(r"\{\{([a-z0-9_]+)\}\}")


def format_number(value: float, lang: str) -> str:
    decimal, group = SEPARATORS.get(lang, (".", ","))
    text = _plain(value)
    whole, _, frac = text.partition(".")
    sign = "-" if whole.startswith("-") else ""
    whole = f"{int(whole.lstrip('-')):,}".replace(",", group)
    return sign + whole + (decimal + frac if frac else "")


def render(template_text: str, numbers: dict[str, dict], lang: str) -> str:
    return _PLACEHOLDER.sub(lambda m: format_number(numbers[m.group(1)]["value"], lang), template_text)


def used(template_text: str, numbers: dict[str, dict]) -> dict[str, dict]:
    """The part of the numbers map a text actually uses, in the order it first uses them."""
    keys = dict.fromkeys(_PLACEHOLDER.findall(template_text))
    return {k: numbers[k] for k in keys if k in numbers}
