"""Shared test helpers: a fake translation that passes the glossary like a real one would."""
from __future__ import annotations

import re

ENGLISH_LOT = re.compile(r"(?<![\w{])([Ll])ots?(?![\w}])")


def fake_translate(english: dict[str, str], prefix: str) -> dict[str, str]:
    """Marks each string as translated and swaps the English word "lot(s)" for "terrain(s)", which the
    French glossary requires; placeholders such as {{could_lots}} are left alone."""
    return {k: prefix + ENGLISH_LOT.sub(lambda m: "terrains", v) for k, v in english.items()}
