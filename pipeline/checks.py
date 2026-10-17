"""Pipeline acceptance checks (spec section 4.7). Prints results to paste into /docs/decisions.md.

    python pipeline/checks.py --permits
    python pipeline/checks.py --ward 04
    python pipeline/checks.py --all
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "out"
sys.path.insert(0, str(Path(__file__).resolve().parent))
import permits as P  # noqa: E402

failures: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f": {detail}" if detail else ""))
    if not ok:
        failures.append(label)


def permits_checks() -> None:
    print("== permits ==")
    d = pd.read_parquet(OUT / "permits.parquet")
    d["issued"] = pd.to_datetime(d["issued_at"])
    n = len(d)
    located = d["lat"].notna()
    print(f"  rows {n:,}; with coordinates {located.sum():,}; with a ward {d['ward_id'].notna().sum():,}")
    print("  geocode method: " + ", ".join(f"{k} {v:,}" for k, v in d["geocode_method"].fillna("none").value_counts().items()))
    rate = located.mean()
    check(rate >= 0.90, "geocode rate 90% or better", f"{rate:.1%}")
    geo_id_rate = (d["geocode_method"] == "geo_id").mean()
    print(f"  GEO_ID -> ADDRESS_POINT_ID join rate (T5): {geo_id_rate:.1%}")

    inside = d[(d["issued"] >= P.WINDOW[0]) & (d["issued"] <= P.WINDOW[1])]
    by_kind = inside["kind"].value_counts().to_dict()
    mx = by_kind.get("multiplex", 0)
    dev = mx / P.CITY_452 - 1
    print(f"  issued {P.WINDOW[0]} to {P.WINDOW[1]} by kind: {by_kind}")
    check(abs(dev) <= 0.15, f"multiplex count within 15% of the City's {P.CITY_452}", f"{mx} ({dev:+.1%})")

    since = d[(d["issued"] >= P.WINDOW[0]) & (d["kind"] == "multiplex")]
    per_ward = since["ward_id"].value_counts().sort_index()
    print("  multiplex permits since 2023-05-01 by ward (compare with the Toronto Multiplex Tracker map):")
    print("   " + "  ".join(f"{w}:{c}" for w, c in per_ward.items()))
    print(f"   wards with at least one: {len(per_ward)} of 25; no ward: {since['ward_id'].isna().sum()}")

    counts = json.loads((OUT / "permit_counts.json").read_text())
    total = sum(w["since_may_2023"] for w in counts["wards"].values())
    check(total + counts["unlocated"]["since_may_2023"] == counts["city"]["since_may_2023"],
          "permit_counts.json: ward totals plus unlocated equal the city total",
          f"{total} + {counts['unlocated']['since_may_2023']} = {counts['city']['since_may_2023']}")
    pub = json.loads((OUT / "permits.geojson").read_text())["features"]
    leaked = [k for f in pub[:50] for k in f["properties"] if k not in ("id", "d", "w", "u", "k")]
    check(not leaked, "permits.geojson carries only id, d, w, u, k (no permit numbers or addresses)", f"{len(pub):,} points")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--permits", action="store_true")
    ap.add_argument("--ward")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    if args.permits or args.all or args.ward:
        permits_checks()
    if args.ward or args.all:
        try:
            import lots_checks  # noqa: F401  (added with build_lots.py)
        except ImportError:
            print("== lots == (build_lots.py not built yet)")
        else:
            lots_checks.run(args.ward, failures, check)
    print("\nALL CHECKS PASSED" if not failures else f"\n{len(failures)} CHECK(S) FAILED: " + "; ".join(failures))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
