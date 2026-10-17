"""Building permits to multiplex permits (spec section 4.3, Rule A).

    python pipeline/permits.py --report      # task Y1: counts and the Rule A funnel, no geocoding
    python pipeline/permits.py               # task Y3: geocode and write data/out/permits.* (needs Address Points)

Rule A mirrors the Toronto Multiplex Tracker's filtering, then splits the kept rows by kind.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "permits"
RAW_DIR = ROOT / "data" / "raw"
OUT = ROOT / "data" / "out"
FILES = ["building-permits-active-permits.csv", "cleared-building-permits-since-2017.csv"]

SINCE = "2022-01-01"          # rows kept from this issue date
WINDOW = ("2023-05-01", "2024-11-30")  # the City's 452 window
CITY_452 = 452
WORK_SUITE = "Second Suite (New)"
WORK_LANEWAY = "New Laneway / Rear Yard Suite"
KINDS = ["multiplex", "secondary_suite", "laneway_garden", "other"]
PERMIT_RULE = ("A: permits creating 2-6 units, non-SFD structure, one row per project "
               "(Toronto Multiplex Tracker rule), multiplex kind")
UNIT_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}


def load_raw() -> pd.DataFrame:
    """Active and cleared files stacked, every column as text, issued date parsed."""
    frames = []
    for name in FILES:
        df = pd.read_csv(RAW / name, dtype=str, keep_default_na=False, na_values=[""])
        df["source_file"] = "active" if "active" in name else "cleared"
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df["issued"] = pd.to_datetime(df["ISSUED_DATE"], errors="coerce")
    return df


def project_key(permit_num: pd.Series) -> pd.Series:
    """PERMIT_NUM without its type suffix: the first two tokens ("22 128979 PLB" -> "22 128979")."""
    return permit_num.str.split().str[:2].str.join(" ")


def named_units(*texts: pd.Series) -> pd.Series:
    """Unit count named in STRUCTURE_TYPE / PROPOSED_USE ("2 Unit - Detached", "Triplex"); NaN when none."""
    out = pd.Series(float("nan"), index=texts[0].index)
    word_map = {"duplex": 2, "triplex": 3, "fourplex": 4, "quadruplex": 4, "fiveplex": 5, "sixplex": 6}
    for t in texts:
        t = t.fillna("").str.lower()
        num = t.str.extract(r"\b([1-9]\d?)\s*[- ]?\s*(?:unit|plex|dwelling)")[0].astype(float)
        word = t.str.extract(r"\b(one|two|three|four|five|six)\s*[- ]?\s*(?:unit|plex|dwelling)")[0].map(UNIT_WORDS)
        named = t.str.extract(r"\b(duplex|triplex|fourplex|quadruplex|fiveplex|sixplex)\b")[0].map(word_map)
        out = out.fillna(num).fillna(word).fillna(named)
    return out


def rule_a(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Apply Rule A steps 1 to 5. Returns the kept rows (one per project, with `kind`) and the funnel counts."""
    funnel: dict[str, int] = {"rows loaded": len(df)}
    d = df[df["issued"] >= SINCE].copy()
    funnel[f"issued on or after {SINCE}"] = len(d)

    d["units_created"] = pd.to_numeric(d["DWELLING_UNITS_CREATED"], errors="coerce")
    d = d[d["units_created"].between(1, 6) & (d["units_created"] % 1 == 0)]
    funnel["units created 1 to 6"] = len(d)

    keep_work = d["WORK"].isin([WORK_SUITE, WORK_LANEWAY])
    not_sfd = ~d["STRUCTURE_TYPE"].fillna("").str.startswith("SFD")
    d = d[not_sfd | keep_work].copy()
    funnel["STRUCTURE_TYPE not SFD* (or suite/laneway work)"] = len(d)

    d["project"] = project_key(d["PERMIT_NUM"])
    d["units_created"] = d["units_created"].astype(int)
    d = d.sort_values(["project", "units_created", "issued"], ascending=[True, False, True])
    d = d.drop_duplicates("project", keep="first").copy()
    funnel["one row per project"] = len(d)

    d["units_named"] = named_units(d["STRUCTURE_TYPE"], d["PROPOSED_USE"])
    # Spec 4.3 step 5 also lets a structure type naming 2 to 6 units make a multiplex. Checked on
    # 2026-10-17: that adds ~830 rows with units created = 1 (a suite added to a house) in the May 2023
    # to Nov 2024 window and lands at 1,278 vs the City's 452. Units created 2 to 6 lands at 446.
    # So the count of units actually created decides; the named count is kept only for the report.
    d["kind"] = "other"
    d.loc[d["units_created"].between(2, 6), "kind"] = "multiplex"
    d.loc[d["WORK"] == WORK_LANEWAY, "kind"] = "laneway_garden"
    d.loc[d["WORK"] == WORK_SUITE, "kind"] = "secondary_suite"
    return d, funnel


def window_counts(d: pd.DataFrame) -> pd.Series:
    inside = d[(d["issued"] >= WINDOW[0]) & (d["issued"] <= WINDOW[1])]
    return inside["kind"].value_counts()


def load_addresses() -> gpd.GeoDataFrame:
    """Address Points as plain points in EPSG:4326 with the columns the geocoder needs."""
    cols = ["ADDRESS_POINT_ID", "ADDRESS_FULL", "WARD", "ADDRESS_CLASS", "MAINT_STAGE"]
    a = gpd.read_file(RAW_DIR / "address-points-4326.gpkg", columns=cols, engine="pyogrio")
    a["geometry"] = shapely.get_geometry(a.geometry.values, 0)  # layer is MultiPoint
    a["ADDRESS_POINT_ID"] = a["ADDRESS_POINT_ID"].astype("int64")
    a["addr_key"] = a["ADDRESS_FULL"].fillna("").str.lower().str.replace(r"\s+", " ", regex=True).str.strip()
    return a


def permit_address_key(d: pd.DataFrame) -> pd.Series:
    parts = [d[c].fillna("").str.strip() for c in ["STREET_NUM", "STREET_NAME", "STREET_TYPE", "STREET_DIRECTION"]]
    key = parts[0] + " " + parts[1] + " " + parts[2] + " " + parts[3]
    return key.str.lower().str.replace(r"\s+", " ", regex=True).str.strip()


def geocode(d: pd.DataFrame, addr: gpd.GeoDataFrame, wards: gpd.GeoDataFrame) -> pd.DataFrame:
    """Rule A step 6 and 7: GEO_ID -> ADDRESS_POINT_ID, then street number + name, then the ward."""
    d = d.copy()
    a = addr.copy()
    a["lon"] = a.geometry.x
    a["lat"] = a.geometry.y
    by_id = a.set_index("ADDRESS_POINT_ID")[["lat", "lon", "WARD"]]

    d["address_point_id"] = pd.to_numeric(d["GEO_ID"], errors="coerce").astype("Int64")
    hit = d["address_point_id"].isin(by_id.index)
    d.loc[~hit, "address_point_id"] = pd.NA
    d["geocode_method"] = None
    d.loc[hit, "geocode_method"] = "geo_id"

    # fallback: street number + name + type + direction against ADDRESS_FULL; prefer land points, regular stage
    pool = a[a["addr_key"] != ""].copy()
    pool["_rank"] = (pool["ADDRESS_CLASS"] != "L").astype(int) * 2 + (pool["MAINT_STAGE"] != "REGULAR").astype(int)
    pool = pool.sort_values("_rank").drop_duplicates("addr_key").set_index("addr_key")["ADDRESS_POINT_ID"]
    keys = permit_address_key(d)
    miss = ~hit
    cand = keys[miss].map(pool)
    found = cand.notna()
    d.loc[cand.index[found], "address_point_id"] = cand[found].astype("Int64")
    d.loc[cand.index[found], "geocode_method"] = "street_match"

    ok = d["address_point_id"].notna()
    pts = by_id.reindex(d.loc[ok, "address_point_id"].astype("int64"))
    d.loc[ok, "lat"] = pts["lat"].to_numpy()
    d.loc[ok, "lon"] = pts["lon"].to_numpy()
    d["ward_id"] = None
    d.loc[ok, "ward_id"] = pts["WARD"].astype(str).str.strip().str.zfill(2).to_numpy()
    d.loc[d["ward_id"].isin(["00", "nan", "None"]), "ward_id"] = None

    # point-in-polygon for rows with coordinates but no ward
    need = d["ward_id"].isna() & d["lat"].notna()
    if need.any():
        p = gpd.GeoDataFrame(d.loc[need, []], geometry=gpd.points_from_xy(d.loc[need, "lon"], d.loc[need, "lat"]), crs=4326)
        j = gpd.sjoin(p, wards[["ward_id", "geometry"]], how="left", predicate="within")
        j = j[~j.index.duplicated()]
        d.loc[j.index, "ward_id"] = j["ward_id"].to_numpy()
    return d


def load_wards() -> gpd.GeoDataFrame:
    w = gpd.read_file(RAW_DIR / "city-wards-data-4326.gpkg", engine="pyogrio")
    w["ward_id"] = w["AREA_SHORT_CODE"].astype(str).str.zfill(2)
    return w[["ward_id", "geometry"]]


def build() -> pd.DataFrame:
    """Y3: Rule A + geocode, write data/out/permits.parquet, permits.geojson, permit_counts.json."""
    OUT.mkdir(parents=True, exist_ok=True)
    kept, funnel = rule_a(load_raw())
    d = geocode(kept, load_addresses(), load_wards())
    d["units_lost"] = pd.to_numeric(d["DWELLING_UNITS_LOST"], errors="coerce").fillna(0).astype(int)
    d["permit_id"] = d["project"]
    d["issued_at"] = d["issued"].dt.strftime("%Y-%m-%d")

    keep_cols = [c for c in d.columns if c not in ("issued",)]
    pq = d[keep_cols].copy()
    pq["address_point_id"] = pq["address_point_id"].astype("Int64")
    pq.to_parquet(OUT / "permits.parquet", index=False)

    # public points: no permit numbers, no addresses
    pub = d[d["lat"].notna() & d["ward_id"].notna()].sort_values(["issued", "permit_id"]).reset_index(drop=True)
    feats = [
        {"type": "Feature",
         "geometry": {"type": "Point", "coordinates": [round(r.lon, 5), round(r.lat, 5)]},
         "properties": {"id": i + 1, "d": r.issued_at, "w": r.ward_id, "u": int(r.units_created), "k": r.kind}}
        for i, r in enumerate(pub.itertuples())
    ]
    (OUT / "permits.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))

    (OUT / "permit_counts.json").write_text(json.dumps(counts(d), indent=2))
    print(f"wrote permits.parquet ({len(pq):,} rows), permits.geojson ({len(feats):,} points), permit_counts.json")
    return d


def counts(d: pd.DataFrame) -> dict:
    """permit_counts.json: per ward since_may_2023 by kind, by_year 2022 to 2026, units_since_may_2023."""
    start = pd.Timestamp(WINDOW[0])
    years = [str(y) for y in range(2022, 2027)]

    def block(g: pd.DataFrame) -> dict:
        since = g[g["issued"] >= start]
        mx = since[since["kind"] == "multiplex"]
        by_kind = {k: int((since["kind"] == k).sum()) for k in KINDS}
        yr = {y: int(((g["kind"] == "multiplex") & (g["issued"].dt.year == int(y))).sum()) for y in years}
        yr_kind = {k: {y: int(((g["kind"] == k) & (g["issued"].dt.year == int(y))).sum()) for y in years} for k in KINDS}
        return {"since_may_2023": by_kind["multiplex"], "by_kind_since_may_2023": by_kind, "by_year": yr,
                "by_year_by_kind": yr_kind, "units_since_may_2023": int(mx["units_created"].sum())}

    located = d[d["ward_id"].notna()]
    wards = {w: block(g) for w, g in located.groupby("ward_id")}
    for i in range(1, 26):
        wards.setdefault(f"{i:02d}", block(located.iloc[0:0]))
    return {
        "rule": PERMIT_RULE, "kind_of_since_may_2023": "multiplex", "window_start": WINDOW[0],
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "city": block(d), "unlocated": block(d[d["ward_id"].isna()]), "wards": dict(sorted(wards.items())),
    }


def report() -> None:
    raw = load_raw()
    print("== Y1 permits report ==")
    for src, g in raw.groupby("source_file"):
        print(f"{src:8s} rows {len(g):>8,}   issued {g['issued'].min():%Y-%m-%d} to {g['issued'].max():%Y-%m-%d}   no issue date {g['issued'].isna().sum():,}")
    print(f"total rows {len(raw):,}")
    ids = raw[["PERMIT_NUM", "REVISION_NUM"]].duplicated().sum()
    print(f"rows repeating a (PERMIT_NUM, REVISION_NUM) pair: {ids:,}")

    units = pd.to_numeric(raw["DWELLING_UNITS_CREATED"], errors="coerce")
    nonnull = raw["DWELLING_UNITS_CREATED"].notna().sum()
    print(f"\nDWELLING_UNITS_CREATED parsed as a number: {units.notna().sum():,} of {nonnull:,} non-null ({units.notna().sum() / max(nonnull, 1):.1%}); null: {raw['DWELLING_UNITS_CREATED'].isna().sum():,}")
    print(f"integer between 1 and 6: {units.between(1, 6).sum():,}")
    since = raw["issued"] >= SINCE
    print(f"integer between 1 and 6 and issued since {SINCE}: {(units.between(1, 6) & since).sum():,}")

    kept, funnel = rule_a(raw)
    print("\nRule A funnel:")
    for k, v in funnel.items():
        print(f"  {v:>9,}  {k}")
    print(f"  rows removed by the one-per-project step: {funnel['STRUCTURE_TYPE not SFD* (or suite/laneway work)'] - funnel['one row per project']:,}")

    named_only = kept[(kept["units_created"] == 1) & kept["units_named"].between(2, 6) & (kept["kind"] == "other")]
    print(f"rows with units created = 1 whose structure/use names 2 to 6 units (kind other, not multiplex): {len(named_only):,}")
    print("\nRule A rows by kind (since 2022):")
    print(kept["kind"].value_counts().to_string())
    wc = window_counts(kept)
    print(f"\nIssued {WINDOW[0]} to {WINDOW[1]} by kind:")
    print(wc.to_string())
    mx = int(wc.get("multiplex", 0))
    print(f"multiplex in window: {mx}  vs the City's {CITY_452}: {mx / CITY_452 - 1:+.1%}")

    pool = raw[since & units.between(1, 6)]
    for col in ["STRUCTURE_TYPE", "WORK", "PROPOSED_USE"]:
        print(f"\nDistinct {col} (rows with units 1 to 6 issued since {SINCE}; top 40 of {pool[col].nunique()}):")
        print(pool[col].value_counts(dropna=False).head(40).to_string())
    print("\nDistinct STRUCTURE_TYPE among kept rows by kind (top 25):")
    print(kept.groupby("kind")["STRUCTURE_TYPE"].value_counts().groupby(level=0).head(25).to_string())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", action="store_true", help="Y1 report only")
    args = ap.parse_args()
    if args.report:
        report()
    else:
        build()


if __name__ == "__main__":
    main()
