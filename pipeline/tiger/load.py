"""Load data/out/permits.parquet into Tiger Data (spec 4.6).

    python pipeline/tiger/load.py            # schema, truncate, COPY, refresh the aggregate, compress, record sizes

Records hypertable_size and hypertable_compression_stats (true before and after totals) in
pipeline/tiger/tiger_stats.json (the numbers behind tiger.md).
"""
from __future__ import annotations

import io
import json
import os
import time
from pathlib import Path

import pandas as pd
import psycopg

from ping import load_env  # noqa: E402  (run as a script from this folder or via python pipeline/tiger/load.py)

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
COLS = ["permit_id", "revision", "issued_at", "ward", "units_created", "units_lost", "kind", "is_multiplex",
        "lat", "lon", "address_point_id", "structure_type", "work"]


def frame() -> pd.DataFrame:
    d = pd.read_parquet(ROOT / "data" / "out" / "permits.parquet")
    d = d[d["ward_id"].notna() & d["issued_at"].notna()].copy()
    out = pd.DataFrame({
        "permit_id": d["permit_id"], "revision": d["REVISION_NUM"].fillna("00"), "issued_at": d["issued_at"],
        "ward": d["ward_id"], "units_created": d["units_created"].astype(int), "units_lost": d["units_lost"].astype(int),
        "kind": d["kind"], "is_multiplex": d["kind"] == "multiplex", "lat": d["lat"], "lon": d["lon"],
        "address_point_id": d["address_point_id"].astype("Int64"), "structure_type": d["STRUCTURE_TYPE"], "work": d["WORK"],
    })
    return out.drop_duplicates(["permit_id", "revision", "issued_at"])[COLS]


def sizes(c: psycopg.Connection, label: str) -> dict:
    size = c.execute("SELECT hypertable_size('permits'), pg_size_pretty(hypertable_size('permits'))").fetchone()
    return {"label": label, "bytes": int(size[0]), "pretty": size[1]}


def main() -> None:
    load_env()
    dsn = os.environ.get("TIGER_DSN")
    if not dsn:
        raise SystemExit("TIGER_DSN is not set")
    df = frame()
    stats: dict = {"rows": len(df), "loaded_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    with psycopg.connect(dsn, autocommit=True) as c:
        c.execute((HERE / "schema.sql").read_text())
        c.execute("TRUNCATE permits")
        buf = io.StringIO()
        df.to_csv(buf, index=False, header=False, na_rep="\\N")
        buf.seek(0)
        with c.cursor() as cur, cur.copy(f"COPY permits ({', '.join(COLS)}) FROM STDIN WITH (FORMAT csv, NULL '\\N')") as cp:
            while chunk := buf.read(1 << 20):
                cp.write(chunk)
        stats["table_rows"] = c.execute("SELECT count(*) FROM permits").fetchone()[0]
        for attempt in range(10):  # the aggregate's background policy job can hold the refresh window briefly
            try:
                c.execute("CALL refresh_continuous_aggregate('permits_ward_month', NULL, NULL)")
                break
            except psycopg.errors.LockNotAvailable:
                time.sleep(2)
        else:
            raise SystemExit("could not refresh permits_ward_month after 10 tries")
        stats["chunks"] = c.execute("SELECT count(*) FROM show_chunks('permits')").fetchone()[0]
        # The compression policy job can run the moment the table is created, so hypertable_size() "before" may
        # already be compressed; the stats view below always holds the true before and after totals.
        stats["size_at_load_end"] = sizes(c, "after load, before the explicit compress_chunk call")
        c.execute("SELECT compress_chunk(c, if_not_compressed => TRUE) FROM show_chunks('permits') c")
        stats["size_after_compression"] = sizes(c, "after compression")
        cols = [d.name for d in c.execute("SELECT * FROM hypertable_compression_stats('permits')").description]
        row = c.execute("SELECT * FROM hypertable_compression_stats('permits')").fetchone()
        stats["compression_stats"] = {k: (v if isinstance(v, (int, float, str, type(None))) else str(v)) for k, v in zip(cols, row)}
    (HERE / "tiger_stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
