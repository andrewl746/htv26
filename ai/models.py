"""Pydantic models mirroring /contracts/schemas/explain.*.schema.json (types.ts: ExplainRequest, ExplainResponse).

The CheckResponse inside a request is checked against the contract schema itself (see main.py), so it
is kept as a plain dict here rather than redefined.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

DesignId = Literal["fourplex_narrow", "fourplex_wide", "sixplex_narrow", "sixplex_wide"]
Lang = Literal["en", "fr", "zh-Hans", "zh-Hant", "es", "tl", "ta", "pt"]


class NumberEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: int | float
    unit: str | None
    label: str
    source_url: str


class ExplainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    check: dict[str, Any]
    design_id: DesignId | None
    lang: Lang


class ExplainResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lang: Lang
    design_id: DesignId
    template_text: str
    text: str
    numbers: dict[str, NumberEntry]
    validated: Literal[True]
    source: Literal["gemini", "template"]
    model: str | None
    cached: bool
    translation_unavailable: bool
    disclaimer: str


class ExplainDraft(BaseModel):
    """What Gemini returns for /explain (structured output schema)."""
    template_text: str
