"""Fixtures for the API tests.

The data-backed store loads once per session from SUPLEX_DATA_DIR (default <repo>/data/out), or from
SUPLEX_GPKG when that is set. Without the GeoPackage every test that needs it is skipped, so a
teammate without the data still gets a green `pytest api`; the pure tests always run.
"""
from __future__ import annotations

import json
import os
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = REPO_ROOT / "contracts"


def pytest_configure(config: pytest.Config) -> None:
    # Starlette 1.x asks for httpx2 in its TestClient; the shared venv has httpx 0.28, which still works.
    config.addinivalue_line("filterwarnings",
                            "ignore:Using `httpx` with `starlette.testclient` is deprecated:UserWarning")


def data_dir() -> Path:
    return Path(os.environ.get("SUPLEX_DATA_DIR") or REPO_ROOT / "data" / "out")


def gpkg_path() -> Path:
    override = os.environ.get("SUPLEX_GPKG")
    return Path(override) if override else data_dir() / "suplex.gpkg"


@pytest.fixture(scope="session")
def store() -> Any:
    gpkg = gpkg_path()
    if not gpkg.is_file():
        pytest.skip(f"no GeoPackage at {gpkg}: set SUPLEX_DATA_DIR to the data release folder "
                    "(or SUPLEX_GPKG to the file) to run the data-backed API tests")
    from api.store import load

    return load(data_dir(), gpkg)


@pytest.fixture(scope="session")
def client(store: Any) -> Iterator[Any]:
    from fastapi.testclient import TestClient

    from api.main import create_app

    with TestClient(create_app(store=store)) as c:
        yield c


@pytest.fixture(scope="session")
def schema_errors() -> Callable[[str, Any], list[str]]:
    """schema_errors(name, doc) -> [] when `doc` is valid against contracts/schemas/<name>.schema.json."""
    validators: dict[str, Draft202012Validator] = {}

    def check(name: str, doc: Any) -> list[str]:
        if name not in validators:
            path = CONTRACTS / "schemas" / f"{name}.schema.json"
            validators[name] = Draft202012Validator(json.loads(path.read_text(encoding="utf-8")))
        errors = list(validators[name].iter_errors(doc))
        if not errors:
            return []
        first = best_match(errors)
        return [f"{'/'.join(map(str, first.absolute_path))}: {first.message[:300]}", f"({len(errors)} errors)"]

    return check
