"""POST /briefing (MASTERSPEC 2.4 feature 3, 7.7, 7.8): a validated one-page ward briefing.

Gemini writes four sections from placeholder keys only; the title, headings and the three questions
are fixed copy. Same policy as /explain: validate, regenerate once, else the plain template.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime

from ai.cache import JsonCache, cache_key
from ai.config import PROMPTS_DIR, Settings, contract, load_json, prompt_file
from ai.gemini import generate_json
from ai.generate import Generate, check_template, generate_validated
from ai.models import BriefingDraft
from ai.numbers import allowed_numbers, build_ward_numbers, render, used
from ai.validator import placeholders

SECTION_IDS = ("what_may_fit", "blocking_rule", "permits", "not_checked", "questions")
WRITTEN = SECTION_IDS[:4]
WARD_URL_KEYS = ("lots_url", "permits_url", "trend_url", "briefing_url")


def _copy() -> dict:
    return load_json(PROMPTS_DIR / "briefing.json")


def _questions(lang: str) -> list[str]:
    questions = contract("copy/questions.json")
    return questions.get(lang) or questions["en"]


def _sentences(sentences: list[str], numbers: dict) -> str:
    """Joins the sentences whose placeholders are all in the numbers map."""
    return " ".join(s for s in sentences if placeholders(s) <= numbers.keys())


def briefing_template(ward: dict, numbers: dict) -> dict[str, str]:
    """The plain English fallback, one text per section (MASTERSPEC 7.5)."""
    t = _copy()["template"]
    top = ward["top_blocking_rules"][0]["rule_id"] if ward["top_blocking_rules"] else None
    if top == "detached_building":
        blocking = _sentences(t["blocking_rule"]["detached_building"], numbers)
    elif top is not None:
        first, *rest = t["blocking_rule"]["other"]
        # replace, not format: format would turn the {{placeholders}} into {placeholders}
        blocking = _sentences([first.replace("{rule_plain}", t["rule_plain"][top]), *rest], numbers)
    else:
        blocking = _sentences(t["blocking_rule"]["other"][1:], numbers)
    return {
        "what_may_fit": _sentences(t["what_may_fit"], numbers),
        "blocking_rule": blocking,
        "permits": _sentences(t["permits"], numbers),
        "not_checked": _sentences(t["not_checked"], numbers),
        "questions": "\n".join(_questions("en")),
    }


def model_input(ward: dict, numbers: dict) -> dict:
    """What the model sees: words and placeholder keys, never the values."""
    reasons = contract("copy/reasons.json")
    top = ward["top_blocking_rules"][0]["rule_id"] if ward["top_blocking_rules"] else None
    return {
        "ward_name": ward["ward_name"],
        "sixplex_designs_allowed": ward["sixplex_overlay"] != "none",
        "top_blocking_rule": {"rule_id": top, "plain": reasons["rules_plain"].get(top)} if top else None,
        "headings": {sid: _copy()["headings"][sid] for sid in WRITTEN},
        "numbers": {key: {"label": e["label"], "unit": e["unit"]} for key, e in numbers.items()},
    }


def _ward_inputs(ward: dict) -> dict:
    """The part of the ward entry that decides the text: no urls, no batch timestamp."""
    return {k: v for k, v in ward.items() if k not in WARD_URL_KEYS and k != "generated_at"}


def _english(ward: dict, numbers: dict, settings: Settings, generate: Generate) -> tuple[dict[str, str], str, bool]:
    allowed = allowed_numbers(numbers)
    prompt = prompt_file("briefing.md") + json.dumps(model_input(ward, numbers), ensure_ascii=False, indent=1)
    texts, cacheable = generate_validated(
        endpoint="briefing", prompt=prompt, schema=BriefingDraft, numbers=numbers, allowed=allowed,
        settings=settings, generate=generate,
    )
    questions = "\n".join(_questions("en"))
    if texts is not None:
        sections = {**texts, "questions": questions}
        check_template({"questions": questions}, numbers, allowed)
        return sections, "gemini", True
    sections = briefing_template(ward, numbers)
    check_template(sections, numbers, allowed)
    return sections, "template", cacheable


def briefing(body: dict, settings: Settings, cache: JsonCache, generate: Generate = generate_json) -> dict:
    ward = _ward_inputs(body["ward"])
    lang = body["lang"]
    numbers = build_ward_numbers(ward, web_url=settings.suplex_web_url)
    copy = _copy()

    key = cache_key({
        "endpoint": "briefing",
        "ward": ward,
        "lang": "en",  # the English text; translation (S7) is cached separately per language
        "model": settings.gemini_model,
        "prompt": prompt_file("briefing.md"),
        "web_url": settings.suplex_web_url,
    })
    hit = cache.get(key)
    if hit is not None:
        sections, source, generated_at, cached = hit["sections"], hit["source"], hit["generated_at"], True
    else:
        sections, source, cacheable = _english(ward, numbers, settings, generate)
        generated_at, cached = datetime.now(UTC).isoformat(timespec="seconds"), False
        if cacheable:
            cache.put(key, {"sections": sections, "source": source, "generated_at": generated_at})

    translation_unavailable = lang != "en"  # translate.py (S7) not built yet: serve English with the notice
    text_lang = "en" if translation_unavailable else lang
    all_text = "\n".join(sections[sid] for sid in SECTION_IDS)
    return {
        "ward_id": ward["ward_id"],
        "ward_name": ward["ward_name"],
        "lang": lang,
        "title": copy["title"].format(ward_id=ward["ward_id"], ward_name=ward["ward_name"].replace("-", "–")),
        "sections": [
            {
                "id": sid,
                "heading": copy["headings"][sid],
                "template_text": sections[sid],
                "text": render(sections[sid], numbers, text_lang),
            }
            for sid in SECTION_IDS
        ],
        "questions": _questions("en"),
        "numbers": used(all_text, numbers),
        "links": {
            "ward_map": f"{settings.suplex_web_url}/?ward={ward['ward_id']}",
            "datasets": copy["datasets"],
            "methodology": copy["methodology"],
        },
        "disclaimer": contract("copy/disclaimers.json")["screening"],
        "data_dates": ward["data_dates"],
        "generated_at": generated_at,
        "validated": True,
        "source": source,
        "model": settings.gemini_model if source == "gemini" else None,
        "cached": cached,
        "translation_unavailable": translation_unavailable,
    }
