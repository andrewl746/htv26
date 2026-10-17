"""The validator (MASTERSPEC 7.4). Runs on every template_text before it is returned, shown or cached.

A draft passes only if every placeholder is a key the input offered, no required placeholder is
missing, and every literal number in the prose is on the allowed list.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

PLACEHOLDER = re.compile(r"\{\{([a-z0-9_]+)\}\}")
NUMBER = re.compile(r"(?<![\w.])[-+]?\d[\d,]*(?:\.\d+)?(?![\w])")


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    unknown: set[str] = field(default_factory=set)
    missing: set[str] = field(default_factory=set)
    invented: set[str] = field(default_factory=set)

    def complaint(self) -> str:
        """The note appended to the prompt for the one regeneration the policy allows."""
        parts = []
        if self.invented:
            parts.append(f"Your draft used the number {_join(self.invented)}, which is not in the input.")
        if self.unknown:
            parts.append(f"Your draft used the placeholder {_join(self.unknown, braces=True)}, which is not in the numbers map.")
        if self.missing:
            parts.append(f"Your draft dropped the placeholder {_join(self.missing, braces=True)}; keep every one.")
        parts.append("Use only {{placeholders}} from the numbers map, never digits.")
        return " ".join(parts)


def _join(items: set[str], braces: bool = False) -> str:
    return ", ".join(f"{{{{{i}}}}}" if braces else i for i in sorted(items))


def placeholders(template_text: str) -> set[str]:
    return set(PLACEHOLDER.findall(template_text))


def validate(
    template_text: str,
    numbers: dict,
    allowed_numbers: set[str],
    required_keys: set[str] | None = None,
) -> ValidationResult:
    keys = placeholders(template_text)
    unknown = keys - numbers.keys()  # a placeholder the input never offered
    missing = (required_keys or set()) - keys  # a translation dropped a placeholder
    stripped = PLACEHOLDER.sub(" ", template_text)
    literals = {m.replace(",", "") for m in NUMBER.findall(stripped)}
    invented = literals - {a.replace(",", "") for a in allowed_numbers}
    return ValidationResult(
        ok=not (unknown or missing or invented), unknown=unknown, missing=missing, invented=invented
    )
