"""Build data/out/suplex.gpkg (spec section 4.4): lots, corridors, addresses, buildings, wards, sixplex_overlay.

    python pipeline/build_lots.py --ward 04      # the dev ward (task Y4)
    python pipeline/build_lots.py --all          # all 25 wards (task Y6)

Everything is EPSG:2952 (metres). Wards are built one at a time and appended, so memory stays small.
Needs the files from `python pipeline/download.py --all`.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "out"
OVERLAY_FILE = Path(__file__).resolve().parent / "data" / "sixplex_overlay_ward23.geojson"

CRS_M = 2952
SIXPLEX_FULL_WARDS = ["04", "09", "10", "11", "12", "13", "14", "19"]  # By-law 654-2025: Toronto and East York CC
BUFFER_BBOX_DEG = 0.004      # ~300 m read margin around a ward, in degrees
NEIGHBOUR_M = 150            # buildings kept this far outside the ward (3D neighbours)
CORRIDOR_M = 50
MIN_ZONE_OVERLAP = 0.25      # a lot takes a zone only if the zone covers at least this share of it
MIN_OVERLAY_OVERLAP_M2 = 1.0  # sliver guard for the "intersects" flags
LOT_TYPES = ["COMMON", "CONDO"]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ---------------------------------------------------------------- reading helpers

def read_m(path: str | Path, bbox: tuple | None = None, layer: str | None = None, columns: list[str] | None = None) -> gpd.GeoDataFrame:
    """Read a layer (bbox in the file's CRS), repair geometry, return in EPSG:2952."""
    g = gpd.read_file(path, bbox=bbox, layer=layer, columns=columns, engine="pyogrio")
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g = g.to_crs(CRS_M)
    bad = ~g.geometry.is_valid
    if bad.any():
        g.loc[bad, "geometry"] = shapely.make_valid(g.loc[bad, "geometry"].values)
    return g


def largest_overlap(left: gpd.GeoDataFrame, right: gpd.GeoDataFrame, cols: list[str]) -> pd.DataFrame:
    """For each left row the right row with the largest intersection area. Index = left index;
    columns = cols plus `overlap_m2` and `overlap_frac` (share of the left geometry's area)."""
    if left.empty or right.empty:
        return pd.DataFrame(columns=cols + ["overlap_m2", "overlap_frac"])
    pairs = gpd.sjoin(left[["geometry"]], right[cols + ["geometry"]], how="inner", predicate="intersects")
    r_geom = right.geometry.loc[pairs["index_right"]].values if "index_right" in pairs else None
    if r_geom is None:  # geopandas names the right index column differently when the right index is named
        raise RuntimeError("sjoin did not return index_right")
    inter = shapely.area(shapely.intersection(left.geometry.loc[pairs.index].values, r_geom))
    pairs = pairs.assign(overlap_m2=inter)
    pairs = pairs[pairs["overlap_m2"] > 0]
    best = pairs.sort_values("overlap_m2", ascending=False)
    best = best[~best.index.duplicated(keep="first")]
    out = best.drop(columns=["geometry", "index_right"])
    out["overlap_frac"] = out["overlap_m2"] / left.geometry.area.loc[out.index]
    return out


def intersects_flag(lots: gpd.GeoDataFrame, layer: gpd.GeoDataFrame, min_area: float = MIN_OVERLAY_OVERLAP_M2) -> pd.Series:
    """True for lots whose geometry overlaps the layer by more than min_area m² (so touching edges do not count)."""
    flag = pd.Series(False, index=lots.index)
    if layer.empty:
        return flag
    pairs = gpd.sjoin(lots[["geometry"]], layer[["geometry"]], how="inner", predicate="intersects")
    if pairs.empty:
        return flag
    inter = shapely.area(shapely.intersection(lots.geometry.loc[pairs.index].values, layer.geometry.loc[pairs["index_right"]].values))
    flag.loc[pairs.index[inter > min_area].unique()] = True
    return flag


def nullify(s: pd.Series, bad: tuple = (-1,)) -> pd.Series:
    return s.where(~s.isin(bad))


# ---------------------------------------------------------------- reference layers

def load_wards() -> gpd.GeoDataFrame:
    w = read_m(RAW / "city-wards-data-4326.gpkg")
    w["ward_id"] = w["AREA_SHORT_CODE"].astype(str).str.zfill(2)
    w["ward_name"] = w["AREA_NAME"]
    return w[["ward_id", "ward_name", "geometry"]].sort_values("ward_id").reset_index(drop=True)


def build_overlay(wards: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """The sixplex overlay polygon and the wards table with sixplex_overlay = full | partial | none."""
    parts = [wards[wards["ward_id"].isin(SIXPLEX_FULL_WARDS)].geometry.union_all()]
    if OVERLAY_FILE.exists():
        ov = gpd.read_file(OVERLAY_FILE).to_crs(CRS_M)
        ov["geometry"] = shapely.make_valid(ov.geometry.values)
        parts.append(ov.geometry.union_all())
    else:
        log(f"warning: {OVERLAY_FILE.name} missing; the Ward 23 part of the overlay is not applied yet")
    union = shapely.union_all(parts)
    overlay = gpd.GeoDataFrame({"name": ["sixplex_overlay"]}, geometry=[union], crs=CRS_M)

    status = []
    for r in wards.itertuples():
        if r.ward_id in SIXPLEX_FULL_WARDS:
            status.append("full")
        else:
            share = r.geometry.intersection(union).area / r.geometry.area
            status.append("partial" if share > 0.001 else "none")
    wards = wards.assign(sixplex_overlay=status)
    return overlay, wards


def load_trca() -> gpd.GeoDataFrame | None:
    """TRCA regulated area as a spatially indexed GPKG cache of the downloaded GeoJSON."""
    gj, cache = RAW / "trca-regulated-area.geojson", RAW / "trca-regulated-area.gpkg"
    if not cache.exists():
        if not gj.exists():
            log("warning: TRCA file missing (python pipeline/download.py --only trca); flag_trca stays false")
            return None
        log("caching TRCA GeoJSON as GPKG (once)")
        g = gpd.read_file(gj, engine="pyogrio")
        g["geometry"] = shapely.make_valid(g.geometry.values)
        g.to_file(cache, driver="GPKG", engine="pyogrio")
    return gpd.read_file(cache, engine="pyogrio")  # kept in 4326; clipped per ward below


# ---------------------------------------------------------------- one ward

def parse_area(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.astype("string").str.extract(r"([0-9]+(?:\.[0-9]+)?)")[0], errors="coerce")


def build_ward(ward_id: str, wards: gpd.GeoDataFrame, overlay: gpd.GeoDataFrame, ctx: dict) -> dict[str, gpd.GeoDataFrame]:
    t0 = time.time()
    w = wards[wards["ward_id"] == ward_id]
    if w.empty:
        raise SystemExit(f"unknown ward {ward_id}")
    wgeom = w.geometry.iloc[0]
    w4326 = w.to_crs(4326).geometry.iloc[0]
    minx, miny, maxx, maxy = w4326.bounds
    bbox = (minx - BUFFER_BBOX_DEG, miny - BUFFER_BBOX_DEG, maxx + BUFFER_BBOX_DEG, maxy + BUFFER_BBOX_DEG)
    area_zone = box(*bbox)

    # ---- parcels: lots (this ward) and corridors
    parcels = read_m(RAW / "property-boundaries-4326.gpkg", bbox=bbox)
    parcels = parcels.rename(columns={"PARCELID": "parcelid", "FEATURE_TYPE": "feature_type", "STATEDAREA": "stated_area"})
    log(f"ward {ward_id}: {len(parcels):,} parcels in bbox")
    cand = parcels[parcels["feature_type"].isin(LOT_TYPES)].copy()
    ward_of = largest_overlap(cand, wards, ["ward_id"])
    cand["ward_id"] = ward_of["ward_id"].reindex(cand.index)
    all_lots = cand[cand["ward_id"].notna()].copy()           # lots of every ward in the bbox (for building assignment)
    lots = cand[cand["ward_id"] == ward_id].copy()
    lots["area_m2"] = lots.geometry.area
    lots["stated_area_m2"] = parse_area(lots["stated_area"])
    corridors = parcels[(parcels["feature_type"] == "CORRIDOR")].copy()
    corridors = corridors[corridors.intersects(w.buffer(CORRIDOR_M).union_all())][["parcelid", "geometry"]]

    # ---- zoning
    zoning = read_m(RAW / "zoning-area-4326.gpkg", bbox=bbox)
    zmap = {"ZN_ZONE": "zn_zone", "GEN_ZONE": "gen_zone", "ZBL_SECTN": "zbl_sectn", "ZN_STRING": "zn_string",
            "FRONTAGE": "frontage_min_m", "ZN_AREA": "zn_area", "UNITS": "units_max", "COVERAGE": "coverage",
            "ZN_EXCPTN": "zn_exception", "EXCPTN_NO": "exception_no", "ZN_STATUS": "zn_status"}
    zj = largest_overlap(lots, zoning, list(zmap))
    zj = zj[zj["overlap_frac"] >= MIN_ZONE_OVERLAP]
    zj = zj.drop(columns=["overlap_m2"]).rename(columns=zmap).rename(columns={"overlap_frac": "zone_overlap_frac"})
    lots = lots.join(zj)
    for c in ["frontage_min_m", "zn_area", "units_max", "coverage", "exception_no"]:
        lots[c] = nullify(pd.to_numeric(lots[c], errors="coerce"))
    lots["zn_status"] = pd.to_numeric(lots["zn_status"], errors="coerce")
    unzoned = lots["zn_zone"].isna() | (lots["zn_status"] == 5)
    lots.loc[unzoned, ["zn_zone", "gen_zone", "zbl_sectn", "zn_string", "frontage_min_m", "zn_area", "units_max",
                       "coverage", "zn_exception", "exception_no"]] = None
    lots.loc[unzoned, "zn_status"] = 5
    lots["zn_status"] = lots["zn_status"].astype("int64")

    # ---- overlays: height (HT_LABEL, metres) and coverage (PRCNT_CVER, %)
    ht = read_m(RAW / "zoning-height-overlay-4326.gpkg", bbox=bbox)
    hj = largest_overlap(lots, ht, ["HT_LABEL"])
    lots["ht_overlay_m"] = nullify(pd.to_numeric(hj["HT_LABEL"], errors="coerce")).reindex(lots.index)
    cv = read_m(RAW / "zoning-lot-coverage-overlay-4326.gpkg", bbox=bbox)
    cj = largest_overlap(lots, cv, ["PRCNT_CVER"])
    lots["coverage_overlay_pct"] = nullify(pd.to_numeric(cj["PRCNT_CVER"], errors="coerce")).reindex(lots.index)

    # ---- sixplex overlay (lot centroid inside the overlay) and flags
    ov_geom = overlay.geometry.iloc[0]
    cen = lots.geometry.centroid
    lots["sixplex_overlay"] = shapely.contains_xy(ov_geom, cen.x.values, cen.y.values)

    reg = gpd.read_file(f"zip://{RAW / 'heritage-register.zip'}", bbox=bbox, engine="pyogrio").to_crs(CRS_M)
    reg_hits = gpd.sjoin(reg[["geometry"]], lots[["geometry"]], how="inner", predicate="within")
    lots["flag_heritage_register"] = lots.index.isin(reg_hits["index_right"])
    hcd = read_m(f"zip://{RAW / 'heritage-districts.zip'}", bbox=bbox)
    lots["flag_heritage_district"] = intersects_flag(lots, hcd)
    rav = read_m(f"zip://{RAW / 'ravine.zip'}", bbox=bbox)
    lots["flag_ravine"] = intersects_flag(lots, rav)
    trca = ctx.get("trca")
    if trca is not None:
        t = trca.cx[bbox[0]:bbox[2], bbox[1]:bbox[3]].to_crs(CRS_M)
        lots["flag_trca"] = intersects_flag(lots, t)
    else:
        lots["flag_trca"] = False

    # ---- addresses
    addr = gpd.read_file(RAW / "address-points-4326.gpkg", bbox=bbox, engine="pyogrio",
                         columns=["ADDRESS_POINT_ID", "ADDRESS_FULL", "LO_NUM", "LINEAR_NAME_FULL", "WARD", "ADDRESS_CLASS",
                                  "CLASS_FAMILY_DESC", "MAINT_STAGE"])
    addr["geometry"] = shapely.get_geometry(addr.geometry.values, 0)  # MultiPoint -> Point
    addr = addr.to_crs(CRS_M)
    addr["ward_id"] = addr["WARD"].astype("string").str.strip().str.zfill(2)
    addr = addr[addr["ward_id"] == ward_id].copy()
    hit = gpd.sjoin(addr[["geometry"]], lots[["parcelid", "geometry"]], how="left", predicate="within")
    hit = hit[~hit.index.duplicated(keep="first")]
    addr["parcelid"] = hit["parcelid"].reindex(addr.index)
    addr = addr.rename(columns={"ADDRESS_POINT_ID": "address_point_id", "ADDRESS_FULL": "address_full", "LO_NUM": "lo_num",
                                "LINEAR_NAME_FULL": "linear_name_full", "ADDRESS_CLASS": "address_class",
                                "CLASS_FAMILY_DESC": "class_family_desc", "MAINT_STAGE": "maint_stage"})
    addr["address_norm"] = addr["address_full"].fillna("").str.lower().str.replace(r"\s+", " ", regex=True).str.strip()
    counts = addr["parcelid"].value_counts()
    lots["address_count"] = lots["parcelid"].map(counts).fillna(0).astype("int64")
    land = addr[(addr["address_class"] == "L") & (addr["maint_stage"] == "REGULAR")]["parcelid"].value_counts()
    lots["address_count_land"] = lots["parcelid"].map(land).fillna(0).astype("int64")
    addr = addr[["address_point_id", "address_full", "address_norm", "lo_num", "linear_name_full", "ward_id", "parcelid",
                 "address_class", "class_family_desc", "maint_stage", "geometry"]]

    # ---- buildings (3D massing is EPSG:3857 despite its file name)
    b_bbox = tuple(gpd.GeoSeries([area_zone], crs=4326).to_crs(3857).total_bounds)
    b = pyogrio.read_dataframe(f"/vsizip/{RAW / '3DMassingShapefile_2025_WGS84.zip'}", bbox=b_bbox, fid_as_index=True, force_2d=True)
    b = b[b.geometry.notna() & ~b.geometry.is_empty]
    b = b.set_crs(3857, allow_override=True).to_crs(CRS_M)
    b.geometry = shapely.make_valid(b.geometry.values)
    near = b.intersects(w.buffer(NEIGHBOUR_M).union_all())
    b = b[near].copy()
    b["building_id"] = b.index.astype("int64")
    b["footprint_m2"] = b.geometry.area
    bj = largest_overlap(b, all_lots, ["parcelid"])
    b["parcelid"] = bj["parcelid"].reindex(b.index)
    b = b.rename(columns={"AVG_HEIGHT": "avg_height_m", "MAX_HEIGHT": "max_height_m", "HEIGHT_SRC": "height_src"})
    b = b[["building_id", "avg_height_m", "max_height_m", "height_src", "footprint_m2", "parcelid", "geometry"]].reset_index(drop=True)

    lots = lots.drop(columns=["ward_id"]).assign(ward_id=ward_id)
    lot_cols = ["parcelid", "feature_type", "stated_area", "stated_area_m2", "area_m2", "ward_id", "zn_zone", "gen_zone",
                "zbl_sectn", "zn_string", "frontage_min_m", "zn_area", "units_max", "coverage", "zn_exception",
                "exception_no", "zn_status", "zone_overlap_frac", "ht_overlay_m", "coverage_overlay_pct", "sixplex_overlay",
                "flag_heritage_register", "flag_heritage_district", "flag_ravine", "flag_trca", "address_count",
                "address_count_land", "geometry"]
    lots = lots[lot_cols].reset_index(drop=True)
    log(f"ward {ward_id}: {len(lots):,} lots, {len(corridors):,} corridors, {len(addr):,} addresses, {len(b):,} buildings in {time.time() - t0:.0f}s")
    return {"lots": lots, "corridors": corridors.reset_index(drop=True), "addresses": addr.reset_index(drop=True), "buildings": b}


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ward", help="one ward id, e.g. 04")
    ap.add_argument("--all", action="store_true", help="all 25 wards")
    ap.add_argument("--out", default=str(OUT / "suplex.gpkg"))
    args = ap.parse_args()
    if not (args.ward or args.all):
        ap.error("pass --ward 04 or --all")

    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    dest = Path(args.out)

    wards = load_wards()
    overlay, wards = build_overlay(wards)
    ids = list(wards["ward_id"]) if args.all else [args.ward.zfill(2)]
    ctx = {"trca": load_trca()}

    seen_corr: set = set()
    seen_bld: set = set()
    first = {k: True for k in ["lots", "corridors", "addresses", "buildings"]}
    tmp = dest.with_name(dest.stem + ".building.gpkg")
    if tmp.exists():
        tmp.unlink()
    for wid in ids:
        res = build_ward(wid, wards, overlay, ctx)
        res["corridors"] = res["corridors"][~res["corridors"]["parcelid"].isin(seen_corr)]
        seen_corr.update(res["corridors"]["parcelid"])
        res["buildings"] = res["buildings"][~res["buildings"]["building_id"].isin(seen_bld)]
        seen_bld.update(res["buildings"]["building_id"])
        for layer, gdf in res.items():
            if gdf.empty:
                continue
            pyogrio.write_dataframe(gdf, tmp, layer=layer, driver="GPKG", append=not first[layer])
            first[layer] = False
    pyogrio.write_dataframe(wards, tmp, layer="wards", driver="GPKG", append=True)
    pyogrio.write_dataframe(overlay, tmp, layer="sixplex_overlay", driver="GPKG", append=True)
    if dest.exists():
        dest.unlink()
    tmp.rename(dest)

    meta = {"built_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "wards": ids, "seconds": round(time.time() - t0),
            "ward23_overlay_polygon": OVERLAY_FILE.exists()}
    (OUT / "build_info.json").write_text(json.dumps(meta, indent=2))
    log(f"wrote {dest} ({dest.stat().st_size / 1e6:.0f} MB) in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
