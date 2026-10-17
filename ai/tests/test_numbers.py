"""S3: the numbers map and allowed numbers (MASTERSPEC 7.3), checked against /contracts/fixtures."""
from __future__ import annotations

import pytest

from ai.config import contract
from ai.numbers import allowed_numbers, build_check_numbers, format_number, pick_design, render

REQUEST = contract("fixtures/explain.request.json")
RESPONSE = contract("fixtures/explain.response.json")
URLS = {"web_url": "http://localhost:5173", "ai_url": "http://localhost:8001"}

CHECK_KEYS = {
    "lot_width_actual", "lot_width_required", "lot_width_margin", "lot_depth_actual", "lot_depth_required",
    "lot_depth_margin", "building_length_allowed", "building_length_design", "height_allowed", "height_design",
    "coverage_allowed_pct", "coverage_actual_pct", "units_allowed", "units_design", "permits_nearby_count",
    "permits_nearby_radius_m", "lot_area_m2", "design_bedrooms", "uncertainty_band_m",
    "uncertainty_band_coverage_pp",
}


def test_every_check_key_in_7_3_is_built_for_a_checked_lot():
    design_id, numbers = build_check_numbers(REQUEST["check"], "fourplex_narrow", **URLS)
    assert design_id == "fourplex_narrow"
    assert set(numbers) == CHECK_KEYS


def test_entries_match_the_explain_response_fixture():
    _, numbers = build_check_numbers(REQUEST["check"], "fourplex_narrow", **URLS)
    for key, expected in RESPONSE["numbers"].items():
        assert numbers[key] == expected, key


def test_values_come_from_the_rule_rows():
    _, numbers = build_check_numbers(REQUEST["check"], "fourplex_narrow", **URLS)
    assert numbers["units_design"]["value"] == 4 and numbers["units_allowed"]["value"] == 6
    assert numbers["coverage_actual_pct"]["value"] == 37.1
    assert numbers["lot_width_margin"]["value"] == 0.02


def test_no_design_chosen_picks_the_best_result():
    assert pick_design(REQUEST["check"], None)["design_id"] == "fourplex_narrow"  # the only borderline
    fits = contract("fixtures/check.fits.json")
    assert pick_design(fits, None)["result"] == "fits"


def test_not_checked_lot_keeps_only_lot_level_numbers():
    condo = contract("fixtures/check.not_checked.json")
    _, numbers = build_check_numbers(condo, None, **URLS)
    assert not any(key.startswith(("lot_width", "lot_depth", "height", "coverage")) for key in numbers)
    assert "uncertainty_band_m" in numbers and "permits_nearby_count" in numbers


def test_allowed_numbers_cover_values_rounding_and_magnitudes():
    _, numbers = build_check_numbers(contract("fixtures/check.no_fit.json"), "fourplex_wide", **URLS)
    allowed = allowed_numbers(numbers)
    margin = numbers["lot_width_margin"]["value"]
    assert {str(margin), "2013", "569", "26", "500", "0.5"} <= allowed


def test_margins_are_positive_differences():
    """A failing rule's margin is negative in the engine; the model gets the difference, so it can't present
    "-0.37 m" as the lot's depth (seen on a real lot before this change)."""
    check = contract("fixtures/check.no_fit.json")
    row = next(r for r in pick_design(check, "fourplex_wide")["rules"] if r["rule_id"] == "lot_width")
    _, numbers = build_check_numbers(check, "fourplex_wide", **URLS)
    assert row["margin"] < 0 and numbers["lot_width_margin"]["value"] == abs(row["margin"])
    assert numbers["lot_width_margin"]["label"].startswith("Difference between")


@pytest.mark.parametrize(
    ("value", "lang", "expected"),
    [(7.6, "en", "7.6"), (7.62, "en", "7.62"), (1300, "en", "1,300"), (1300.5, "fr", "1 300,5"), (8.0, "es", "8")],
)
def test_format_number(value, lang, expected):
    assert format_number(value, lang) == expected


def test_render_reproduces_the_fixture_text():
    assert render(RESPONSE["template_text"], RESPONSE["numbers"], "en") == RESPONSE["text"]
