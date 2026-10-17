"""One command for the Hour-24 refresh (Y9): redownload, rebuild, check, and reload Tiger Data.

    python pipeline/refresh.py                 # permits + lots build + checks (no Tiger)
    python pipeline/refresh.py --tiger         # also reload Tiger Data and rewrite the trend cache (needs TIGER_DSN)
    python pipeline/refresh.py --ward 04       # dev ward only for the lots build

Stops at the first failing step. The checks output is saved to data/out/checks_<timestamp>.txt for /docs/decisions.md.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def run(*args: str) -> None:
    print(f"\n$ {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, *args], cwd=ROOT, check=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ward", help="build only this ward instead of the whole city")
    ap.add_argument("--tiger", action="store_true", help="also reload Tiger Data and the trend cache")
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()
    t0 = time.time()
    scope = ["--ward", args.ward] if args.ward else ["--all"]
    if not args.skip_download:
        run("pipeline/download.py", "--all", "--with-trees")
    run("pipeline/permits.py")
    run("pipeline/build_lots.py", *scope)
    if args.tiger:
        run("pipeline/tiger/load.py")
        run("pipeline/tiger/cache_trends.py")
    out = ROOT / "data" / "out" / f"checks_{time.strftime('%Y%m%d_%H%M')}.txt"
    res = subprocess.run([sys.executable, "pipeline/checks.py", *scope], cwd=ROOT, capture_output=True, text=True)
    out.write_text(res.stdout + res.stderr)
    print(res.stdout)
    print(f"checks saved to {out.relative_to(ROOT)}; total {time.time() - t0:.0f}s")
    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
