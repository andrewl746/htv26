"""A sha256-keyed JSON cache on disk (MASTERSPEC 7.1). One file per entry under AI_CACHE_DIR."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any


def _same_numbers(value: Any) -> Any:
    """Whole floats become ints, so 22.0 from Python and 22 from JavaScript's JSON.stringify are one key."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: _same_numbers(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_same_numbers(v) for v in value]
    return value


def cache_key(inputs: Any) -> str:
    """sha256 of the inputs as canonical JSON, so the same inputs always give the same key, whichever
    client sent them (a browser writes 22.0 as 22)."""
    canonical = json.dumps(_same_numbers(inputs), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class JsonCache:
    def __init__(self, directory: Path):
        self.directory = directory

    def _path(self, key: str) -> Path:
        return self.directory / f"{key}.json"

    def get(self, key: str) -> dict | None:
        try:
            return json.loads(self._path(key).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def put(self, key: str, value: dict) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        tmp = self._path(key).with_suffix(".tmp")
        tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self._path(key))
