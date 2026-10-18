"""Shared test helpers: a fake translation that passes the glossary like a real one would."""
from __future__ import annotations

import re

ENGLISH_LOT = re.compile(r"(?<![\w{])([Ll])ots?(?![\w}])")
ENGLISH_ZONING = re.compile(r"\bzoning\b", re.IGNORECASE)


def fake_translate(english: dict[str, str], prefix: str) -> dict[str, str]:
    """Marks each string as translated and swaps the English words the French glossary forbids ("lot(s)" becomes
    "terrains", "zoning" becomes "zonage"); placeholders such as {{could_lots}} are left alone."""
    return {k: prefix + ENGLISH_ZONING.sub("zonage", ENGLISH_LOT.sub("terrains", v)) for k, v in english.items()}
