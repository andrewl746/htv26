"""One command for the Hour-24 refresh (Y9): redownload, rebuild, check, and reload Tiger Data.

    python pipeline/refresh.py --dry-run --tiger   # preflight only: changes nothing, says what the real run would do
    python pipeline/refresh.py --tiger             # the real run: permits + lots build + checks + Tiger Data reload
    python pipeline/refresh.py                     # same without Tiger Data
    python pipeline/refresh.py --ward 04           # dev ward only for the lots build

Stops at the first failing step. The checks output is saved to data/out/checks_<timestamp>.txt for /docs/decisions.md,
and the permit counts before and after are compared so the team knows which numbers moved.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "data" / "out"
STEPS = ["download.py --all --with-trees", "permits.py", "build_lots.py", "tiger/load.py", "tiger/cache_trends.py", "checks.py"]
NEEDS_GB = 4.0  # the build writes a temp GPKG next to the old one, plus re-downloaded raw files


def run(*args: str) -> None:
    print(f"\n$ {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, *args], cwd=ROOT, check=True)


def counts() -> dict:
    p = OUT / "permit_counts.json"
    return json.loads(p.read_text()) if p.exists() else {}


def compare(before: dict, after: dict) -> None:
    """Print how the permit numbers moved (multiplex permits since May 2023, city and per ward)."""
    if not before or not after:
        return
    print("\npermit counts since May 2023 (multiplex), before -> after:")
    b, a = before["city"]["since_may_2023"], after["city"]["since_may_2023"]
    print(f"  city {b} -> {a}  (no ward: {before['unlocated']['since_may_2023']} -> {after['unlocated']['since_may_2023']})")
    moved = [(w, before["wards"][w]["since_may_2023"], after["wards"][w]["since_may_2023"])
             for w in sorted(after["wards"]) if w in before["wards"]
             and before["wards"][w]["since_may_2023"] != after["wards"][w]["since_may_2023"]]
    print("  wards that moved: " + (", ".join(f"{w}: {x}->{y}" for w, x, y in moved) if moved else "none"))
    print("  Tell Simone: the Devpost numbers must equal the new ward_summary.json.")


def check(ok: bool, label: str, detail: str = "") -> bool:
    print(f"  [{'ok' if ok else 'FIX'}] {label}" + (f": {detail}" if detail else ""))
    return ok


def dry_run(args: argparse.Namespace) -> int:
    """Everything the real run needs, checked without downloading, building or writing."""
    print("Hour-24 refresh: dry run (nothing is changed)\n")
    good = True
    py = sys.version_info
    good &= check((3, 12) <= py[:2] <= (3, 14), "python version", f"{py.major}.{py.minor}")
    for mod in ("pandas", "geopandas", "pyogrio", "pyarrow", "requests", "psycopg"):
        try:
            __import__(mod)
            check(True, f"import {mod}")
        except ImportError:
            good &= check(False, f"import {mod}", "pip install -r requirements.txt")
    free = shutil.disk_usage(ROOT).free / 1e9
    good &= check(free >= NEEDS_GB, "free disk", f"{free:.1f} GB (needs about {NEEDS_GB:.0f} GB)")
    for step in STEPS:
        script = HERE / step.split()[0]
        good &= check(script.exists(), f"script {step.split()[0]}")
    for name in ("suplex.gpkg", "permits.parquet", "permit_counts.json", "data_dates.json"):
        check((OUT / name).exists(), f"current data/out/{name} (will be replaced)")

    if args.tiger:
        sys.path.insert(0, str(HERE / "tiger"))
        from ping import load_env
        load_env()
        dsn = os.environ.get("TIGER_DSN")
        good &= check(bool(dsn), "TIGER_DSN is set (value never printed)")
        if dsn:
            try:
                import psycopg
                with psycopg.connect(dsn, connect_timeout=5) as c:
                    ext = c.execute("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'").fetchone()
                    rows = c.execute("SELECT count(*) FROM permits").fetchone()[0]
                good &= check(ext is not None, "Tiger Data reachable, timescaledb present", f"{ext[0] if ext else '-'}; {rows:,} permits now")
            except Exception as e:  # noqa: BLE001  (report the type only, never the DSN)
                good &= check(False, "Tiger Data reachable", type(e).__name__)
        print("  note: load.py truncates the permits table before the COPY. If it fails midway the table is empty;"
              " the API keeps serving the trend cache, so rerun load.py.")

    print("\nupstream check (City open data, package_show last_refreshed vs data/out/data_dates.json):")
    try:
        sys.path.insert(0, str(HERE))
        import download as dl
        recorded = json.loads((OUT / "data_dates.json").read_text()) if (OUT / "data_dates.json").exists() else {}
        slugs = sorted({v[0] for v in dl.FILES.values()} | {v[0] for v in dl.RESOLVED.values()})
        changed = 0
        for slug in slugs:
            pkg = dl.package_show(slug)
            now = pkg.get("last_refreshed") or pkg.get("metadata_modified")
            same = str(now) == str(recorded.get(slug))
            changed += not same
            print(f"  {'same   ' if same else 'CHANGED'} {slug}: {recorded.get(slug)} -> {now}")
        print(f"  {changed} of {len(slugs)} datasets changed upstream since the last download")
    except Exception as e:  # noqa: BLE001
        good &= check(False, "reach the City open data portal", f"{type(e).__name__}: {e}")

    print("\nthe real run would do, in order:")
    n = 1
    for step in STEPS:
        if step.startswith("tiger/") and not args.tiger:
            continue
        if step.startswith("download") and args.skip_download:
            continue
        print(f"  {n}. python pipeline/{step}" + (f" ({'--ward ' + args.ward if args.ward else '--all'})" if step.startswith(("build", "checks")) else ""))
        n += 1
    print("last build took 211 s for the whole city; downloads add a few minutes; Tiger reload about a minute.")
    print("afterwards (by hand, outward-facing): gh release upload data-2026-10-17 --clobber <suplex_ward04.gpkg, the gzipped"
          " citywide gpkg, pipeline_small_files.zip>, then tell Andrew and Simone.")
    print("\nREADY" if good else "\nNOT READY: fix the [FIX] lines above first")
    return 0 if good else 1


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ward", help="build only this ward instead of the whole city")
    ap.add_argument("--tiger", action="store_true", help="also reload Tiger Data and the trend cache")
    ap.add_argument("--skip-download", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="preflight only: check the environment and upstream, change nothing")
    args = ap.parse_args()
    if args.dry_run:
        sys.exit(dry_run(args))
    t0 = time.time()
    before = counts()
    scope = ["--ward", args.ward] if args.ward else ["--all"]
    if not args.skip_download:
        run("pipeline/download.py", "--all", "--with-trees")
    run("pipeline/permits.py")
    run("pipeline/build_lots.py", *scope)
    if args.tiger:
        run("pipeline/tiger/load.py")
        run("pipeline/tiger/cache_trends.py")
    out = OUT / f"checks_{time.strftime('%Y%m%d_%H%M')}.txt"
    res = subprocess.run([sys.executable, "pipeline/checks.py", *scope], cwd=ROOT, capture_output=True, text=True, check=False)
    out.write_text(res.stdout + res.stderr)
    print(res.stdout)
    compare(before, counts())
    print(f"checks saved to {out.relative_to(ROOT)}; total {time.time() - t0:.0f}s")
    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
