"""Validate the Suplex contracts (MASTERSPEC 3.8 and Appendix A).

Checks every schema in contracts/schemas against the JSON Schema 2020-12 metaschema, then every
contract file and fixture against its schema (format checking off). Prints one line per file and
exits 1 if anything fails, 0 otherwise. Runs from any working directory.

    python contracts/validate.py                    # schemas, designs.json, engine_config.json, copy, fixtures
    python contracts/validate.py -v                 # also list every error, not just the first
    python contracts/validate.py --url "http://localhost:8000/check?address_id=..."
    python contracts/validate.py --url http://localhost:8000/ward/04 --schema ward.response
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import sys
import urllib.error
import urllib.request
from collections.abc import Iterable
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft202012Validator
    from jsonschema.exceptions import SchemaError, ValidationError, best_match
except ImportError:  # pragma: no cover
    print("FAIL jsonschema is not installed: run `pip install -r requirements.txt` in the repo venv")
    sys.exit(1)

HERE = Path(__file__).resolve().parent
SCHEMA_DIR = HERE / "schemas"
FIXTURE_DIR = HERE / "fixtures"
COPY_DIR = HERE / "copy"
METASCHEMA = "https://json-schema.org/draft/2020-12/schema"

EXPECTED_SCHEMAS = [
    "search.response", "check.response", "ward.response", "trend.response",
    "explain.request", "explain.response", "briefing.request", "briefing.response",
    "ward_summary.file", "lot_feature.props", "permit_feature.props", "designs.file", "engine_config.file",
]

# Contract files outside fixtures/ (path relative to contracts/ -> schema name).
CONTRACT_FILES = {
    "designs.json": "designs.file",
    "engine_config.json": "engine_config.file",
}

# Fixture file name pattern -> (schema name, mode). First match wins. Mode "doc" validates the whole
# file; "features" validates a GeoJSON FeatureCollection and each feature's properties.
FIXTURE_PATTERNS: list[tuple[str, str, str]] = [
    ("search*.json", "search.response", "doc"),
    ("check.*.json", "check.response", "doc"),
    ("ward_summary*.json", "ward_summary.file", "doc"),
    ("ward.*.json", "ward.response", "doc"),
    ("trend.*.json", "trend.response", "doc"),
    ("explain.request*.json", "explain.request", "doc"),
    ("explain.response*.json", "explain.response", "doc"),
    ("briefing.request*.json", "briefing.request", "doc"),
    ("briefing.*.json", "briefing.response", "doc"),
    ("lots.*.geojson", "lot_feature.props", "features"),
    ("permits*.geojson", "permit_feature.props", "features"),
]
FIXTURE_IGNORE = {"README.md"}

GEOMETRY_TYPES = {
    "lot_feature.props": ["Polygon", "MultiPolygon"],
    "permit_feature.props": ["Point"],
}


def feature_collection_schema(geometry_types: list[str]) -> dict[str, Any]:
    """The GeoJSON envelope; feature properties are checked separately against their own schema."""
    return {
        "type": "object",
        "required": ["type", "features"],
        "properties": {
            "type": {"const": "FeatureCollection"},
            "features": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["type", "geometry", "properties"],
                    "properties": {
                        "type": {"const": "Feature"},
                        "geometry": {
                            "type": "object",
                            "required": ["type", "coordinates"],
                            "properties": {"type": {"enum": geometry_types}, "coordinates": {"type": "array"}},
                        },
                        "properties": {"type": "object"},
                    },
                },
            },
        },
    }


# ---------- output ----------

class Report:
    def __init__(self, verbose: bool) -> None:
        self.verbose = verbose
        self.failed = 0
        self.passed = 0

    def ok(self, label: str, note: str = "") -> None:
        self.passed += 1
        print(f"OK   {label}" + (f"  ({note})" if note else ""))

    def fail(self, label: str, message: str, details: Iterable[str] = ()) -> None:
        self.failed += 1
        print(f"FAIL {label}: {message}")
        if self.verbose:
            for line in details:
                print(f"       {line}")


def json_path(error: ValidationError, prefix: str = "$") -> str:
    out = prefix
    for part in error.absolute_path:
        out += f"[{part}]" if isinstance(part, int) else f".{part}"
    return out


def describe(error: ValidationError, prefix: str = "$") -> str:
    msg = error.message
    if len(msg) > 240:
        msg = msg[:237] + "..."
    return f"{json_path(error, prefix)}: {msg}"


def errors_for(validator: Draft202012Validator, instance: Any, prefix: str = "$") -> list[tuple[ValidationError, str]]:
    return [(e, prefix) for e in validator.iter_errors(instance)]


def report_result(report: Report, label: str, errors: list[tuple[ValidationError, str]], note: str) -> None:
    if not errors:
        report.ok(label, note)
        return
    first = best_match(e for e, _ in errors)
    # best_match may return a nested error from an anyOf; map it back to its top-level error's prefix
    first_prefix = next((p for e, p in errors if e is first or first in e.context), errors[0][1])
    more = f" (+{len(errors) - 1} more)" if len(errors) > 1 else ""
    details = sorted(describe(e, p) for e, p in errors)
    report.fail(label, describe(first, first_prefix) + more, details)


# ---------- loading ----------

def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_schemas(report: Report) -> dict[str, Draft202012Validator]:
    validators: dict[str, Draft202012Validator] = {}
    found = {p.name[: -len(".schema.json")]: p for p in sorted(SCHEMA_DIR.glob("*.schema.json"))}
    for name in EXPECTED_SCHEMAS:
        if name not in found:
            report.fail(f"schemas/{name}.schema.json", "missing")
    for name, path in found.items():
        label = f"schemas/{path.name}"
        try:
            schema = load_json(path)
        except (OSError, json.JSONDecodeError) as e:
            report.fail(label, f"cannot read: {e}")
            continue
        if schema.get("$schema") != METASCHEMA:
            report.fail(label, f'"$schema" must be "{METASCHEMA}"')
            continue
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as e:
            report.fail(label, f"not a valid 2020-12 schema: {describe(e)}")
            continue
        validators[name] = Draft202012Validator(schema)  # no format_checker: formats are not asserted
        report.ok(label, "metaschema")
    return validators


def fixture_target(name: str) -> tuple[str, str] | None:
    for pattern, schema, mode in FIXTURE_PATTERNS:
        if fnmatch.fnmatchcase(name, pattern):
            return schema, mode
    return None


# ---------- checks ----------

def check_document(report: Report, validators: dict[str, Draft202012Validator], path: Path, schema: str) -> None:
    label = str(path.relative_to(HERE)).replace("\\", "/")
    if schema not in validators:
        report.fail(label, f"schema {schema} is missing or invalid")
        return
    try:
        doc = load_json(path)
    except (OSError, json.JSONDecodeError) as e:
        report.fail(label, f"cannot read: {e}")
        return
    report_result(report, label, errors_for(validators[schema], doc), schema)


def check_features(report: Report, validators: dict[str, Draft202012Validator], path: Path, schema: str) -> None:
    label = str(path.relative_to(HERE)).replace("\\", "/")
    if schema not in validators:
        report.fail(label, f"schema {schema} is missing or invalid")
        return
    try:
        doc = load_json(path)
    except (OSError, json.JSONDecodeError) as e:
        report.fail(label, f"cannot read: {e}")
        return
    envelope = Draft202012Validator(feature_collection_schema(GEOMETRY_TYPES.get(schema, [])))
    errors = errors_for(envelope, doc)
    features = doc.get("features") if isinstance(doc, dict) else None
    count = 0
    if isinstance(features, list):
        for i, feature in enumerate(features):
            if isinstance(feature, dict) and isinstance(feature.get("properties"), dict):
                count += 1
                errors += errors_for(validators[schema], feature["properties"], f"$.features[{i}].properties")
    report_result(report, label, errors, f"{count} features, properties against {schema}")


def check_copy(report: Report) -> None:
    """Copy files have no schema (Simone edits them directly); they only have to parse."""
    for path in sorted(COPY_DIR.glob("*.json")):
        label = f"copy/{path.name}"
        try:
            load_json(path)
        except (OSError, json.JSONDecodeError) as e:
            report.fail(label, f"invalid JSON: {e}")
            continue
        report.ok(label, "parses; no schema")


def run_all(verbose: bool) -> int:
    report = Report(verbose)
    validators = load_schemas(report)
    for rel, schema in CONTRACT_FILES.items():
        path = HERE / rel
        if not path.exists():
            report.fail(rel, "missing")
            continue
        check_document(report, validators, path, schema)
    check_copy(report)
    fixtures = sorted(p for p in FIXTURE_DIR.iterdir() if p.is_file()) if FIXTURE_DIR.is_dir() else []
    if not fixtures:
        report.fail("fixtures/", "no fixtures found")
    for path in fixtures:
        if path.name in FIXTURE_IGNORE:
            continue
        target = fixture_target(path.name)
        if target is None:
            report.fail(f"fixtures/{path.name}", "no schema mapped (add a pattern to FIXTURE_PATTERNS in validate.py)")
            continue
        schema, mode = target
        if mode == "features":
            check_features(report, validators, path, schema)
        else:
            check_document(report, validators, path, schema)
    print(f"\n{report.passed} ok, {report.failed} failed")
    return 1 if report.failed else 0


def run_url(url: str, schema: str, verbose: bool) -> int:
    report = Report(verbose)
    validators = load_schemas(report)
    if schema not in validators:
        report.fail(url, f"unknown or invalid schema {schema!r}; choose one of {', '.join(EXPECTED_SCHEMAS)}")
        return 1
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read()
    except urllib.error.HTTPError as e:
        snippet = " ".join(e.read()[:2000].decode("utf-8", "replace").split())[:200]
        report.fail(url, f"HTTP {e.code}: {snippet}")
        return 1
    except (urllib.error.URLError, OSError) as e:
        report.fail(url, f"request failed: {e}")
        return 1
    try:
        doc = json.loads(body)
    except json.JSONDecodeError as e:
        report.fail(url, f"response is not JSON: {e}")
        return 1
    report_result(report, url, errors_for(validators[schema], doc), schema)
    return 1 if report.failed else 0


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(errors="backslashreplace")  # type: ignore[attr-defined]
    except AttributeError:  # pragma: no cover
        pass
    parser = argparse.ArgumentParser(description="Validate Suplex contract files and fixtures against their schemas.")
    parser.add_argument("--url", help="GET this URL and validate the JSON body instead of the files")
    parser.add_argument("--schema", default="check.response",
                        help="schema name for --url (default: check.response), e.g. ward.response")
    parser.add_argument("-v", "--verbose", action="store_true", help="list every error under a failing file")
    args = parser.parse_args(argv)
    if args.url:
        return run_url(args.url, args.schema, args.verbose)
    return run_all(args.verbose)


if __name__ == "__main__":
    sys.exit(main())
