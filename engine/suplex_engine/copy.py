"""Loader for /contracts/copy/*.json: every user-facing string the engine emits comes from there."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from .config import contracts_dir


@lru_cache(maxsize=16)
def _load(name: str, folder: str) -> dict[str, Any]:
    with open(f"{folder}/copy/{name}.json", encoding="utf-8") as f:
        return json.load(f)


def copy(name: str) -> dict[str, Any]:
    """labels | reasons | not_checked | questions | disclaimers. Cached per folder as spelled: resolving the path
    on every call was a fifth of the batch run's time (a filesystem call per rule label)."""
    return _load(name, str(contracts_dir()))


def rule_label(rule_id: str) -> str:
    return copy("labels")["rules"][rule_id]


def class_reason(class_id: str) -> dict[str, str]:
    return copy("reasons")["classes"][class_id]


def flag_copy(flag_id: str) -> dict[str, Any]:
    return copy("reasons")["flags"][flag_id]


def not_checked_labels() -> list[str]:
    items = copy("not_checked")
    if isinstance(items, dict):
        items = items.get("items", [])
    return [x["label"] for x in items]


def disclaimer(key: str = "screening") -> str:
    return copy("disclaimers")[key]


def next_steps_copy() -> dict[str, Any]:
    """contracts/copy/next_steps.json (MASTERSPEC 5.10), or {} until that file exists (Y12)."""
    try:
        return copy("next_steps")
    except FileNotFoundError:
        return {}
