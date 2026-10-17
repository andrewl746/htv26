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


class BriefingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ward: dict[str, Any]
    trend: dict[str, Any] | None
    lang: Lang


class BriefingSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Literal["what_may_fit", "blocking_rule", "permits", "not_checked", "questions"]
    heading: str
    template_text: str
    text: str


class DatasetLink(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str
    url: str


class BriefingLinks(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ward_map: str
    datasets: list[DatasetLink]
    methodology: str


class BriefingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ward_id: str
    ward_name: str
    lang: Lang
    title: str
    sections: list[BriefingSection]
    questions: list[str]
    numbers: dict[str, NumberEntry]
    links: BriefingLinks
    disclaimer: str
    data_dates: dict[str, str]
    generated_at: str
    validated: Literal[True]
    source: Literal["gemini", "template"]
    model: str | None
    cached: bool
    translation_unavailable: bool


class BriefingDraft(BaseModel):
    """What Gemini returns for /briefing: one field per written section, flat as 7.9 advises.
    The title and the three questions are fixed copy and never generated."""
    what_may_fit: str
    blocking_rule: str
    permits: str
    not_checked: str
