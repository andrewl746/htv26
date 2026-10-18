"""Permitted multiplexes for the "Multiplexes near you" layer (street-level, no house numbers).

    python pipeline/multiplexes.py              # write data/out/multiplexes.geojson and print the summary
    python pipeline/multiplexes.py --snapshot   # also copy it to pipeline/snapshots/ (small, committed, for the demo)
    python pipeline/multiplexes.py --summary    # print the summary of the existing file only

Reads data/out/permits.parquet (python pipeline/download.py --permits, then python pipeline/permits.py).
A permit is not a finished building: "cleared" means the City closed the permit, "active" means permitted.
Unit counts are gross (units lost to demolition are not netted). Permits that cannot be geocoded are left out.
The Toronto Multiplex Tracker was checked on 2026-10-17 as a cross-check only: it drops rows with an LLM label
and an address-match step, so its counts differ from the City's 452 in the May 2023 to Nov 2024 window
(Tracker 232, ours 438).
"""
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "out"
SNAPSHOT = ROOT / "pipeline" / "snapshots" / "multiplexes.geojson"
NAME = "multiplexes.geojson"

# STATUS values that are not a permitted project
DROP_STATUS = ["cancel", "refus", "abandon", "withdrawn"]
NEW_BUILD_WORK = ["New Building", "New Building - By Renovation"]  # the by-renovation permits are demolish-and-rebuild
CAVEATS = [
    "A permit is not a finished building: it shows what the City permitted, not what stands today.",
    "Unit counts are gross: units lost to demolition are not subtracted.",
    "Some permits cannot be geocoded and are left out.",
    "Locations are the street only. Work type is derived from the permit's work and description fields.",
]


def structure(s: pd.Series) -> pd.Series:
    """detached | semi | townhouse | other, from STRUCTURE_TYPE text."""
    t = s.fillna("").str.lower()
    out = pd.Series("other", index=s.index)
    out[t.str.contains("detached") & ~t.str.contains("semi")] = "detached"
    out[t.str.contains("semi")] = "semi"
    out[t.str.contains("townhouse")] = "townhouse"
    return out


def work_type(d: pd.DataFrame) -> pd.Series:
    """new_build | conversion. Only the City's "New Building" work types count as new; "Multiple Projects"
    (additions, conversions, demolitions of parts) is conversion, checked by hand on 2026-10-17."""
    return pd.Series("conversion", index=d.index).mask(d["WORK"].isin(NEW_BUILD_WORK), "new_build")


def street(d: pd.DataFrame) -> pd.Series:
    """"Dundas St W": street name, type and direction, no number."""
    parts = [d[c].fillna("").str.strip() for c in ["STREET_NAME", "STREET_TYPE", "STREET_DIRECTION"]]
    label = (parts[0] + " " + parts[1] + " " + parts[2]).str.replace(r"\s+", " ", regex=True).str.strip().str.title()
    label = label.str.replace(r"'S\b", "'s", regex=True)
    return label.str.replace(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), regex=True)


def build_frame(permits: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    mx = permits[permits["kind"] == "multiplex"]
    status = mx["STATUS"].fillna("").str.lower()
    dropped = status.apply(lambda s: any(w in s for w in DROP_STATUS))
    mx = mx[~dropped]
    located = mx["lat"].notna() & mx["ward_id"].notna()
    stats = {"multiplex permits": int((permits["kind"] == "multiplex").sum()), "cancelled or refused, dropped": int(dropped.sum()),
             "not geocoded, left out": int((~located).sum())}
    mx = mx[located].sort_values(["issued_at", "permit_id"]).reset_index(drop=True)
    out = pd.DataFrame({
        "id": range(1, len(mx) + 1),
        "street": street(mx),
        "ward": mx["ward_id"],
        "units": mx["units_created"].astype(int),
        "structure": structure(mx["STRUCTURE_TYPE"]),
        "work": work_type(mx),
        "status": mx["source_file"],
        "issued": mx["issued_at"],
        "lon": mx["lon"].round(5),
        "lat": mx["lat"].round(5),
    })
    return out, stats


def source_dates() -> dict[str, str]:
    p = OUT / "data_dates.json"
    if not p.exists():
        return {}
    j = json.loads(p.read_text())
    return {"active": j.get("building-permits-active-permits", ""), "cleared": j.get("building-permits-cleared-permits", ""),
            "fetched_at": j.get("_fetched_at", "")}


def write(frame: pd.DataFrame, stats: dict[str, int]) -> dict:
    props = ["id", "street", "ward", "units", "structure", "work", "status", "issued"]
    feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [r.lon, r.lat]},
              "properties": {c: getattr(r, c) if c != "units" and c != "id" else int(getattr(r, c)) for c in props}}
             for r in frame.itertuples()]
    doc = {"type": "FeatureCollection", "title": "Permitted multiplexes (2 to 6 units), Toronto",
           "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "source_dates": source_dates(),
           "source": "City of Toronto Open Data: Building Permits - Active Permits and Cleared Permits",
           "rule": "permits creating 2 to 6 units since 2022-01-01, non-SFD structure, one row per project; cancelled, refused and withdrawn removed",
           "stats": stats, "caveats": CAVEATS, "features": feats}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / NAME).write_text(json.dumps(doc, separators=(",", ":")))
    return doc


def summary(doc: dict) -> None:
    f = pd.DataFrame([x["properties"] for x in doc["features"]])
    print(f"== permitted multiplexes (fetched {doc['source_dates'].get('fetched_at', '?')}, built {doc['generated_at']}) ==")
    for k, v in doc["stats"].items():
        print(f"  {k}: {v:,}")
    print(f"  written: {len(f):,} permits, {int(f['units'].sum()):,} gross units")
    for col in ["status", "units", "work", "structure"]:
        print(f"\nby {col}:\n{f[col].value_counts().sort_index().to_string()}")
    print(f"\nby year issued:\n{f['issued'].str[:4].value_counts().sort_index().to_string()}")
    print(f"\nby ward:\n{f['ward'].value_counts().sort_index().to_string()}")
    print(f"\nissue date range: {f['issued'].min()} to {f['issued'].max()}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--snapshot", action="store_true", help=f"also copy to {SNAPSHOT.relative_to(ROOT)}")
    ap.add_argument("--summary", action="store_true", help="print the summary of the existing file only")
    args = ap.parse_args()
    if args.summary:
        summary(json.loads((OUT / NAME).read_text()))
        return
    permits = pd.read_parquet(OUT / "permits.parquet")
    doc = write(*build_frame(permits))
    if args.snapshot:
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(OUT / NAME, SNAPSHOT)
    summary(doc)


if __name__ == "__main__":
    main()
