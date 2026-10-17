"""The validation policy (MASTERSPEC 7.4), shared by /explain and /briefing.

Draft → validate every text → if any fails, log it and regenerate once with the complaint appended →
if that fails too, the caller serves the plain template. Nothing unvalidated leaves this module.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, datetime

from pydantic import BaseModel

from ai.config import Settings
from ai.gemini import GeminiError
from ai.validator import ValidationResult, validate

Generate = Callable[..., BaseModel]


def validate_texts(texts: dict[str, str], numbers: dict, allowed: set[str]) -> ValidationResult:
    results = [validate(text, numbers, allowed) for text in texts.values()]
    unknown = set().union(*(r.unknown for r in results))
    missing = set().union(*(r.missing for r in results))
    invented = set().union(*(r.invented for r in results))
    return ValidationResult(ok=all(r.ok for r in results), unknown=unknown, missing=missing, invented=invented)


def log_rejection(settings: Settings, endpoint: str, prompt: str, attempt: int, result: ValidationResult) -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    entry = {
        "at": datetime.now(UTC).isoformat(timespec="seconds"),
        "endpoint": endpoint,
        "model": settings.gemini_model,
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "attempt": attempt,
        "invented": sorted(result.invented),
        "unknown": sorted(result.unknown),
        "missing": sorted(result.missing),
    }
    with (settings.log_dir / "rejections.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def generate_validated(
    *,
    endpoint: str,
    prompt: str,
    schema: type[BaseModel],
    numbers: dict,
    allowed: set[str],
    settings: Settings,
    generate: Generate,
) -> tuple[dict[str, str] | None, bool]:
    """Returns (validated texts by field, None) or (None, cacheable) when the caller must use the template.

    cacheable is True after two rejections (the same inputs would be rejected again) and False after a
    Gemini error (quota or network: try Gemini again next time).
    """
    try:
        for attempt in (1, 2):
            draft = generate(prompt, schema, model=settings.gemini_model)
            texts = draft.model_dump()
            result = validate_texts(texts, numbers, allowed)
            if result.ok:
                return texts, True
            log_rejection(settings, endpoint, prompt, attempt, result)
            prompt = f"{prompt}\n\n{result.complaint()}"
        return None, True
    except GeminiError:
        return None, False


def check_template(texts: dict[str, str], numbers: dict, allowed: set[str]) -> None:
    """The template copy must pass the same validator; a failure is a bug in the copy, never shown."""
    result = validate_texts(texts, numbers, allowed)
    if not result.ok:
        raise RuntimeError(f"template failed the validator: {result}")
