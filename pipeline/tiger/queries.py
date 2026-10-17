"""Tiger Data queries used by the API and the batch run (spec Appendix E).

Every function returns plain dicts or numbers and raises TigerUnavailable on any error, so callers
can fall back to the trend cache without inspecting the exception.
"""
from __future__ import annotations

import os
from datetime import date

import psycopg


class TigerUnavailable(Exception):
    ...


def _conn():
    dsn = os.environ.get("TIGER_DSN")
    if not dsn:
        raise TigerUnavailable("TIGER_DSN not set")
    try:
        return psycopg.connect(dsn, connect_timeout=2, options="-c statement_timeout=2000")
    except Exception as e:
        raise TigerUnavailable(str(e)) from e


def _months(since: str, until: date) -> list[str]:
    y, m = int(since[:4]), int(since[5:7])
    out = []
    while (y, m) <= (until.year, until.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _run(sql: str, params: tuple = ()) -> list[tuple]:
    try:
        with _conn() as c:
            return c.execute(sql, params).fetchall()
    except TigerUnavailable:
        raise
    except Exception as e:
        raise TigerUnavailable(str(e)) from e


def ward_trend(ward_id: str, since: str = "2022-01-01") -> list[dict]:
    """Monthly multiplex permits and units for one ward, zero-filled through the current month."""
    rows = _run("""SELECT to_char(month, 'YYYY-MM') AS month, permits, units
                   FROM permits_ward_month WHERE ward = %s AND month >= %s ORDER BY month""", (ward_id, since))
    have = {m: (int(p), int(u)) for m, p, u in rows}
    return [{"month": m, "permits": have.get(m, (0, 0))[0], "units": have.get(m, (0, 0))[1]}
            for m in _months(since, date.today())]


def ward_count_since(ward_id: str, since: str = "2023-05-01") -> int:
    rows = _run("SELECT count(*) FROM permits WHERE ward = %s AND is_multiplex AND issued_at >= %s", (ward_id, since))
    return int(rows[0][0])


def all_wards_count_since(since: str = "2023-05-01") -> dict[str, int]:
    rows = _run("SELECT ward, count(*) FROM permits WHERE is_multiplex AND issued_at >= %s GROUP BY ward", (since,))
    return {w: int(n) for w, n in rows}


def all_wards_units_since(since: str = "2023-05-01") -> dict[str, int]:
    rows = _run("SELECT ward, sum(units_created) FROM permits WHERE is_multiplex AND issued_at >= %s GROUP BY ward", (since,))
    return {w: int(n) for w, n in rows}
