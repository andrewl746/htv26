"""Your next steps (MASTERSPEC 5.10): `build_next_steps(result, copy)` turns a finished CheckResult into the
ordered "Your next steps" list. Pure: it reads only what the engine produced and the copy file
(contracts/copy/next_steps.json); no network, no AI.

Stub from A14 (Andrew), so `run_check` and the contract carry the field before the feature lands. Yuvi owns
this file and replaces the body in Y13 (MASTERSPEC 8.5); the signature and the return type stay.
"""
from __future__ import annotations

from typing import Any

from .models import CheckResult, NextStep


def build_next_steps(result: CheckResult, copy: dict[str, Any]) -> list[NextStep]:
    """The steps for this result, ordered by group then catalogue order. Empty until Y13."""
    return []
