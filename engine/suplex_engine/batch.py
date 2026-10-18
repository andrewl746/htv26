"""Batch run (MASTERSPEC 3.4): the engine over every lot of the processed GeoPackage, reduced to the ward files.

    python -m suplex_engine.batch --ward 04            # the dev ward (repeat --ward, or "04,19", for more)
    python -m suplex_engine.batch --all                # every ward; needs the citywide GeoPackage

Reads SUPLEX_DATA_DIR (default ./data/out) and SUPLEX_GPKG (default <data_dir>/suplex.gpkg) like the API and
builds every lot's `LotInput` with the API's own loader (`api/store.py`), then calls `run_check`: one engine and
one loader, so a lot can never get a different answer on the map than in the address check (3.1). Each ward is
cut into strips of about `--chunk` lots that run in parallel, each loading only its strip of the GeoPackage.

Writes into the data directory:

- `wards/{id}.geojson`: one feature per lot with `LotFeatureProps` (Appendix A), the outline simplified by 0.5 m
  and in EPSG:4326, the parcel id as the feature id (the map's click opens `/check?lot_id=`); no address, no area;
- `batch/{id}.json`: the ward's counts, kept so a one-ward run rebuilds `ward_summary.json` with the others;
- `ward_summary.json`: every ward run so far plus the `city` entry (`WardSummaryFile`);
- `batch_report.md`: counts per ward, run times, versions and the sanity checks.

Permit counts come from Tiger Data (`pipeline/tiger/queries.py`) when TIGER_DSN answers, else from the pipeline's
`permit_counts.json`; `permits.source` records which. Unlike the rest of the engine this module reads files
(geopandas, through the API's store); the rules themselves stay pure.
"""
from __future__ import annotations

import argparse
import gzip
import importlib
import json
import logging
import math
import os
import sys
import time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from . import ENGINE_VERSION
from .check import run_check
from .classify import review_flags
from .config import contracts_dir, load_config
from .designs import load_designs
from .fit import RULE_ORDER
from .models import CheckResult

log = logging.getLogger("suplex.batch")

REPO = Path(__file__).resolve().parents[2]
SUMMARY_VERSION = "0.1.0"
SIMPLIFY_M = 0.5            # MASTERSPEC 3.4: lot outlines simplified by 0.5 m for the map
COORD_DECIMALS = 6          # EPSG:4326 to about 0.1 m
DEFAULT_CHUNK = 1500        # lots per worker task (one strip of a ward)
NEIGHBOUR_MARGIN_M = 10.0   # read margin beyond the context radius, so a strip sees every neighbour /check sees

RESULTS = ("fits", "borderline", "no_fit", "not_checked")            # best first
RESULT_RANK = {r: i for i, r in enumerate(RESULTS)}
CLASSES = ("condo", "non_residential", "older_bylaw", "larger_building", "unmeasurable", "attached", "checked")
HOUSE_CLASSES = ("attached", "checked")
FLAG_IDS = ("heritage_register", "heritage_district", "ravine", "trca", "site_exception", "vacant")
FLAG_KEYS = dict(zip(FLAG_IDS, ("hr", "hd", "rv", "tr", "ex", "vc"), strict=True))   # FlagId -> FlagKey (types.ts)
PERMIT_KINDS = ("multiplex", "secondary_suite", "laneway_garden", "other")
CITY = "city"
PRESENCE_CHECK = "all 25 wards present"
CITY_NAME = "City of Toronto"


# ---------------------------------------------------------------------------
# One lot
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LotOutcome:
    """What the map and the counts need from one lot's CheckResult."""

    lot_id: int
    c: str                          # LotClass
    b: str                          # best result across the four designs
    r: dict[str, str]               # DesignKey -> Result
    k: str | None                   # the rule that limits the best design (blocking or borderline)
    flags: tuple[str, ...]          # every FlagId on the lot, site_exception included
    f: tuple[str, ...]              # review flags as FlagKeys (never "ex")
    a: int
    v: int

    def props(self) -> dict[str, Any]:
        return {"id": self.lot_id, "c": self.c, "b": self.b, "r": self.r, "k": self.k, "f": list(self.f),
                "a": self.a, "v": self.v}


def limiting_rule(design: Any) -> str | None:
    """The blocking rule of a design that does not fit, the first borderline rule of one too close to call."""
    if design.result == "no_fit":
        return design.blocking_rule
    if design.result == "borderline":
        return next((row.rule_id for row in design.rules if row.borderline and not row.not_applicable), None)
    return None


def lot_outcome(lot_id: int, result: CheckResult, design_order: list[tuple[str, str]]) -> LotOutcome:
    """Reduce a CheckResult. `design_order` is [(design_id, key)] in designs.json order; the best design is the
    first one with the best result, so ties go to the smaller design (Fourplex Narrow first)."""
    by_id = {d.design_id: d for d in result.designs}
    ordered = [by_id[did] for did, _ in design_order]
    best = min(ordered, key=lambda d: RESULT_RANK[d.result])          # min keeps the first of equals
    lot = result.lot
    flags = tuple(f.id for f in lot.flags)
    return LotOutcome(
        lot_id=lot_id, c=lot.class_, b=best.result,
        r={key: by_id[did].result for did, key in design_order},
        k=limiting_rule(best), flags=flags, f=tuple(FLAG_KEYS[f.id] for f in review_flags(lot.flags)),
        a=int(lot.attached), v=int(lot.vacant),
    )


# ---------------------------------------------------------------------------
# One strip of a ward (runs in a worker process)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Strip:
    ward_id: str
    index: int
    count: int
    lot_ids: tuple[int, ...]
    bbox: tuple[float, float, float, float]
    data_dir: str
    gpkg: str


@dataclass
class StripResult:
    ward_id: str
    index: int
    outcomes: list[LotOutcome] = field(default_factory=list)
    features: list[str] = field(default_factory=list)
    errors: list[tuple[int, str]] = field(default_factory=list)
    load_s: float = 0.0
    run_s: float = 0.0


def _api_store() -> Any:
    """`api.store`, with the repo root importable (the batch can run from any folder)."""
    if str(REPO) not in sys.path:
        sys.path.insert(0, str(REPO))
    from api import store

    return store


def feature_json(lot_id: int, geometry: Any, props: dict[str, Any]) -> str:
    from shapely.geometry import mapping

    return json.dumps({"type": "Feature", "id": lot_id, "geometry": mapping(geometry), "properties": props},
                      separators=(",", ":"))


def map_outlines(geoms: Any) -> Any:
    """Lot outlines for the map: simplified by SIMPLIFY_M in metres, then EPSG:4326 rounded to COORD_DECIMALS."""
    import numpy as np
    import shapely
    from pyproj import Transformer

    to_wgs84 = Transformer.from_crs("EPSG:2952", "EPSG:4326", always_xy=True)

    def project(xy: Any) -> Any:
        lon, lat = to_wgs84.transform(xy[:, 0], xy[:, 1])
        return np.round(np.column_stack([lon, lat]), COORD_DECIMALS)

    return shapely.transform(shapely.simplify(geoms, SIMPLIFY_M, preserve_topology=True), project)


def run_strip(strip: Strip) -> StripResult:
    """Load the strip's part of the GeoPackage and run every one of its lots through `run_check`."""
    import numpy as np

    store_mod = _api_store()
    out = StripResult(strip.ward_id, strip.index)
    t0 = time.perf_counter()
    store = store_mod.load(strip.data_dir, strip.gpkg, bbox=strip.bbox)
    out.load_s = time.perf_counter() - t0

    design_order = [(d.id, d.key) for d in store.designs.designs]
    positions: list[int] = []
    t1 = time.perf_counter()
    for lot_id in strip.lot_ids:
        pos = store.lot_pos(str(lot_id))
        if pos is None:
            out.errors.append((lot_id, "not in the strip's GeoPackage read"))
            continue
        try:
            result = run_check(store.lot_input(pos), store.cfg, store.designs, store.data_dates)
            out.outcomes.append(lot_outcome(lot_id, result, design_order))
            positions.append(pos)
        except Exception as e:  # noqa: BLE001  one bad lot is reported, never silently reclassified
            out.errors.append((lot_id, f"{type(e).__name__}: {e}"))
    outlines = map_outlines(store.lot_geoms[np.asarray(positions, dtype=np.int64)]) if positions else []
    out.features = [feature_json(o.lot_id, g, o.props()) for o, g in zip(out.outcomes, outlines, strict=True)]
    out.run_s = time.perf_counter() - t1
    return out


# ---------------------------------------------------------------------------
# Planning: wards -> strips
# ---------------------------------------------------------------------------

def ward_lots(gpkg: Path, ward_id: str) -> tuple[list[int], Any]:
    """The ward's parcel ids and their bounds (4 x n), in the same order."""
    import pyogrio

    where = f"ward_id = '{ward_id}'"
    ids = pyogrio.read_dataframe(gpkg, layer="lots", columns=["parcelid"], where=where, read_geometry=False)
    _, bounds = pyogrio.read_bounds(gpkg, layer="lots", where=where)
    return [int(p) for p in ids["parcelid"].tolist()], bounds


def plan_strips(ward_id: str, lot_ids: list[int], bounds: Any, chunk: int, margin_m: float, data_dir: Path,
                gpkg: Path) -> list[Strip]:
    """Cut the ward west to east into strips of about `chunk` lots; each strip reads its lots' bounds + margin."""
    import numpy as np

    n = len(lot_ids)
    if n == 0:
        return []
    count = max(1, math.ceil(n / chunk))
    cx = (bounds[0] + bounds[2]) / 2.0
    order = np.argsort(cx, kind="stable")
    strips = []
    for i, part in enumerate(np.array_split(order, count)):
        b = bounds[:, part]
        bbox = (float(b[0].min() - margin_m), float(b[1].min() - margin_m),
                float(b[2].max() + margin_m), float(b[3].max() + margin_m))
        strips.append(Strip(ward_id, i, count, tuple(lot_ids[j] for j in part.tolist()), bbox, str(data_dir),
                            str(gpkg)))
    return strips


# ---------------------------------------------------------------------------
# Counting
# ---------------------------------------------------------------------------

def ward_counts(outcomes: list[LotOutcome], design_order: list[tuple[str, str]]) -> dict[str, Any]:
    """The lot-derived part of a WardSummaryEntry (no permits, no headline)."""
    classes = Counter(o.c for o in outcomes)
    best = Counter(o.b for o in outcomes)
    by_design = {did: Counter(o.r[key] for o in outcomes) for did, key in design_order}
    blocking = Counter(o.k for o in outcomes if o.b == "no_fit" and o.k is not None)
    flags = Counter(f for o in outcomes for f in o.flags)
    return {
        "lots_run": len(outcomes),
        "classes": {c: classes.get(c, 0) for c in CLASSES},
        "any_design": {r: best.get(r, 0) for r in RESULTS},
        "by_design": {did: {r: c.get(r, 0) for r in RESULTS} for did, c in by_design.items()},
        "blocking": {r: blocking.get(r, 0) for r in RULE_ORDER},
        "flags": {f: flags.get(f, 0) for f in FLAG_IDS},
        "any_on_fitting_lots": sum(1 for o in outcomes if o.b == "fits" and o.f),
    }


def _pct(part: int, whole: int) -> float:
    return round(100.0 * part / whole, 1) if whole else 0.0


def _add(into: dict[str, Any], more: dict[str, Any]) -> None:
    for k, v in more.items():
        if isinstance(v, dict):
            _add(into.setdefault(k, {}), v)
        else:
            into[k] = into.get(k, 0) + v


def top_blocking_rules(blocking: dict[str, int]) -> list[dict[str, Any]]:
    """Every rule that blocks a lot's best design, most lots first (ties in rule order)."""
    rows = [(n, RULE_ORDER.index(r), r) for r, n in blocking.items() if n > 0]
    return [{"rule_id": r, "count": n} for n, _, r in sorted(rows, key=lambda t: (-t[0], t[1]))]


def summary_entry(ward_id: str, ward_name: str, sixplex: str, lots_total: int, counts: dict[str, Any],
                  permits: dict[str, Any], data_dates: dict[str, str], generated_at: str) -> dict[str, Any]:
    """One WardSummaryEntry (Appendix A). `could` is the lots whose best design fits; an upper bound."""
    house = sum(counts["classes"][c] for c in HOUSE_CLASSES)
    could, did = counts["any_design"]["fits"], permits["since_may_2023"]
    return {
        "ward_id": ward_id,
        "ward_name": ward_name,
        "sixplex_overlay": sixplex,
        "lots_total": lots_total,
        "house_lots": house,
        "classes": counts["classes"],
        "any_design": counts["any_design"],
        "by_design": counts["by_design"],
        "top_blocking_rules": top_blocking_rules(counts["blocking"]),
        "attached_share_pct": _pct(counts["classes"]["attached"], house),
        "flags": {**counts["flags"], "any_on_fitting_lots": counts["any_on_fitting_lots"]},
        "permits": permits,
        "headline": {"could": could, "could_pct_of_house_lots": _pct(could, house), "did": did,
                     "lots_per_permit": round(could / did) if did else None},
        "data_dates": data_dates,
        "generated_at": generated_at,
    }


# ---------------------------------------------------------------------------
# Permits: Tiger Data first, the pipeline's permit_counts.json otherwise
# ---------------------------------------------------------------------------

def _local_permits(entry: dict[str, Any], rule: str) -> dict[str, Any]:
    return {
        "rule": rule,
        "since_may_2023": int(entry.get("since_may_2023", 0)),
        "by_kind_since_may_2023": {k: int(entry.get("by_kind_since_may_2023", {}).get(k, 0)) for k in PERMIT_KINDS},
        "by_year": {y: int(n) for y, n in sorted(entry.get("by_year", {}).items())},
        "units_since_may_2023": int(entry.get("units_since_may_2023", 0)),
        "source": "local",
    }


def tiger_counts(since: str) -> tuple[dict[str, int], dict[str, int]] | None:
    """(multiplex permits, units) per ward since `since` from Tiger Data, or None when it does not answer."""
    if not os.environ.get("TIGER_DSN"):
        return None
    _api_store()                        # api/__init__.py puts pipeline/tiger on sys.path
    try:
        import queries

        return queries.all_wards_count_since(since), queries.all_wards_units_since(since)
    except Exception as e:  # noqa: BLE001  TigerUnavailable, ImportError, anything: the local file
        log.warning("Tiger Data unavailable (%s: %s); permit counts from permit_counts.json", type(e).__name__, e)
        return None


@dataclass
class Permits:
    rule: str
    wards: dict[str, dict[str, Any]]
    unlocated: dict[str, Any]
    local_city: dict[str, Any]
    source: str
    notes: list[str]


def load_permits(data_dir: Path, since: str, ward_ids: list[str]) -> Permits:
    store_mod = _api_store()
    raw = store_mod._read_json(data_dir / "permit_counts.json")
    if not isinstance(raw, dict) or not isinstance(raw.get("wards"), dict):
        raise SystemExit(f"{data_dir / 'permit_counts.json'} is missing or has no wards: copy it from the data release")
    rule = str(raw.get("rule") or "")
    wards = {w: _local_permits(raw["wards"].get(w, {}), rule) for w in ward_ids}
    unlocated = _local_permits(raw.get("unlocated", {}), rule)
    local_city = _local_permits(raw.get("city", {}), rule)
    notes: list[str] = []
    tiger = tiger_counts(since)
    source = "local"
    if tiger is not None:
        counts, units = tiger
        source = "tigerdata"
        for w in ward_ids:
            n, u = int(counts.get(w, 0)), int(units.get(w, 0) or 0)
            local = wards[w]
            if (n, u) != (local["since_may_2023"], local["units_since_may_2023"]):
                notes.append(f"ward {w}: Tiger Data {n} permits / {u} units, permit_counts.json "
                             f"{local['since_may_2023']} / {local['units_since_may_2023']}")
            local.update(since_may_2023=n, units_since_may_2023=u, source="tigerdata")
            local["by_kind_since_may_2023"]["multiplex"] = n
    return Permits(rule, wards, unlocated, local_city, source, notes)


def city_permits(permits: Permits, ward_ids: list[str], all_wards: bool) -> dict[str, Any]:
    """The sum over the wards, plus the permits with no ward when every ward is present (the city total)."""
    parts = [permits.wards[w] for w in ward_ids] + ([permits.unlocated] if all_wards else [])
    out = {"rule": permits.rule, "since_may_2023": 0, "by_kind_since_may_2023": dict.fromkeys(PERMIT_KINDS, 0),
           "by_year": {}, "units_since_may_2023": 0, "source": permits.source}
    for p in parts:
        out["since_may_2023"] += p["since_may_2023"]
        out["units_since_may_2023"] += p["units_since_may_2023"]
        for k in PERMIT_KINDS:
            out["by_kind_since_may_2023"][k] += p["by_kind_since_may_2023"][k]
        for y, n in p["by_year"].items():
            out["by_year"][y] = out["by_year"].get(y, 0) + n
    out["by_year"] = dict(sorted(out["by_year"].items()))
    return out


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))


def write_ward_geojson(path: Path, features: list[tuple[int, str]]) -> None:
    body = ",\n".join(f for _, f in sorted(features))
    _write_text(path, '{"type":"FeatureCollection","features":[\n' + body + ("\n" if body else "") + "]}\n")


def read_wards(gpkg: Path) -> dict[str, dict[str, str]]:
    import pyogrio

    w = pyogrio.read_dataframe(gpkg, layer="wards", read_geometry=False)
    return {str(r.ward_id): {"ward_name": str(r.ward_name), "sixplex_overlay": str(r.sixplex_overlay)}
            for r in w.itertuples()}


def run(ward_ids: list[str], data_dir: Path, gpkg: Path, workers: int, chunk: int) -> dict[str, Any]:
    """Run the wards, write wards/{id}.geojson and batch/{id}.json for each; return the run's bookkeeping."""
    cfg, designs = load_config(), load_designs()
    design_order = [(d.id, d.key) for d in designs.designs]
    margin = cfg.context_radius_m + NEIGHBOUR_MARGIN_M
    t0 = time.perf_counter()

    strips: list[Strip] = []
    totals: dict[str, int] = {}
    for w in ward_ids:
        ids, bounds = ward_lots(gpkg, w)
        totals[w] = len(ids)
        strips += plan_strips(w, ids, bounds, chunk, margin, data_dir, gpkg)
    empty = [w for w in ward_ids if totals[w] == 0]
    if empty:
        raise SystemExit(f"no lots for ward(s) {', '.join(empty)} in {gpkg}: for other wards than the release's "
                         "dev ward, point SUPLEX_GPKG at the citywide GeoPackage")
    log.info("%d lots in %d ward(s), %d strips, %d workers", sum(totals.values()), len(ward_ids), len(strips), workers)

    this = importlib.import_module("suplex_engine.batch")    # pickle the worker by its package name, not __main__
    pending = Counter(s.ward_id for s in strips)
    results: dict[str, list[StripResult]] = {w: [] for w in ward_ids}
    done_wards: dict[str, dict[str, Any]] = {}
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(this.run_strip, s) for s in strips]
        for fut in as_completed(futures):
            res: StripResult = fut.result()
            results[res.ward_id].append(res)
            pending[res.ward_id] -= 1
            log.info("ward %s strip %d done: %d lots, %d errors, load %.1f s, run %.1f s", res.ward_id, res.index,
                     len(res.outcomes), len(res.errors), res.load_s, res.run_s)
            if pending[res.ward_id] == 0:
                done_wards[res.ward_id] = finish_ward(res.ward_id, results.pop(res.ward_id), totals[res.ward_id],
                                                      design_order, data_dir, gpkg)
    return {"wards": done_wards, "seconds": time.perf_counter() - t0, "lots": sum(totals.values()),
            "workers": workers, "strips": len(strips)}


def finish_ward(ward_id: str, parts: list[StripResult], lots_total: int, design_order: list[tuple[str, str]],
                data_dir: Path, gpkg: Path) -> dict[str, Any]:
    outcomes = [o for p in parts for o in p.outcomes]
    features = [(o.lot_id, f) for p in parts for o, f in zip(p.outcomes, p.features, strict=True)]
    errors = sorted(e for p in parts for e in p.errors)
    write_ward_geojson(data_dir / "wards" / f"{ward_id}.geojson", features)
    cfg, designs = load_config(), load_designs()
    part = {
        "ward_id": ward_id,
        "lots_total": lots_total,
        **ward_counts(outcomes, design_order),
        "errors": [{"lot_id": i, "error": m} for i, m in errors],
        "strips": len(parts),
        "cpu_seconds": round(sum(p.load_s + p.run_s for p in parts), 1),
        "engine_version": ENGINE_VERSION, "designs_version": designs.version, "config_version": cfg.version,
        "gpkg": str(gpkg),
        "generated_at": _now(),
    }
    _write_text(data_dir / "batch" / f"{ward_id}.json", json.dumps(part, indent=1) + "\n")
    log.info("ward %s: %d of %d lots, %d errors", ward_id, len(outcomes), lots_total, len(errors))
    return part


def read_parts(data_dir: Path) -> dict[str, dict[str, Any]]:
    out = {}
    for path in sorted((data_dir / "batch").glob("*.json")):
        part = json.loads(path.read_text(encoding="utf-8"))
        out[part["ward_id"]] = part
    return out


def build_summary(parts: dict[str, dict[str, Any]], wards: dict[str, dict[str, str]], permits: Permits,
                  data_dates: dict[str, str], generated_at: str) -> dict[str, Any]:
    """WardSummaryFile from every ward part on disk plus the city entry."""
    designs = load_designs()
    ward_ids = sorted(parts)
    all_wards = set(ward_ids) >= set(wards)
    entries = {}
    city_counts: dict[str, Any] = {}
    for w in ward_ids:
        p = parts[w]
        counts = {k: p[k] for k in ("lots_run", "classes", "any_design", "by_design", "blocking", "flags",
                                    "any_on_fitting_lots")}
        entries[w] = summary_entry(w, wards[w]["ward_name"], wards[w]["sixplex_overlay"], p["lots_total"], counts,
                                   permits.wards[w], data_dates, generated_at)
        _add(city_counts, {**counts, "lots_total": p["lots_total"]})
    overlays = {wards[w]["sixplex_overlay"] for w in ward_ids}
    city = summary_entry(CITY, CITY_NAME, overlays.pop() if len(overlays) == 1 else "partial",
                         city_counts.get("lots_total", 0), city_counts or _zero_counts(designs),
                         city_permits(permits, ward_ids, all_wards), data_dates, generated_at)
    return {
        "version": SUMMARY_VERSION,
        "engine_version": ENGINE_VERSION,
        "designs_version": designs.version,
        "permit_rule": permits.rule,
        "generated_at": generated_at,
        "data_dates": data_dates,
        "wards": entries,
        "city": city,
    }


def _zero_counts(designs: Any) -> dict[str, Any]:
    return ward_counts([], [(d.id, d.key) for d in designs.designs])


# ---------------------------------------------------------------------------
# Sanity checks and the report
# ---------------------------------------------------------------------------

def hand_checked_lots() -> dict[int, dict[str, Any]] | None:
    """The A8 expectations from engine/tests/test_lots.py, or None when the tests are not importable."""
    engine_dir = str(Path(__file__).resolve().parents[1])
    if engine_dir not in sys.path:
        sys.path.append(engine_dir)
    try:
        from tests.test_lots import LOTS
    except Exception as e:  # noqa: BLE001  the report says it was skipped
        log.warning("hand-checked lots not importable (%s)", e)
        return None
    return LOTS


def read_features(path: Path) -> dict[int, dict[str, Any]]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    return {int(f["id"]): f["properties"] for f in doc["features"]}


def sanity_checks(summary: dict[str, Any], parts: dict[str, dict[str, Any]], wards: dict[str, dict[str, str]],
                  data_dir: Path, permits: Permits) -> list[tuple[str, bool, str]]:
    """(check, passed, detail) rows for batch_report.md."""
    from jsonschema import Draft202012Validator

    rows: list[tuple[str, bool, str]] = []
    schemas = contracts_dir() / "schemas"
    summary_schema = Draft202012Validator(json.loads((schemas / "ward_summary.file.schema.json").read_text("utf-8")))
    errs = list(summary_schema.iter_errors(summary))
    rows.append(("ward_summary.json validates against its schema", not errs, errs[0].message[:200] if errs else ""))

    missing = sorted(set(wards) - set(parts))
    rows.append((PRESENCE_CHECK, not missing, f"missing: {', '.join(missing)}" if missing else "25 of 25"))

    props_schema = Draft202012Validator(json.loads((schemas / "lot_feature.props.schema.json").read_text("utf-8")))
    hand = hand_checked_lots()
    for w, entry in summary["wards"].items():
        part = parts[w]
        total = entry["lots_total"]
        sums = {"classes": sum(entry["classes"].values()), "any_design": sum(entry["any_design"].values()),
                **{d: sum(c.values()) for d, c in entry["by_design"].items()}}
        bad = {k: v for k, v in sums.items() if v != total}
        rows.append((f"ward {w}: classes, best results and each design's results sum to the {total:,} lots", not bad,
                     ", ".join(f"{k} {v:,}" for k, v in bad.items())))
        rows.append((f"ward {w}: no engine errors", not part["errors"],
                     "; ".join(f"{e['lot_id']}: {e['error']}" for e in part["errors"][:5])))
        path = data_dir / "wards" / f"{w}.geojson"
        feats = read_features(path)
        unique = {json.dumps({**p, "id": 0}, sort_keys=True) for p in feats.values()}
        bad_props = [m.message for u in unique for m in props_schema.iter_errors(json.loads(u))][:1]
        size_gz = len(gzip.compress(path.read_bytes(), compresslevel=6))
        rows.append((f"wards/{w}.geojson: one valid feature per lot, {size_gz / 1e6:.1f} MB gzipped (limit 8)",
                     len(feats) == total and not bad_props and size_gz < 8e6,
                     f"{len(feats):,} features" + (f"; {bad_props[0]}" if bad_props else "")))
        if hand is not None:
            found = [pid for pid in hand if pid in feats]
            failed = []
            for pid in found:
                exp, got = hand[pid], feats[pid]
                keys = {"fourplex_narrow": "fn", "fourplex_wide": "fw", "sixplex_narrow": "sn", "sixplex_wide": "sw"}
                ok = ("cls" not in exp or got["c"] == exp["cls"]) and ("not_cls" not in exp or got["c"] != exp["not_cls"])
                ok = ok and all(got["r"][keys[d]] == r for d, r in exp.get("results", {}).items())
                if not ok:
                    failed.append(str(pid))
            if found:
                name = f"ward {w}: the {len(found)} hand-checked lots (docs/test-lots.md) keep their class and results"
                rows.append((name, not failed, f"differ: {', '.join(failed)}" if failed else ""))
    if summary["city"]["permits"]["source"] == "local" and not missing:
        city, local = summary["city"]["permits"], permits.local_city
        same = all(city[k] == local[k] for k in ("since_may_2023", "by_kind_since_may_2023", "by_year",
                                                 "units_since_may_2023"))
        rows.append(("city permits (wards plus the permits with no ward) equal permit_counts.json's city entry", same,
                     "" if same else f"{city['since_may_2023']} against {local['since_may_2023']}"))
    return rows


def write_report(path: Path, summary: dict[str, Any], parts: dict[str, dict[str, Any]], run_info: dict[str, Any],
                 checks: list[tuple[str, bool, str]], permits: Permits, gpkg: Path) -> None:
    cfg, designs = load_config(), load_designs()
    ran = sorted(run_info["wards"])
    source = "Tiger Data, pipeline/tiger/queries.py" if permits.source == "tigerdata" else "permit_counts.json"
    generated = (f"Generated {summary['generated_at']} by `python -m suplex_engine.batch` (engine {ENGINE_VERSION}, "
                 f"designs {designs.version}, engine_config {cfg.version}). GeoPackage: `{gpkg}`.")
    this_run = (f"This run: ward(s) {', '.join(ran)}; {run_info['lots']:,} lots in {run_info['strips']} strips on "
                f"{run_info['workers']} workers, {run_info['seconds']:.0f} s wall clock "
                f"({run_info['lots'] / max(run_info['seconds'], 1e-9):.0f} lots a second).")
    caveat = ("Counts of lots that may fit are upper bounds (screening only, not a permit or legal advice). The table "
              "is in ward order and is not a ranking.")
    header = ("| Ward | Lots | House lots | May fit (upper bound) | Too close to call | Doesn't fit | Not checked | "
              "Attached share | Multiplex permits since May 2023 | Errors | CPU s | Run at |")
    lines = [
        "# Batch report",
        "",
        generated,
        "",
        this_run,
        f"Permit counts: **{permits.source}** ({source}).",
        "",
        caveat,
        "",
        "## Sanity checks",
        "",
        "| Check | Result | Detail |",
        "|---|---|---|",
        *[f"| {name} | {'pass' if ok else '**FAIL**'} | {detail} |" for name, ok, detail in checks],
        "",
        "## Per ward",
        "",
        header,
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for w, e in summary["wards"].items():
        a = e["any_design"]
        lines.append(f"| {w} {e['ward_name']} | {e['lots_total']:,} | {e['house_lots']:,} | {a['fits']:,} | "
                     f"{a['borderline']:,} | {a['no_fit']:,} | {a['not_checked']:,} | {e['attached_share_pct']}% | "
                     f"{e['permits']['since_may_2023']} | {len(parts[w]['errors'])} | {parts[w]['cpu_seconds']} | "
                     f"{parts[w]['generated_at']} |")
    c = summary["city"]
    a = c["any_design"]
    city_row = (f"| city | {c['lots_total']:,} | {c['house_lots']:,} | {a['fits']:,} | {a['borderline']:,} | "
                f"{a['no_fit']:,} | {a['not_checked']:,} | {c['attached_share_pct']}% | "
                f"{c['permits']['since_may_2023']} | | | |")
    lines += [
        city_row,
        "",
        "## City classes and blocking rules",
        "",
        "| Class | Lots |",
        "|---|---|",
        *[f"| {k} | {v:,} |" for k, v in c["classes"].items()],
        "",
        "| Rule blocking the best design | Lots |",
        "|---|---|",
        *[f"| {r['rule_id']} | {r['count']:,} |" for r in c["top_blocking_rules"]],
        "",
    ]
    if permits.notes:
        lines += ["## Tiger Data against permit_counts.json", "", *[f"- {n}" for n in permits.notes], ""]
    errors = [(w, e) for w in sorted(parts) for e in parts[w]["errors"]]
    if errors:
        lines += ["## Engine errors", "", *[f"- ward {w}, lot {e['lot_id']}: {e['error']}" for w, e in errors[:200]],
                  ""]
    _write_text(path, "\n".join(lines))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m suplex_engine.batch", description=__doc__.split("\n\n")[0])
    which = ap.add_mutually_exclusive_group(required=True)
    which.add_argument("--ward", action="append", help='ward id, e.g. 04 (repeat, or "04,19")')
    which.add_argument("--all", action="store_true", help="every ward in the GeoPackage")
    ap.add_argument("--data-dir", default=os.environ.get("SUPLEX_DATA_DIR") or str(REPO / "data" / "out"))
    ap.add_argument("--gpkg", default=os.environ.get("SUPLEX_GPKG") or None,
                    help="GeoPackage (default <data-dir>/suplex.gpkg, or SUPLEX_GPKG)")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    ap.add_argument("--chunk", type=int, default=DEFAULT_CHUNK, help="lots per strip")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    data_dir = Path(args.data_dir)
    gpkg = Path(args.gpkg) if args.gpkg else data_dir / "suplex.gpkg"
    if not gpkg.is_file():
        raise SystemExit(f"GeoPackage not found: {gpkg}")
    wards = read_wards(gpkg)
    if args.all:
        ward_ids = sorted(wards)
    else:
        ward_ids = sorted({w.strip().zfill(2) for arg in args.ward for w in arg.split(",") if w.strip()})
        unknown = [w for w in ward_ids if w not in wards]
        if unknown:
            raise SystemExit(f"unknown ward(s): {', '.join(unknown)}")

    cfg = load_config()
    run_info = run(ward_ids, data_dir, gpkg, args.workers, args.chunk)
    parts = read_parts(data_dir)
    store_mod = _api_store()
    raw_dates = store_mod._read_json(data_dir / "data_dates.json")
    data_dates = store_mod.normalise_data_dates(raw_dates if isinstance(raw_dates, dict) else {})
    permits = load_permits(data_dir, cfg.permits_since, sorted(wards))
    summary = build_summary(parts, wards, permits, data_dates, _now())
    _write_text(data_dir / "ward_summary.json", json.dumps(summary, indent=1, ensure_ascii=False) + "\n")
    checks = sanity_checks(summary, parts, wards, data_dir, permits)
    write_report(data_dir / "batch_report.md", summary, parts, run_info, checks, permits, gpkg)
    failed = [name for name, ok, _ in checks if not ok]
    log.info("wrote ward_summary.json (%d wards) and batch_report.md; %d of %d checks pass", len(parts),
             len(checks) - len(failed), len(checks))
    for name in failed:
        log.warning("FAIL: %s", name)
    # A one-ward run cannot have all 25 wards; every other failed check fails the run.
    return 1 if [n for n in failed if args.all or n != PRESENCE_CHECK] else 0


if __name__ == "__main__":
    sys.exit(main())
