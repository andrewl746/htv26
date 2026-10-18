"""Your next steps (MASTERSPEC 5.10): `build_next_steps(result, copy)` turns a finished CheckResult into the
ordered "Your next steps" list. Pure: it reads only what the engine produced and the copy file
(contracts/copy/next_steps.json); no network, no AI. Code picks the steps and fills the `why` line from this
lot's own result and flags; the words, contacts and links are copy.

Order: by group (the order of `copy["groups"]`), then catalogue order inside the group. A step appears at most
once; its `why` names the first trigger that matched. Borderline results make `survey` name the rule and both
values (the first borderline design in design order, the first borderline row in that design, metres before
percentages), with the checklist's rounding (`rules._fmt`).
"""
from __future__ import annotations

import re
from typing import Any

from . import copy as copy_
from .designs import load_designs
from .models import CheckResult, NextStep, NextStepLink, RuleRow
from .rules import _fmt, _fmt_pct

# The contract's step ids in catalogue (display) order inside each group (MASTERSPEC 5.10).
CATALOGUE = (
    "survey", "zoning_check", "site_exception",
    "heritage", "ravine", "trca", "trees",
    "designer", "permit", "demolition", "fees",
    "attached_options", "custom_or_variance", "ask_zoning",
)
MAY_FIT_RESULTS = ("fits", "borderline")
NOT_CHECKED_CLASSES = ("condo", "non_residential", "older_bylaw", "larger_building", "unmeasurable")
HERITAGE_FLAGS = ("heritage_register", "heritage_district")

_PLACEHOLDER = re.compile(r"\{(\w+)\}")
_NUMBER_SLOT = re.compile(r"\s*x?\{number\}")


def _fill(template: str, values: dict[str, str]) -> str:
    """Fill known `{name}` slots only; anything else stays as written."""
    return _PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), template)


def _sentence_case(label: str) -> str:
    """A label inside a sentence: lower the first letter unless it starts an acronym ("TRCA regulated area")."""
    if len(label) > 1 and label[1].isupper():
        return label
    return label[:1].lower() + label[1:]


def _row_values(row: RuleRow) -> tuple[str, str]:
    fmt = _fmt_pct if row.unit == "pct" else _fmt
    return (fmt(row.actual) if isinstance(row.actual, (int, float)) else str(row.actual),
            fmt(row.required) if isinstance(row.required, (int, float)) else str(row.required))


def _borderline_why(result: CheckResult, why: dict[str, str]) -> str | None:
    """The `borderline` why line for the first borderline design, or None when no usable row/template exists."""
    for design in result.designs:
        if design.result != "borderline":
            continue
        rows = [r for r in design.rules if r.borderline and not r.not_applicable]
        # Metre rows read with the `borderline` template; percentage rows need `borderline_pct` (when the copy has it).
        for row in sorted(rows, key=lambda r: r.unit == "pct"):
            key = "borderline_pct" if row.unit == "pct" else "borderline"
            if key not in why:
                continue
            actual, required = _row_values(row)
            return _fill(why[key], {"design": _design_name(design.design_id), "rule": copy_.rule_label(row.rule_id).lower(),
                                    "actual": actual, "required": required})
        return None
    return None


def _design_name(design_id: str) -> str:
    design = load_designs().by_id.get(design_id)
    return design.name if design is not None else design_id


def _triggers(result: CheckResult) -> dict[str, str]:
    """step id -> the `why` key of the first trigger that matched (steps that do not trigger are absent)."""
    lot = result.lot
    results = [d.result for d in result.designs]
    may_fit = any(r in MAY_FIT_RESULTS for r in results)
    flags = {f.id for f in lot.flags}
    checked = lot.class_ in ("checked", "attached")
    if lot.class_ == "attached":
        checked_why = "attached"
    else:
        checked_why = "any_fit" if may_fit else "no_fit"

    out: dict[str, str] = {}
    if may_fit:
        out["survey"] = "borderline" if "borderline" in results else "any_fit"
    if checked:
        out["zoning_check"] = checked_why
    if "site_exception" in flags:
        out["site_exception"] = "flag"
    if flags & set(HERITAGE_FLAGS):
        out["heritage"] = "flag"
    for flag_id in ("ravine", "trca"):
        if flag_id in flags:
            out[flag_id] = "flag"
    if checked:
        out["trees"] = checked_why
    if may_fit:
        out["designer"] = out["permit"] = out["fees"] = "any_fit"
        if not lot.vacant:
            out["demolition"] = "has_building"
    if lot.class_ == "attached":
        out["attached_options"] = "attached"
    if lot.class_ == "checked" and results and all(r == "no_fit" for r in results):
        out["custom_or_variance"] = "no_fit"
    if lot.class_ in NOT_CHECKED_CLASSES:
        out["ask_zoning"] = "not_checked"
    return out


def build_next_steps(result: CheckResult, copy: dict[str, Any]) -> list[NextStep]:
    """The steps for this result, ordered by group then catalogue order. Empty when the copy file is not there."""
    if not copy or "steps" not in copy:
        return []
    lot = result.lot
    why_copy: dict[str, str] = copy["why"]
    flags = {}
    for f in lot.flags:
        flags.setdefault(f.id, f)

    values = {"reason": _sentence_case(lot.reason.label) if lot.reason else ""}
    group_rank = {g: i for i, g in enumerate(copy.get("groups", {}))}
    picked: list[tuple[int, int, NextStep]] = []
    triggers = _triggers(result)
    for catalogue_rank, step_id in enumerate(CATALOGUE):
        why_key = triggers.get(step_id)
        if why_key is None:
            continue
        step = copy["steps"][step_id]
        slots = dict(values)
        flag = None
        if why_key == "flag":
            flag_ids = HERITAGE_FLAGS if step_id == "heritage" else (step_id,)
            flag = next(flags[i] for i in flag_ids if i in flags)
            slots["flag_label"] = slots["flag"] = _sentence_case(flag.label)
        title, text = step["title"], step["text"]
        if step_id == "site_exception":
            detail = flags["site_exception"].detail
            if detail:
                slots["number"] = detail.lstrip("xX")
            elif "{number}" in title + text:
                title = step.get("title_without_number") or _NUMBER_SLOT.sub("", title)
                text = step.get("text_without_number") or _NUMBER_SLOT.sub("", text)
        why = None
        if why_key == "borderline":
            why = _borderline_why(result, why_copy)
        if why is None:
            why = _fill(why_copy["any_fit" if why_key == "borderline" else why_key], slots)
        picked.append((group_rank.get(step["group"], len(group_rank)), catalogue_rank, NextStep(
            id=step_id, group=step["group"], title=_fill(title, slots), text=_fill(text, slots), who=_fill(step["who"], slots),
            why=why, links=[NextStepLink(label=x["label"], url=x["url"]) for x in step["links"]])))
    return [s for _, _, s in sorted(picked, key=lambda t: t[:2])]
