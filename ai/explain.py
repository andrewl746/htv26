"""POST /explain (MASTERSPEC 7.2): a validated plain-language explanation of one design's result.

Flow: build the numbers map → cache lookup → Gemini draft → validate → one regeneration with the
complaint → plain template. Nothing unvalidated is returned or cached.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, datetime

from ai.cache import JsonCache, cache_key
from ai.config import Settings, contract, prompt_file
from ai.gemini import GeminiError, generate_json
from ai.models import ExplainDraft
from ai.numbers import allowed_numbers, build_check_numbers, design_name, pick_design, render, used
from ai.templates import explain_template
from ai.validator import ValidationResult, validate

Generate = Callable[..., ExplainDraft]

RULE_PLACEHOLDERS = {
    "lot_width": ["lot_width_required", "lot_width_actual", "lot_width_margin"],
    "lot_depth": ["lot_depth_required", "lot_depth_actual", "lot_depth_margin"],
    "building_length": ["building_length_allowed", "building_length_design"],
    "height": ["height_allowed", "height_design"],
    "lot_coverage": ["coverage_allowed_pct", "coverage_actual_pct"],
    "units_allowed": ["units_allowed", "units_design"],
}


def model_input(check: dict, design: dict, numbers: dict) -> dict:
    """What the model sees: words and placeholder keys, never the values."""
    labels = contract("copy/labels.json")
    reasons = contract("copy/reasons.json")
    lot = check["lot"]
    attached = lot["class"] == "attached" or lot["attached"]
    return {
        "design": design_name(design["design_id"]),
        "result": design["result"],
        "result_label": labels["results"][design["result"]],
        "lot": {
            "class": lot["class"],
            "class_label": labels["classes"][lot["class"]],
            "reason": (lot["reason"] or {}).get("text"),
            "attached": attached,
            "flags": [flag["label"] for flag in lot["flags"]],
        },
        "rules": [
            {
                "rule_id": row["rule_id"],
                "label": row["label"],
                "pass": row["pass"],
                "borderline": row["borderline"],
                "blocking": row["rule_id"] == design["blocking_rule"],
                "plain": reasons["rules_plain"].get(row["rule_id"]) if row["pass"] is False else None,
                "placeholders": [k for k in RULE_PLACEHOLDERS.get(row["rule_id"], []) if k in numbers],
            }
            for row in design["rules"]
            if not row["not_applicable"]
        ],
        "numbers": {key: {"label": e["label"], "unit": e["unit"]} for key, e in numbers.items()},
        "attached_note": reasons["attached_note"] if attached else None,
    }


def _log_rejection(settings: Settings, prompt: str, attempt: int, result: ValidationResult) -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    entry = {
        "at": datetime.now(UTC).isoformat(timespec="seconds"),
        "endpoint": "explain",
        "model": settings.gemini_model,
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "attempt": attempt,
        "invented": sorted(result.invented),
        "unknown": sorted(result.unknown),
        "missing": sorted(result.missing),
    }
    with (settings.log_dir / "rejections.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def _english(check: dict, design: dict, numbers: dict, settings: Settings, generate: Generate) -> tuple[str, str, bool]:
    """Returns (template_text, source, cacheable). Gemini failures fall back without caching."""
    allowed = allowed_numbers(numbers)
    prompt = prompt_file("explain.md") + json.dumps(model_input(check, design, numbers), ensure_ascii=False, indent=1)
    try:
        for attempt in (1, 2):
            draft = generate(prompt, ExplainDraft, model=settings.gemini_model)
            result = validate(draft.template_text, numbers, allowed)
            if result.ok:
                return draft.template_text, "gemini", True
            _log_rejection(settings, prompt, attempt, result)
            prompt = f"{prompt}\n\n{result.complaint()}"
        cacheable = True  # rejected twice: the same inputs would be rejected again
    except GeminiError:
        cacheable = False  # quota or network: try Gemini again next time

    text = explain_template(check, design, numbers)
    check_template = validate(text, numbers, allowed)
    if not check_template.ok:  # a bug in the template copy, never shown
        raise RuntimeError(f"explain template failed the validator: {check_template}")
    return text, "template", cacheable


def explain(body: dict, settings: Settings, cache: JsonCache, generate: Generate = generate_json) -> dict:
    check = {k: v for k, v in body["check"].items() if k != "context"}
    design_id, numbers = build_check_numbers(
        check, body["design_id"], web_url=settings.suplex_web_url, ai_url=settings.suplex_ai_url
    )
    design = pick_design(check, design_id)
    lang = body["lang"]

    key = cache_key({
        "endpoint": "explain",
        "check": check,
        "design_id": design_id,
        "lang": "en",  # the English text; translation (S7) is cached separately per language
        "model": settings.gemini_model,
        "prompt": prompt_file("explain.md"),
        "urls": [settings.suplex_web_url, settings.suplex_ai_url],
    })
    hit = cache.get(key)
    if hit is not None:
        template_text, source, cached = hit["template_text"], hit["source"], True
    else:
        template_text, source, cacheable = _english(check, design, numbers, settings, generate)
        cached = False
        if cacheable:
            cache.put(key, {"template_text": template_text, "source": source})

    translation_unavailable = lang != "en"  # translate.py (S7) not built yet: serve English with the notice
    text_lang = "en" if translation_unavailable else lang
    return {
        "lang": lang,
        "design_id": design_id,
        "template_text": template_text,
        "text": render(template_text, numbers, text_lang),
        "numbers": used(template_text, numbers),
        "validated": True,
        "source": source,
        "model": settings.gemini_model if source == "gemini" else None,
        "cached": cached,
        "translation_unavailable": translation_unavailable,
        "disclaimer": contract("copy/disclaimers.json")["screening"],
    }
