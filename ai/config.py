"""AI service configuration (MASTERSPEC 7.1). Every setting comes from the environment, with defaults.

A repo-root `.env` is read if present; real environment variables win over it.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import cache
from pathlib import Path

AI_DIR = Path(__file__).resolve().parent
REPO_DIR = AI_DIR.parent
CONTRACTS_DIR = REPO_DIR / "contracts"
COPY_DIR = CONTRACTS_DIR / "copy"
PROMPTS_DIR = AI_DIR / "prompts"

DEFAULT_LANGS = "en,fr"

# Literals the validator always accepts (MASTERSPEC 7.3). Everything else on the allow-list comes
# from designs.json and engine_config.json, so it follows the contracts.
ALLOWED_YEARS = (2013, 2022, 2023, 2024, 2025, 2026)
ELECTION_DAY = 26  # October 26, 2026
BYLAW_NUMBERS = (569, 2013, 654, 2025, 848)  # By-laws 569-2013, 654-2025, 848-2025

# Free-tier requests per minute, as read in AI Studio on 2026-10-17 (docs/decisions.md); pregenerate.py paces to these.
MODEL_RPM = {"gemini-3.8-flash": 5, "gemini-3.5-flash-lite": 15}
DEFAULT_RPM = 5

# Source links for numbers that come straight from a City dataset.
SOURCE_URLS = {
    "property_boundaries": "https://open.toronto.ca/dataset/property-boundaries/",
    "building_permits": "https://open.toronto.ca/dataset/building-permits-active-permits/",
}


def _read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.split(" #", 1)[0].strip().strip("'\"")
        values[key.strip()] = value
    return values


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None
    gemini_model: str
    suplex_api_url: str
    suplex_web_url: str
    suplex_ai_url: str
    cache_dir: Path
    log_dir: Path
    langs: tuple[str, ...]


def load_settings() -> Settings:
    env = {**_read_dotenv(REPO_DIR / ".env"), **os.environ}

    def get(name: str, default: str) -> str:
        return env.get(name) or default

    def path(name: str, default: str) -> Path:
        p = Path(get(name, default))
        return p if p.is_absolute() else REPO_DIR / p

    return Settings(
        gemini_api_key=env.get("GEMINI_API_KEY") or None,
        gemini_model=get("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        suplex_api_url=get("SUPLEX_API_URL", "http://localhost:8000").rstrip("/"),
        suplex_web_url=get("SUPLEX_WEB_URL", "http://localhost:5173").rstrip("/"),
        suplex_ai_url=get("SUPLEX_AI_URL", "http://localhost:8001").rstrip("/"),
        cache_dir=path("AI_CACHE_DIR", "ai/cache"),
        log_dir=path("AI_LOG_DIR", "ai/logs"),
        langs=tuple(code.strip() for code in get("AI_LANGS", DEFAULT_LANGS).split(",") if code.strip()),
    )


@cache
def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def contract(name: str) -> dict:
    """A file under /contracts, e.g. contract("designs.json") or contract("copy/labels.json")."""
    return load_json(CONTRACTS_DIR / name)


def prompt_file(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")
