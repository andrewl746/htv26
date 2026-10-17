"""The plain-template fallback (MASTERSPEC 7.5). Deterministic English sentences built from the numbers
map, using the same placeholders as the AI text, so the renderer treats both the same way.

Briefing sections (S5) are added here later.
"""
from __future__ import annotations

from ai.config import PROMPTS_DIR, contract, load_json
from ai.numbers import design_name
from ai.validator import placeholders


def _copy() -> dict:
    return load_json(PROMPTS_DIR / "explain_template.json")


def _if_known(sentence: str, numbers: dict) -> str | None:
    return sentence if placeholders(sentence) <= numbers.keys() else None


def explain_template(check: dict, design: dict, numbers: dict) -> str:
    t = _copy()
    name = design_name(design["design_id"])
    result = design["result"]
    sentences: list[str | None] = [t["opening"][result].format(design=name)]

    if result == "fits":
        sentences.append(_if_known(t["rule"]["lot_width"], numbers))
        sentences += [t["screening"], t["next_step"]]
    elif result == "borderline":
        row = next(r for r in design["rules"] if r["borderline"])
        sentences.append(_if_known(t["rule"][row["rule_id"]], numbers))
        sentences.append(_if_known(t["band"]["pct" if row["unit"] == "pct" else "m"], numbers))
        sentences += [t["screening"], t["next_step_borderline"]]
    elif result == "no_fit":
        if design["blocking_rule"]:
            sentences.append(_if_known(t["rule"][design["blocking_rule"]], numbers))
        sentences += [t["screening"], t["next_step"]]
    else:  # not_checked: restate the reason in plain words
        lot = check["lot"]
        reasons = contract("copy/reasons.json")
        reason = (lot.get("reason") or {}).get("text") or reasons["classes"].get(lot["class"], {}).get("text")
        sentences.append(reason)
        if lot["class"] == "attached" or lot.get("attached"):
            sentences.append(reasons["attached_note"])
        sentences.append(t["screening"])

    return " ".join(s for s in sentences if s)
