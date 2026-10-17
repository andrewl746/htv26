"""Translation (MASTERSPEC 7.6): a second pass over the validated English, placeholders intact.

One call per language with every string as a flat JSON object. Each translated string goes through the
validator again with the English placeholders as required keys; a string may use only the placeholders
its English had. If the translation fails, the caller serves English with translation_unavailable.
"""
from __future__ import annotations

import json

from pydantic import create_model

from ai.cache import JsonCache, cache_key
from ai.config import Settings, contract, prompt_file
from ai.gemini import GeminiError
from ai.generate import Generate, log_rejection
from ai.validator import ValidationResult, placeholders, validate

TOKENS = ("{ward_id}", "{ward_name}")  # single-brace tokens in the briefing title, filled in after translation


# Bump when the translation checks change, so cached results (and cached rejections) are redone.
RULES_VERSION = 2


def month_forms() -> set[str]:
    """The month of "since May 2023" as a digit. Some languages write months as numbers (Chinese "2023年5月"),
    so translations may use it; English text never gets this allowance."""
    month = int(contract("engine_config.json")["permits_since"][5:7])
    return {str(month), f"{month:02d}"}


def language_name(lang: str) -> str:
    return contract("copy/labels.json")["languages"][lang]["english"]


def _check(english: dict[str, str], translated: dict[str, str], numbers: dict, allowed: set[str]) -> ValidationResult:
    unknown: set[str] = set()
    missing: set[str] = set()
    invented: set[str] = set()
    for key, source in english.items():
        text = translated.get(key, "")
        keys = placeholders(source)
        result = validate(text, {k: numbers[k] for k in keys if k in numbers}, allowed, required_keys=keys)
        unknown |= result.unknown
        missing |= result.missing | {t for t in TOKENS if t in source and t not in text}
        invented |= result.invented
        if not text.strip():
            missing.add(key)
    return ValidationResult(ok=not (unknown or missing or invented), unknown=unknown, missing=missing, invented=invented)


def translate(
    english: dict[str, str],
    lang: str,
    *,
    numbers: dict,
    allowed: set[str],
    settings: Settings,
    cache: JsonCache,
    generate: Generate,
    endpoint: str,
    refresh: bool = False,
) -> tuple[dict[str, str] | None, bool]:
    """Returns (translated strings, cached) or (None, False) when English must be served instead."""
    key = cache_key({
        "endpoint": "translate", "english": english, "lang": lang, "prompt": prompt_file("translate.md"),
        "rules": RULES_VERSION,
    })
    hit = None if refresh else cache.get(key)
    if hit is not None:
        return hit.get("strings"), True

    allowed = allowed | month_forms()
    schema = create_model("Translation", **{k: (str, ...) for k in english})
    prompt = prompt_file("translate.md").replace("{language_name}", language_name(lang))
    prompt += json.dumps(english, ensure_ascii=False, indent=1)
    try:
        for attempt in (1, 2):
            draft = generate(prompt, schema, model=settings.gemini_model).model_dump()
            result = _check(english, draft, numbers, allowed)
            if result.ok:
                cache.put(key, {"strings": draft, "model": settings.gemini_model})
                return draft, False
            log_rejection(settings, f"{endpoint}:translate:{lang}", prompt, attempt, result)
            prompt = f"{prompt}\n\n{result.complaint()}"
        cache.put(key, {"strings": None, "model": settings.gemini_model})  # rejected twice: same inputs, same result
    except GeminiError:
        pass  # quota or network: try again next time
    return None, False
