"""Y2 acceptance check: python pipeline/tiger/ping.py  (needs TIGER_DSN in the environment or .env)"""
from __future__ import annotations

import os
from pathlib import Path

import psycopg


def load_env() -> None:
    env = Path(__file__).resolve().parents[2] / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> None:
    load_env()
    dsn = os.environ.get("TIGER_DSN")
    if not dsn:
        raise SystemExit("TIGER_DSN is not set (put it in .env, never commit it)")
    with psycopg.connect(dsn, connect_timeout=5) as c:
        rows = c.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb'").fetchall()
    print(rows)
    if len(rows) != 1:
        raise SystemExit("timescaledb extension not found")
    print("ok")


if __name__ == "__main__":
    main()
