"""Integration smoke test: run Andrew's engine on real lots from data/out/suplex.gpkg (Y7).

    PYTHONPATH=engine python pipeline/smoke_engine.py --ward 04 --n 2000 [--gpkg data/out/suplex.gpkg]

Builds a LotInput from each sampled lot (corridors within 5 m, adjacent lots, buildings within 150 m, the primary
address point), calls suplex_engine.check.run_check, and reports class and result counts, errors and timing.
Read-only on the engine; this only shows whether the pipeline's file feeds it. It is not an accuracy test.
"""
from __future__ import annotations

import argparse
import collections
import time
import traceback
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from suplex_engine.check import run_check
from suplex_engine.config import load_config
from suplex_engine.designs import load_designs
from suplex_engine.models import BuildingInput, LotInput, NeighbourLot

ROOT = Path(__file__).resolve().parents[1]


def none(v):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA else v


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ward", default="04")
    ap.add_argument("--n", type=int, default=2000)
    ap.add_argument("--gpkg", default=str(ROOT / "data/out/suplex.gpkg"))
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()

    g = args.gpkg
    lots = gpd.read_file(g, layer="lots", where=f"ward_id = '{args.ward}'", engine="pyogrio")
    wname = gpd.read_file(g, layer="wards", engine="pyogrio").set_index("ward_id").loc[args.ward, "ward_name"]
    minx, miny, maxx, maxy = lots.total_bounds
    pad = 200
    cor = gpd.read_file(g, layer="corridors", bbox=(minx - pad, miny - pad, maxx + pad, maxy + pad), engine="pyogrio")
    bld = gpd.read_file(g, layer="buildings", bbox=(minx - pad, miny - pad, maxx + pad, maxy + pad), engine="pyogrio")
    adr = gpd.read_file(g, layer="addresses", where=f"ward_id = '{args.ward}' AND is_primary = 1", engine="pyogrio")
    adr = adr.drop_duplicates("parcelid").set_index("parcelid")
    cfg, designs = load_config(), load_designs()

    sample = lots.sample(min(args.n, len(lots)), random_state=args.seed)
    lot_tree, cor_tree, bld_tree = lots.sindex, cor.sindex, bld.sindex
    classes, results, errors = collections.Counter(), collections.Counter(), collections.Counter()
    first_err = None
    t0 = time.time()
    for idx, r in sample.iterrows():
        geom = r.geometry
        near_cor = [cor.geometry.iloc[i] for i in cor_tree.query(geom.buffer(5), predicate="intersects")]
        nb = [lots.iloc[i] for i in lot_tree.query(geom.buffer(1), predicate="intersects") if lots.index[i] != idx]
        bl = bld.iloc[bld_tree.query(geom.buffer(150), predicate="intersects")]
        a = adr.loc[r["parcelid"]] if r["parcelid"] in adr.index else None
        lot = LotInput(
            lot_id=str(r["parcelid"]), geometry=geom, ward_id=args.ward, ward_name=wname, feature_type=r["feature_type"],
            area_m2=float(r["area_m2"]), stated_area=none(r["stated_area"]), zn_zone=none(r["zn_zone"]), zn_string=none(r["zn_string"]),
            gen_zone=None if none(r["gen_zone"]) is None else int(r["gen_zone"]), zbl_sectn=none(r["zbl_sectn"]),
            zn_status=int(r["zn_status"]), frontage_min_m=none(r["frontage_min_m"]),
            units_max=None if none(r["units_max"]) is None else int(r["units_max"]), ht_overlay_m=none(r["ht_overlay_m"]),
            coverage_overlay_pct=none(r["coverage_overlay_pct"]), zn_exception=none(r["zn_exception"]),
            exception_no=None if none(r["exception_no"]) is None else int(r["exception_no"]),
            sixplex_overlay=bool(r["sixplex_overlay"]), flag_heritage_register=bool(r["flag_heritage_register"]),
            flag_heritage_district=bool(r["flag_heritage_district"]), flag_ravine=bool(r["flag_ravine"]), flag_trca=bool(r["flag_trca"]),
            address_count=int(r["address_count"]),
            address_id=None if a is None else str(int(a["address_point_id"])), address_full=None if a is None else a["address_full"],
            address_point=None if a is None else a.geometry,
            corridors=near_cor,
            neighbour_lots=[NeighbourLot(lot_id=str(n["parcelid"]), geometry=n.geometry, feature_type=n["feature_type"]) for n in nb],
            buildings=[BuildingInput(building_id=int(b["building_id"]), geometry=b.geometry, avg_height_m=float(b["avg_height_m"]),
                                     footprint_m2=float(b["footprint_m2"]), parcelid=None if none(b["parcelid"]) is None else str(int(b["parcelid"])))
                       for _, b in bl.iterrows()],
        )
        try:
            res = run_check(lot, cfg, designs)
            d = res.to_dict()
            classes[d["lot"]["class"]] += 1
            if d["lot"]["class"] == "checked" or d["lot"]["class"] == "attached":
                results[d["best_result"] if "best_result" in d else "/".join(sorted({x["result"] for x in d["designs"]}))] += 1
        except Exception as e:  # noqa: BLE001
            errors[type(e).__name__ + ": " + str(e)[:80]] += 1
            first_err = first_err or traceback.format_exc()
    dt = time.time() - t0
    print(f"ward {args.ward}: {len(sample):,} lots sampled in {dt:.1f}s ({1000 * dt / len(sample):.0f} ms per lot)")
    print("classes:", dict(classes.most_common()))
    print("results among checked/attached lots (design result sets):", dict(results.most_common(8)))
    print("errors:", dict(errors) or "none")
    if first_err:
        print(first_err)


if __name__ == "__main__":
    main()
