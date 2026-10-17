"""S4: the validator (MASTERSPEC 7.4). Every case 7.4 lists, plus the edges the policy relies on.

Nothing the AI writes reaches a user unless validate() says ok.
"""
from __future__ import annotations

from ai.numbers import base_allowed_numbers
from ai.validator import validate


def entry(value: float) -> dict:
    return {"value": value, "unit": None, "label": "x", "source_url": "https://example.test/"}


NUMBERS = {"could_lots": entry(1300), "did_permits": entry(81), "permits_2023": entry(14)}


# --- the cases MASTERSPEC 7.4 requires ---------------------------------------------------------


def test_invented_number_is_rejected():
    result = validate("In this ward, about 1,300 lots may fit a free design.", NUMBERS, {"81"})
    assert not result.ok
    assert result.invented == {"1300"}


def test_same_text_with_a_placeholder_is_accepted():
    result = validate("In this ward, about {{could_lots}} lots may fit a free design.", NUMBERS, {"81"})
    assert result.ok
    assert result.invented == set() and result.unknown == set() and result.missing == set()


def test_unknown_placeholder_is_rejected():
    result = validate("{{could_lots}} lots may fit; {{lots_that_will_be_built}} more.", NUMBERS, set())
    assert not result.ok
    assert result.unknown == {"lots_that_will_be_built"}


def test_translation_missing_an_english_placeholder_is_rejected():
    english_keys = {"could_lots", "did_permits"}
    french = "Jusqu'à {{could_lots}} terrains pourraient accueillir un modèle gratuit."
    result = validate(french, NUMBERS, set(), required_keys=english_keys)
    assert not result.ok
    assert result.missing == {"did_permits"}


def test_bylaw_number_and_design_dimension_pass_through_the_allow_list():
    text = "Under By-law 569-2013, the Fourplex Narrow needs 7.6 m of lot width."
    result = validate(text, NUMBERS, base_allowed_numbers())
    assert result.ok, result


def test_counting_designs_is_rejected_when_the_count_is_not_allowed():
    # Intended strictness: the prompt tells the model not to count, so "2" is invented here.
    result = validate("2 of the 4 designs may fit on this lot.", NUMBERS, {"4"})
    assert not result.ok
    assert result.invented == {"2"}


# --- edges the policy depends on ---------------------------------------------------------------


def test_digits_inside_a_placeholder_key_are_not_numbers():
    result = validate("{{permits_2023}} multiplex permits were issued in 2023.", NUMBERS, {"2023"})
    assert result.ok


def test_thousands_separators_are_ignored_on_both_sides():
    assert validate("About 1,300 lots.", NUMBERS, {"1300"}).ok
    assert validate("About 1300 lots.", NUMBERS, {"1,300"}).ok


def test_a_decimal_must_match_exactly():
    assert not validate("It needs 7.65 m.", NUMBERS, {"7.6"}).ok


def test_every_problem_is_reported_at_once():
    result = validate("{{nope}} and 999.", NUMBERS, set(), required_keys={"could_lots"})
    assert (result.unknown, result.missing, result.invented) == ({"nope"}, {"could_lots"}, {"999"})


def test_text_without_numbers_is_accepted():
    assert validate("This is a screening, not a permit.", {}, set()).ok


def test_complaint_names_what_was_wrong_for_the_retry():
    result = validate("About 1,300 lots, {{nope}}.", NUMBERS, set())
    complaint = result.complaint()
    assert "1300" in complaint and "nope" in complaint and "{{placeholders}}" in complaint
