"""Checks on data/out/suplex.gpkg (spec 4.7), called from checks.py."""
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pyogrio

OUT = Path(__file__).resolve().parents[1] / "data" / "out"
GPKG = OUT / "suplex.gpkg"


def pct(n: float, d: float) -> str:
    return f"{n / d:.1%}" if d else "n/a"


def run(ward: str | None, failures: list[str], check) -> None:
    print(f"== lots ({GPKG.name}) ==")
    if not GPKG.exists():
        check(False, "suplex.gpkg exists", "run pipeline/build_lots.py first")
        return
    layers = {n: g for n, g in pyogrio.list_layers(GPKG)}
    print("  layers: " + ", ".join(f"{n} ({g})" for n, g in layers.items()))
    for need in ["lots", "corridors", "addresses", "buildings", "wards", "sixplex_overlay"]:
        check(need in layers, f"layer {need} present")

    lots = gpd.read_file(GPKG, layer="lots", engine="pyogrio")
    check(lots.crs.to_epsg() == 2952, "lots are in EPSG:2952", str(lots.crs.to_epsg()))
    if ward:
        wards_present = sorted(lots["ward_id"].unique())
        check(wards_present == [ward.zfill(2)], f"only ward {ward} in lots", str(wards_present))
    else:
        check(len(lots["ward_id"].unique()) == 25, "25 wards present in lots", str(len(lots["ward_id"].unique())))
    n = len(lots)
    print("  lots by feature_type: " + ", ".join(f"{k} {v:,}" for k, v in lots["feature_type"].value_counts().items()))
    common = lots[lots["feature_type"] == "COMMON"]
    zoned = common["zn_zone"].notna()
    st5 = common["zn_status"] == 5
    check((zoned | st5).mean() >= 0.95, "95% or more of COMMON lots have a zone or zn_status 5", pct((zoned | st5).sum(), len(common)))
    print(f"  COMMON lots with a zone {pct(zoned.sum(), len(common))}; zn_status 5 (no zone / older bylaw) {pct(st5.sum(), len(common))}")
    print("  zones: " + ", ".join(f"{k} {v:,}" for k, v in lots["zn_zone"].value_counts().head(10).items()))
    print(f"  with height overlay {pct(lots['ht_overlay_m'].notna().sum(), n)}; coverage overlay {pct(lots['coverage_overlay_pct'].notna().sum(), n)}; "
          f"sixplex_overlay {pct(lots['sixplex_overlay'].sum(), n)}")
    print("  flags: " + ", ".join(f"{c.replace('flag_', '')} {int(lots[c].sum()):,} ({pct(lots[c].sum(), n)})"
                                   for c in ["flag_heritage_register", "flag_heritage_district", "flag_ravine", "flag_trca"]))
    print(f"  zone exceptions (zn_exception = Y): {int((lots['zn_exception'] == 'Y').sum()):,}")

    ratio = (lots["area_m2"] / lots["stated_area_m2"]).dropna()
    med = ratio.median()
    check(0.97 <= med <= 1.03, "median area_m2 / STATEDAREA between 0.97 and 1.03", f"{med:.4f} over {len(ratio):,} lots")

    cor = gpd.read_file(GPKG, layer="corridors", engine="pyogrio")
    pairs = gpd.sjoin(lots[["parcelid", "geometry"]], cor.assign(geometry=cor.buffer(0.5))[["geometry"]], predicate="intersects")
    touch = pairs["parcelid"].nunique() / n
    check(touch >= 0.95, "95% or more of lots touch street space (the derived corridors layer)", f"{touch:.1%} of {n:,}; {len(cor):,} street tiles")

    addr = gpd.read_file(GPKG, layer="addresses", engine="pyogrio", ignore_geometry=True)
    join = addr["parcelid"].notna().mean()
    check(join >= 0.95, "address join (addresses with a lot) 95% or more", f"{join:.1%} of {len(addr):,}")
    print(f"  address classes: " + ", ".join(f"{k} {v:,}" for k, v in addr["address_class"].value_counts().items()))
    land = addr[(addr["address_class"] == "L") & (addr["maint_stage"] == "REGULAR")]
    print(f"  land+regular addresses with a lot: {pct(land['parcelid'].notna().sum(), len(land))}")
    print(f"  lots with at least one address: {pct((lots['address_count'] > 0).sum(), n)}; address_count >= 4: {int((lots['address_count'] >= 4).sum()):,}")

    b = gpd.read_file(GPKG, layer="buildings", engine="pyogrio")
    check(b.crs.to_epsg() == 2952, "buildings are in EPSG:2952", str(b.crs.to_epsg()))
    check(b["avg_height_m"].notna().mean() >= 0.99, "avg_height_m populated on 99%+ of buildings", pct(b["avg_height_m"].notna().sum(), len(b)))
    print(f"  buildings {len(b):,}; with a parcel {pct(b['parcelid'].notna().sum(), len(b))}; "
          f"median footprint {b['footprint_m2'].median():.0f} m²; median height {b['avg_height_m'].median():.1f} m")
    # building join rate on lots: share of lots with a building over 20 m²
    with_b = lots["parcelid"].isin(b.loc[b["footprint_m2"] > 20, "parcelid"])
    print(f"  lots with a building footprint over 20 m² assigned to them: {pct(with_b.sum(), n)} (the rest are 'vacant' or share a footprint)")
    dup = lots["parcelid"].duplicated().sum()
    check(dup == 0, "lot parcelid unique", f"{dup} duplicates")
    sliver = (lots["area_m2"] < 30).sum()
    print(f"  slivers under 30 m²: {sliver:,}; lots over 5,000 m²: {int((lots['area_m2'] > 5000).sum()):,}")
