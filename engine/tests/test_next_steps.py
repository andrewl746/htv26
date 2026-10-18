"""Y13 tests for suplex_engine.next_steps (MASTERSPEC 5.10): every trigger, the display order, at-most-once, the
borderline why line, and the six real lots in the 5.10 table.

The tests run against a TEST-LOCAL synthetic copy dict (the shape of contracts/copy/next_steps.json), so they do not
depend on the real copy file; one test checks the real file when it exists.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from types import SimpleNamespace

import pytest

from suplex_engine.config import contracts_dir
from suplex_engine.models import DesignResult, Flag, Lot, NextStep, RuleRow
from suplex_engine.next_steps import build_next_steps

DESIGN_IDS = ("fourplex_narrow", "fourplex_wide", "sixplex_narrow", "sixplex_wide")
STEP_ORDER = (
    "survey", "zoning_check", "site_exception",
    "heritage", "ravine", "trca", "trees",
    "designer", "permit", "demolition", "fees",
    "attached_options", "custom_or_variance", "ask_zoning",
)
STEP_GROUPS = {
    "survey": "confirm", "zoning_check": "confirm", "site_exception": "confirm",
    "heritage": "approvals", "ravine": "approvals", "trca": "approvals", "trees": "approvals",
    "designer": "apply", "permit": "apply", "demolition": "apply", "fees": "apply",
    "attached_options": "alternatives", "custom_or_variance": "alternatives", "ask_zoning": "alternatives",
}
NOT_CHECKED_CLASSES = ("condo", "non_residential", "older_bylaw", "larger_building", "unmeasurable")

WHY = {
    "borderline": "BL design={design} rule={rule} actual={actual} required={required}",
    "borderline_pct": "BLP design={design} rule={rule} actual={actual} required={required}",
    "any_fit": "ANY_FIT",
    "flag": "FLAG {flag_label}",
    "flag_alias": "FLAG {flag}",
    "has_building": "HAS_BUILDING",
    "attached": "ATTACHED",
    "no_fit": "NO_FIT",
    "not_checked": "NOT_CHECKED reason={reason}",
}


def _step_copy(step_id: str) -> dict:
    return {
        "group": STEP_GROUPS[step_id],
        "title": f"Title of {step_id}",
        "text": f"Text of {step_id}.",
        "who": f"Who for {step_id}",
        "links": [{"label": f"Link {step_id}", "url": f"https://example.test/{step_id}"}],
        "sources": [{"url": f"https://example.test/{step_id}", "quote": "never shown"}],
    }


def make_copy() -> dict:
    steps = {sid: _step_copy(sid) for sid in STEP_ORDER}
    steps["site_exception"]["title"] = "Exception x{number} applies"
    steps["site_exception"]["text"] = "Your zone carries site-specific exception x{number}."
    return {
        "checked_on": "2026-10-17",
        "groups": {"confirm": "Confirm first", "approvals": "Other approvals for this lot",
                   "apply": "Apply with a City design", "alternatives": "If the free designs don't fit"},
        "footer": "Screening only, not a permit or legal advice. Checked on {checked_on}.",
        "steps": steps,
        "why": dict(WHY),
    }


COPY = make_copy()


# ---------- builders ----------

def _rule(rule_id="lot_width", required=7.6, actual=7.62, unit="m", margin=0.02, borderline=False, passes=True):
    return RuleRow(rule_id=rule_id, label=rule_id, required=required, actual=actual, unit=unit, margin=margin,
                   pass_=passes, borderline=borderline, not_applicable=False, bylaw_section="x", detail=None)


def _design(design_id: str, result: str, rules: list[RuleRow] | None = None) -> DesignResult:
    return DesignResult(design_id=design_id, result=result, blocking_rule=None, rules=rules or [],
                        placement_local=None, buildable_local=None, setbacks_local=None, fail_slices_local=[])


def _flag(flag_id: str, detail: str | None = None, label: str | None = None) -> Flag:
    return Flag(id=flag_id, label=label or flag_id.replace("_", " ").capitalize(), text="", source_url=None,
                detail=detail)


def make_result(class_="checked", results=("fits",) * 4, flags=(), vacant=False, rules=None, reason_label=None):
    """A CheckResult-like object with only what next_steps reads. `rules` maps design index -> rule rows."""
    designs = [_design(did, res, (rules or {}).get(i)) for i, (did, res) in enumerate(zip(DESIGN_IDS, results))]
    reason = SimpleNamespace(id=class_, label=reason_label or f"{class_} label", text="x") if class_ != "checked" else None
    lot = Lot(lot_id="1", class_=class_, reason=reason, ward_id="04", ward_name="W", zone=None, width_m=None,
              depth_m=None, area_m2=0.0, stated_area=None, front_bearing_deg=None, frontage_edge_local=None,
              polygon_local=[], polygon_wgs84=[], existing_building=None, attached=class_ == "attached",
              vacant=vacant, flags=list(flags))
    return SimpleNamespace(lot=lot, designs=designs)


def ids(steps: list[NextStep]) -> list[str]:
    return [s.id for s in steps]


def by_id(steps: list[NextStep], step_id: str) -> NextStep:
    return next(s for s in steps if s.id == step_id)


FIT_BASE = ["survey", "zoning_check", "trees", "designer", "permit", "demolition", "fees"]


# ---------- shape ----------

def test_returns_next_step_objects_filled_from_copy():
    steps = build_next_steps(make_result(), COPY)
    survey = by_id(steps, "survey")
    assert isinstance(survey, NextStep)
    assert survey.group == "confirm"
    assert survey.title == "Title of survey"
    assert survey.text == "Text of survey."
    assert survey.who == "Who for survey"
    assert [(link.label, link.url) for link in survey.links] == [("Link survey", "https://example.test/survey")]
    assert survey.why == "ANY_FIT"


def test_serialised_step_matches_the_contract_shape():
    d = asdict(build_next_steps(make_result(), COPY)[0])
    assert set(d) == {"id", "group", "title", "text", "who", "why", "links"}
    assert set(d["links"][0]) == {"label", "url"}


def test_no_copy_means_no_steps():
    """run_check hands {} until contracts/copy/next_steps.json exists."""
    assert build_next_steps(make_result(), {}) == []


def test_sources_are_never_exposed():
    for s in build_next_steps(make_result(), COPY):
        assert "never shown" not in repr(s)


# ---------- triggers ----------

@pytest.mark.parametrize("results", [
    ("fits", "no_fit", "no_fit", "no_fit"),
    ("no_fit", "no_fit", "no_fit", "borderline"),
    ("fits",) * 4,
])
def test_fit_driven_steps_when_any_design_fits_or_borderline(results):
    rules = {i: [_rule(borderline=True)] for i, r in enumerate(results) if r == "borderline"}
    got = ids(build_next_steps(make_result(results=results, rules=rules), COPY))
    for sid in ("survey", "designer", "permit", "demolition", "fees"):
        assert sid in got


def test_fit_driven_steps_absent_when_all_no_fit():
    got = ids(build_next_steps(make_result(results=("no_fit",) * 4), COPY))
    for sid in ("survey", "designer", "permit", "demolition", "fees"):
        assert sid not in got


def test_survey_why_when_a_design_fits_is_any_fit():
    assert by_id(build_next_steps(make_result(), COPY), "survey").why == "ANY_FIT"


def test_zoning_check_and_trees_for_checked_and_attached():
    assert {"zoning_check", "trees"} <= set(ids(build_next_steps(make_result("checked"), COPY)))
    attached = build_next_steps(make_result("attached", results=("not_checked",) * 4), COPY)
    assert {"zoning_check", "trees"} <= set(ids(attached))


@pytest.mark.parametrize("class_", NOT_CHECKED_CLASSES)
def test_zoning_check_and_trees_absent_when_not_checked(class_):
    got = ids(build_next_steps(make_result(class_, results=("not_checked",) * 4), COPY))
    assert "zoning_check" not in got
    assert "trees" not in got


def test_site_exception_fills_number_from_flag_detail():
    steps = build_next_steps(make_result(flags=[_flag("site_exception", detail="1234")]), COPY)
    step = by_id(steps, "site_exception")
    assert step.title == "Exception x1234 applies"
    assert step.text == "Your zone carries site-specific exception x1234."
    assert step.why == "FLAG site exception"


def test_site_exception_number_with_the_engines_x_prefix_is_not_doubled():
    """classify.exception_ref gives detail "x1234"; the copy already says x{number}."""
    step = by_id(build_next_steps(make_result(flags=[_flag("site_exception", detail="x1234")]), COPY), "site_exception")
    assert step.text == "Your zone carries site-specific exception x1234."


def test_site_exception_without_a_number_drops_the_placeholder():
    step = by_id(build_next_steps(make_result(flags=[_flag("site_exception", detail=None)]), COPY), "site_exception")
    assert "{number}" not in step.title + step.text
    assert "x " not in step.text and not step.text.endswith("x.")


def test_site_exception_absent_without_flag():
    assert "site_exception" not in ids(build_next_steps(make_result(), COPY))


@pytest.mark.parametrize("flag_id", ["heritage_register", "heritage_district"])
def test_heritage_from_either_flag(flag_id):
    steps = build_next_steps(make_result(flags=[_flag(flag_id)]), COPY)
    assert by_id(steps, "heritage").why.startswith("FLAG ")


def test_flag_why_also_accepts_the_short_placeholder_name():
    copy = make_copy()
    copy["why"]["flag"] = "Because this lot is {flag}."
    steps = build_next_steps(make_result(flags=[_flag("trca", label="TRCA regulated area")]), copy)
    assert by_id(steps, "trca").why == "Because this lot is TRCA regulated area."


def test_heritage_appears_once_when_both_flags_present():
    steps = build_next_steps(make_result(flags=[_flag("heritage_register"), _flag("heritage_district")]), COPY)
    assert ids(steps).count("heritage") == 1


def test_ravine_and_trca_from_their_flags():
    steps = build_next_steps(make_result(flags=[_flag("ravine"), _flag("trca")]), COPY)
    assert {"ravine", "trca"} <= set(ids(steps))
    assert "ravine" not in ids(build_next_steps(make_result(flags=[_flag("trca")]), COPY))
    assert "trca" not in ids(build_next_steps(make_result(flags=[_flag("ravine")]), COPY))


def test_flag_why_names_the_flag_label_in_sentence_case():
    steps = build_next_steps(make_result(flags=[_flag("ravine", label="Ravine protection area")]), COPY)
    assert by_id(steps, "ravine").why == "FLAG ravine protection area"


def test_vacant_flag_alone_adds_no_step():
    got = ids(build_next_steps(make_result(flags=[_flag("vacant")], vacant=True), COPY))
    assert "demolition" not in got
    assert set(got) == set(FIT_BASE) - {"demolition"}


def test_demolition_present_when_there_is_a_house_and_why_says_so():
    assert by_id(build_next_steps(make_result(vacant=False), COPY), "demolition").why == "HAS_BUILDING"


def test_demolition_absent_when_lot_vacant():
    assert "demolition" not in ids(build_next_steps(make_result(vacant=True), COPY))


def test_designer_permit_fees_why_is_any_fit():
    steps = build_next_steps(make_result(), COPY)
    for sid in ("designer", "permit", "fees"):
        assert by_id(steps, sid).why == "ANY_FIT"


def test_attached_options_for_attached_class():
    steps = build_next_steps(make_result("attached", results=("not_checked",) * 4), COPY)
    assert by_id(steps, "attached_options").why == "ATTACHED"
    assert by_id(steps, "zoning_check").why == "ATTACHED"
    assert by_id(steps, "trees").why == "ATTACHED"
    assert "attached_options" not in ids(build_next_steps(make_result(), COPY))


def test_custom_or_variance_only_when_checked_and_all_no_fit():
    steps = build_next_steps(make_result(results=("no_fit",) * 4), COPY)
    assert by_id(steps, "custom_or_variance").why == "NO_FIT"
    assert by_id(steps, "zoning_check").why == "NO_FIT"
    assert by_id(steps, "trees").why == "NO_FIT"
    # one design that may fit: not shown
    assert "custom_or_variance" not in ids(build_next_steps(make_result(results=("fits", "no_fit", "no_fit", "no_fit")), COPY))
    # attached lots have their own step, not this one
    assert "custom_or_variance" not in ids(
        build_next_steps(make_result("attached", results=("not_checked",) * 4), COPY))


@pytest.mark.parametrize("class_", NOT_CHECKED_CLASSES)
def test_ask_zoning_for_every_not_checked_class(class_):
    steps = build_next_steps(make_result(class_, results=("not_checked",) * 4, reason_label="Condo building"), COPY)
    assert ids(steps) == ["ask_zoning"]
    assert steps[0].why == "NOT_CHECKED reason=condo building"


def test_ask_zoning_reason_is_lowercased_for_the_sentence():
    """The `{reason}` slot sits inside a sentence ("could not check this lot ({reason})"), so it reads lower case."""
    from suplex_engine import next_steps as ns
    assert ns._sentence_case("Condo building") == "condo building"
    assert ns._sentence_case("TRCA regulated area") == "TRCA regulated area"


def test_ask_zoning_placeholder_in_step_text_is_filled():
    copy = make_copy()
    copy["steps"]["ask_zoning"]["text"] = "Suplex could not check this lot ({reason})."
    steps = build_next_steps(make_result("condo", results=("not_checked",) * 4, reason_label="Condo building"), copy)
    assert steps[0].text == "Suplex could not check this lot (condo building)."


def test_ask_zoning_absent_for_checked_and_attached():
    assert "ask_zoning" not in ids(build_next_steps(make_result(), COPY))
    assert "ask_zoning" not in ids(build_next_steps(make_result("attached", results=("not_checked",) * 4), COPY))


def test_flag_steps_also_appear_on_not_checked_lots():
    steps = build_next_steps(make_result("condo", results=("not_checked",) * 4, flags=[_flag("heritage_register")]), COPY)
    assert ids(steps) == ["heritage", "ask_zoning"]


# ---------- order and at-most-once ----------

def test_display_order_with_everything_that_can_co_occur():
    flags = [_flag("heritage_register"), _flag("heritage_district"), _flag("ravine"), _flag("trca"),
             _flag("site_exception", "1"), _flag("vacant")]
    steps = build_next_steps(make_result(flags=flags, vacant=True), COPY)
    assert ids(steps) == ["survey", "zoning_check", "site_exception", "heritage", "ravine", "trca", "trees",
                          "designer", "permit", "fees"]


def test_order_follows_groups_then_catalogue_even_if_copy_lists_steps_differently():
    copy = make_copy()
    copy["steps"] = dict(reversed(list(copy["steps"].items())))
    flags = [_flag("trca"), _flag("site_exception", "1")]
    got = build_next_steps(make_result(flags=flags), copy)
    assert ids(got) == ["survey", "zoning_check", "site_exception", "trca", "trees", "designer", "permit",
                        "demolition", "fees"]
    assert [s.group for s in got] == sorted((s.group for s in got), key=list(COPY["groups"]).index)


def test_each_step_at_most_once():
    flags = [_flag("heritage_register"), _flag("heritage_district"), _flag("ravine"), _flag("ravine")]
    got = ids(build_next_steps(make_result(flags=flags), COPY))
    assert len(got) == len(set(got))


def test_input_is_not_mutated():
    result = make_result(flags=[_flag("site_exception", "9")])
    before = repr(result.lot) + repr(result.designs)
    build_next_steps(result, COPY)
    assert repr(result.lot) + repr(result.designs) == before
    assert COPY["steps"]["site_exception"]["title"] == "Exception x{number} applies"


# ---------- borderline ----------

def _borderline_result(**kw):
    rules = {0: [_rule("lot_width", required=7.6, actual=7.45, margin=-0.15, borderline=True, passes=False)]}
    return make_result(results=("borderline", "no_fit", "no_fit", "no_fit"), rules=rules, **kw)


def test_borderline_survey_first_and_why_names_rule_and_both_values():
    steps = build_next_steps(_borderline_result(), COPY)
    assert steps[0].id == "survey"
    assert steps[0].why == "BL design=Fourplex Narrow rule=lot width actual=7.45 required=7.6"


def test_borderline_values_use_the_checklist_rounding():
    rules = {0: [_rule("lot_depth", required=33.384, actual=33.5, margin=0.116, borderline=True)]}
    steps = build_next_steps(make_result(results=("borderline", "no_fit", "no_fit", "no_fit"), rules=rules), COPY)
    assert steps[0].why == "BL design=Fourplex Narrow rule=lot depth actual=33.5 required=33.38"


def test_borderline_picks_the_borderline_row_not_a_failing_or_comfortable_one():
    rules = {0: [
        _rule("lot_width", required=7.6, actual=9.0, margin=1.4),
        _rule("lot_depth", required=30.0, actual=30.3, margin=0.3, borderline=True),
        _rule("height", required=10.0, actual=9.0, unit="m", margin=1.0),
    ]}
    steps = build_next_steps(make_result(results=("borderline", "no_fit", "no_fit", "no_fit"), rules=rules), COPY)
    assert "rule=lot depth actual=30.3 required=30" in steps[0].why


def test_borderline_names_the_first_borderline_design_in_design_order():
    rules = {
        1: [_rule("lot_width", required=9.04, actual=8.9, margin=-0.14, borderline=True)],
        2: [_rule("lot_width", required=8.3, actual=8.4, margin=0.1, borderline=True)],
    }
    steps = build_next_steps(make_result(results=("no_fit", "borderline", "borderline", "no_fit"), rules=rules), COPY)
    assert "design=Fourplex Wide" in steps[0].why


def test_borderline_ignores_borderline_rows_on_no_fit_designs():
    rules = {
        0: [_rule("lot_coverage", required=45.0, actual=44.4, unit="pct", margin=0.6, borderline=True)],  # no_fit design
        1: [_rule("lot_width", required=9.04, actual=8.9, margin=-0.14, borderline=True)],
    }
    steps = build_next_steps(make_result(results=("no_fit", "borderline", "no_fit", "no_fit"), rules=rules), COPY)
    assert "rule=lot width" in steps[0].why


def test_borderline_prefers_a_metre_row_over_a_percentage_row():
    rules = {0: [_rule("lot_coverage", required=45.0, actual=44.4, unit="pct", margin=0.6, borderline=True),
                 _rule("lot_width", required=7.6, actual=7.62, margin=0.02, borderline=True)]}
    steps = build_next_steps(make_result(results=("borderline", "no_fit", "no_fit", "no_fit"), rules=rules), COPY)
    assert steps[0].why.startswith("BL design=")


def test_borderline_coverage_uses_the_percentage_variant_with_percent_signs():
    rules = {0: [_rule("lot_coverage", required=45.0, actual=44.4, unit="pct", margin=0.6, borderline=True)]}
    steps = build_next_steps(make_result(results=("borderline", "no_fit", "no_fit", "no_fit"), rules=rules), COPY)
    assert steps[0].why == "BLP design=Fourplex Narrow rule=lot coverage actual=44.4% required=45%"


def test_borderline_coverage_without_a_percentage_template_falls_back_to_any_fit():
    copy = make_copy()
    del copy["why"]["borderline_pct"]
    rules = {0: [_rule("lot_coverage", required=45.0, actual=44.4, unit="pct", margin=0.6, borderline=True)]}
    steps = build_next_steps(make_result(results=("borderline", "no_fit", "no_fit", "no_fit"), rules=rules), copy)
    assert steps[0].why == "ANY_FIT"


def test_borderline_with_a_fitting_design_still_names_the_borderline_one():
    rules = {1: [_rule("lot_width", required=9.04, actual=8.9, margin=-0.14, borderline=True)]}
    steps = build_next_steps(make_result(results=("fits", "borderline", "no_fit", "no_fit"), rules=rules), COPY)
    assert steps[0].id == "survey"
    assert steps[0].why.startswith("BL design=Fourplex Wide")


# ---------- the six real lots in the 5.10 table ----------

def test_281_armadale_borderline_width_with_site_exception():
    result = _borderline_result(flags=[_flag("site_exception", "x80")])
    steps = build_next_steps(result, COPY)
    assert ids(steps) == ["survey", "zoning_check", "site_exception", "trees", "designer", "permit", "demolition", "fees"]
    assert "lot width" in steps[0].why and "7.45" in steps[0].why and "7.6" in steps[0].why


def test_281_armadale_without_the_flag():
    assert ids(build_next_steps(_borderline_result(), COPY)) == FIT_BASE


def test_22_baby_point_fits_heritage_register_and_district():
    result = make_result(flags=[_flag("heritage_register"), _flag("heritage_district")])
    assert ids(build_next_steps(result, COPY)) == ["survey", "zoning_check", "heritage", "trees", "designer", "permit",
                                                   "demolition", "fees"]


def test_155_vine_attached_row_house():
    result = make_result("attached", results=("not_checked",) * 4)
    assert ids(build_next_steps(result, COPY)) == ["zoning_check", "trees", "attached_options"]


def test_34_rexford_all_no_fit_on_width():
    rules = {i: [_rule("lot_width", required=9.0, actual=7.6, margin=-1.4, passes=False)] for i in range(4)}
    result = make_result(results=("no_fit",) * 4, rules=rules)
    assert ids(build_next_steps(result, COPY)) == ["zoning_check", "trees", "custom_or_variance"]


def test_1_ripley_condo_not_checked():
    result = make_result("condo", results=("not_checked",) * 4)
    assert ids(build_next_steps(result, COPY)) == ["ask_zoning"]


def test_20_grafton_vacant_all_no_fit_has_no_demolition():
    result = make_result(results=("no_fit",) * 4, vacant=True, flags=[_flag("vacant")])
    assert ids(build_next_steps(result, COPY)) == ["zoning_check", "trees", "custom_or_variance"]


# ---------- the four contract fixtures ----------

def _ns(obj):
    """JSON -> attribute access, renaming "class" and "pass" the way the dataclasses do."""
    if isinstance(obj, dict):
        return SimpleNamespace(**{{"class": "class_", "pass": "pass_"}.get(k, k): _ns(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_ns(v) for v in obj]
    return obj


FIXTURES = sorted((contracts_dir() / "fixtures").glob("check.*.json"))


@pytest.mark.parametrize("path", FIXTURES, ids=lambda p: p.stem)
def test_fixture_inputs_give_the_fixture_steps(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = build_next_steps(_ns(data), COPY)
    assert ids(steps) == [s["id"] for s in data["next_steps"]]
    assert [s.group for s in steps] == [s["group"] for s in data["next_steps"]]


def test_borderline_fixture_why_matches_with_the_real_templates_shape():
    data = json.loads((contracts_dir() / "fixtures" / "check.borderline.json").read_text(encoding="utf-8"))
    copy = make_copy()
    copy["why"]["borderline"] = ("Because the {design} is too close to call on {rule}: this lot measures {actual} m "
                                 "against {required} m needed.")
    steps = build_next_steps(_ns(data), copy)
    assert steps[0].why == data["next_steps"][0]["why"]


# ---------- the real copy file, once Y12 has written it ----------

REAL_COPY = contracts_dir() / "copy" / "next_steps.json"


@pytest.mark.skipif(not REAL_COPY.exists(), reason="contracts/copy/next_steps.json not written yet (Y12)")
def test_real_copy_file_covers_every_step_and_fixtures_match():
    copy = json.loads(REAL_COPY.read_text(encoding="utf-8"))
    assert set(copy["steps"]) == set(STEP_ORDER)
    assert set(copy["groups"]) == {"confirm", "approvals", "apply", "alternatives"}
    for sid, step in copy["steps"].items():
        assert step["group"] == STEP_GROUPS[sid]
        assert step["title"] and step["text"] and step["who"] and step["links"]
        assert all(link["label"] and link["url"].startswith("https://") for link in step["links"])
    # S14: the intro and footer come from the copy file; every step keeps its own sources
    assert copy["intro"] and "Suplex checks zoning only" in copy["intro"]
    assert "Screening only, not a permit or legal advice." in copy["footer"] and "{checked_on}" in copy["footer"]
    for step in copy["steps"].values():
        assert step["sources"] and all(src["url"].startswith("https://") and src["quote"] for src in step["sources"])
    for key in ("borderline", "any_fit", "flag", "has_building", "attached", "no_fit", "not_checked"):
        assert key in copy["why"]
    # every step at once, then every fixture: ids and why lines
    everything = make_result(flags=[_flag("heritage_register"), _flag("ravine"), _flag("trca"), _flag("site_exception", "x1")])
    got = build_next_steps(everything, copy)
    assert ids(got) == ["survey", "zoning_check", "site_exception", "heritage", "ravine", "trca", "trees", "designer",
                        "permit", "demolition", "fees"]
    for s in got:
        assert "{" not in s.title + s.text + s.why + s.who
    for path in FIXTURES:
        data = json.loads(path.read_text(encoding="utf-8"))
        steps = build_next_steps(_ns(data), copy)
        assert [(s.id, s.group, s.why) for s in steps] == [(s["id"], s["group"], s["why"]) for s in data["next_steps"]]
