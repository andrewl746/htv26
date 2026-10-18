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
from ai.translate import translate
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


def template_langs() -> set[str]:
    """Languages with a reviewed template of their own in ai/prompts/briefing.json, English included."""
    return {"en", *_copy().get("translations", {})}


def briefing_template(ward: dict, numbers: dict, lang: str = "en") -> dict[str, str]:
    """The plain fallback, one text per section (MASTERSPEC 7.5), in English or a language under translations."""
    copy = _copy()
    t = copy["template"] if lang == "en" else copy["translations"][lang]["template"]
    questions = _questions("en") if lang == "en" else copy["translations"][lang]["questions"]
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
        "questions": "\n".join(questions),
    }


def _template_strings(ward: dict, numbers: dict, lang: str) -> dict[str, str]:
    """The whole page in a language's own template: fixed copy plus the template sections, no model involved."""
    fixed = _copy()["translations"][lang]
    sections = briefing_template(ward, numbers, lang)
    return {
        "title": fixed["title"],
        **{f"heading_{sid}": fixed["headings"][sid] for sid in SECTION_IDS},
        **{f"section_{sid}": sections[sid] for sid in WRITTEN},
        **{f"question_{i}": q for i, q in enumerate(fixed["questions"], start=1)},
        "disclaimer": fixed["disclaimer"],
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


def briefing(
    body: dict, settings: Settings, cache: JsonCache, generate: Generate = generate_json, *, refresh: bool = False
) -> dict:
    """refresh=True skips the cache read and overwrites the entry (pregenerate.py with a different model)."""
    ward = _ward_inputs(body["ward"])
    lang = body["lang"]
    numbers = build_ward_numbers(ward, web_url=settings.suplex_web_url)
    copy = _copy()

    # No model in the key: a pre-generation run with another model fills the entries the service reads.
    key = cache_key({
        "endpoint": "briefing",
        "ward": ward,
        "prompt": prompt_file("briefing.md"),
        "web_url": settings.suplex_web_url,
    })
    hit = None if refresh else cache.get(key)
    if hit is not None:
        sections, source, model, generated_at = hit["sections"], hit["source"], hit.get("model"), hit["generated_at"]
        cached = True
    else:
        sections, source, cacheable = _english(ward, numbers, settings, generate)
        model = settings.gemini_model if source == "gemini" else None
        generated_at, cached = datetime.now(UTC).isoformat(timespec="seconds"), False
        if cacheable:
            cache.put(key, {"sections": sections, "source": source, "model": model, "generated_at": generated_at})

    english = {
        "title": copy["title"],
        **{f"heading_{sid}": copy["headings"][sid] for sid in SECTION_IDS},
        **{f"section_{sid}": sections[sid] for sid in WRITTEN},
        **{f"question_{i}": q for i, q in enumerate(_questions("en"), start=1)},
        "disclaimer": contract("copy/disclaimers.json")["screening"],
    }
    strings, text_lang, translation_unavailable = english, "en", False
    if lang != "en":
        # A Gemini result is translated. Without one (no key, quota, a rejected translation) the language's
        # own template is served, so a ward never shown in English for want of a model; English only for a
        # language with no template.
        translated, translation_cached = (None, False)
        if source == "gemini":
            translated, translation_cached = translate(
                english, lang, numbers=numbers, allowed=allowed_numbers(numbers), settings=settings, cache=cache,
                generate=generate, endpoint="briefing", refresh=refresh,
            )
        if translated is not None:
            strings, text_lang, cached = translated, lang, cached and translation_cached
        elif lang in template_langs():
            strings, text_lang = _template_strings(ward, numbers, lang), lang
            check_template({k: v for k, v in strings.items() if k.startswith(("section_", "question_"))},
                           numbers, allowed_numbers(numbers))
            source, model = "template", None
        else:
            translation_unavailable = True

    questions = [strings[f"question_{i}"] for i in range(1, len(_questions("en")) + 1)]
    texts = {**{sid: strings[f"section_{sid}"] for sid in WRITTEN}, "questions": "\n".join(questions)}
    ward_name = ward["ward_name"].replace("-", "–")  # en dash between place names in the title
    return {
        "ward_id": ward["ward_id"],
        "ward_name": ward["ward_name"],
        "lang": lang,
        # replace, not format: a translated title may contain other braces
        "title": strings["title"].replace("{ward_id}", ward["ward_id"]).replace("{ward_name}", ward_name),
        "sections": [
            {
                "id": sid,
                "heading": strings[f"heading_{sid}"],
                "template_text": texts[sid],
                "text": render(texts[sid], numbers, text_lang),
            }
            for sid in SECTION_IDS
        ],
        "questions": questions,
        # Labels in the shown language; the English map above is the one Gemini and the cache keys see.
        "numbers": used("\n".join(texts.values()), build_ward_numbers(ward, web_url=settings.suplex_web_url, lang=text_lang)),
        "links": {
            "ward_map": f"{settings.suplex_web_url}/?ward={ward['ward_id']}",
            "datasets": copy["datasets"],
            "methodology": copy["methodology"],
        },
        "disclaimer": strings["disclaimer"],
        "data_dates": ward["data_dates"],
        "generated_at": generated_at,
        "validated": True,
        "source": source,
        "model": model,
        "cached": cached,
        "translation_unavailable": translation_unavailable,
    }
