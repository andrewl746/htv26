"""Terminal version of the Tiger Data walkthrough, built for a screen recording (Y9).

    python pipeline/tiger/demo.py              # press Enter to advance each step
    python pipeline/tiger/demo.py --auto 5     # advance every 5 seconds
    python pipeline/tiger/demo.py --fallback   # last step: Tiger unreachable -> the cached trend (no DSN needed)

Runs the queries in walkthrough.sql. It never prints the connection string, host or password; errors are
reduced to one generic line. Use a terminal font of 18 pt or larger.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ping import load_env  # noqa: E402

BOLD, DIM, GREEN, RESET = "\033[1m", "\033[2m", "\033[32m", "\033[0m"


def blocks() -> list[tuple[str, str]]:
    text = (HERE / "walkthrough.sql").read_text()
    out = []
    for b in re.split(r"\n(?=-- \d\.)", text)[1:]:
        lines = b.strip().splitlines()
        title = re.sub(r"^-- \d\.\s*(\(\d:\d\d\)\s*)?", "", lines[0])
        out.append((title, "\n".join(lines[1:])))
    return out


def table(cols: list[str], rows: list[tuple]) -> str:
    cells = [cols] + [[str(v) for v in r] for r in rows]
    w = [max(len(r[i]) for r in cells) for i in range(len(cols))]
    fmt = lambda r: "  ".join(str(v).ljust(w[i]) for i, v in enumerate(r))  # noqa: E731
    return "\n".join([BOLD + fmt(cells[0]) + RESET, "  ".join("-" * x for x in w)] + [fmt(r) for r in cells[1:]])


def pause(auto: float | None) -> None:
    if auto:
        time.sleep(auto)
    else:
        input(DIM + "\n[Enter]" + RESET)


def run_fallback() -> None:
    print(f"{BOLD}Step 5 (fallback): Tiger Data unreachable{RESET}\n")
    os.environ.pop("TIGER_DSN", None)
    import queries
    try:
        queries.ward_trend("04")
    except queries.TigerUnavailable as e:
        print(f"ward_trend('04') -> TigerUnavailable: {e}")
    cache = json.loads((HERE.parents[1] / "data" / "out" / "trend_cache" / "04.json").read_text())
    last = cache["series"][-1]
    print(f"\nthe API serves the cached file instead:  source = {GREEN}{cache['source']}{RESET}, "
          f"{len(cache['series'])} months, latest {last['month']} = {last['permits']} permits")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--auto", type=float, help="seconds between steps instead of waiting for Enter")
    ap.add_argument("--fallback", action="store_true", help="show only the cached-fallback step")
    args = ap.parse_args()
    if args.fallback:
        run_fallback()
        return
    load_env()
    dsn = os.environ.get("TIGER_DSN")
    if not dsn:
        raise SystemExit("TIGER_DSN is not set (it lives in .env)")
    import psycopg
    os.system("clear")
    try:
        conn = psycopg.connect(dsn, connect_timeout=5)
    except Exception:  # noqa: BLE001  never echo the error: it can contain the host
        raise SystemExit("could not connect to Tiger Data")
    with conn:
        for i, (title, sql) in enumerate(blocks(), 1):
            print(f"{BOLD}Step {i}: {title}{RESET}\n")
            print(DIM + sql + RESET + "\n")
            if not args.auto:
                pause(None)
            cur = conn.execute(sql)
            print(table([d.name for d in cur.description], cur.fetchall()))
            if i < len(blocks()):
                pause(args.auto)
                os.system("clear")
    print(f"\n{GREEN}Tiger Data: hypertable, continuous aggregate, compression, all on the real service.{RESET}")


if __name__ == "__main__":
    main()
