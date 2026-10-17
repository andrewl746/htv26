"""Build a LotInput for one real Ward 04 parcel from data/out/suplex.gpkg (test utility for test_lots.py).

The engine itself never imports geopandas. Mirrors pipeline/smoke_engine.py and api/store.py: corridors within
5 m, COMMON/CONDO neighbours within 1 m, buildings within the context radius, the primary address point. Skips
cleanly when the data is absent or a parcel is no longer in the file.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import pytest

from suplex_engine.config import load_config
from suplex_engine.models import BuildingInput, LotInput, NeighbourLot

REPO = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("SUPLEX_DATA_DIR", REPO / "data" / "out"))
GPKG = Path(os.environ["SUPLEX_GPKG"]) if os.environ.get("SUPLEX_GPKG") else DATA_DIR / "suplex.gpkg"

CORRIDOR_FETCH_M = 5.0      # MASTERSPEC 5.1: corridor polygons within 5 m
NEIGHBOUR_FETCH_M = 1.0     # MASTERSPEC 5.7: lots sharing a side lot line


def _none(v):
    import numpy as np
    import pandas as pd
    return None if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA else v


@lru_cache(maxsize=1)
def layers():
    if not GPKG.exists():
        pytest.skip(f"real-lot tests need {GPKG} (GitHub release data-2026-10-17)")
    import geopandas as gpd
    import shapely

    def read(layer, **kw):
        g = gpd.read_file(GPKG, layer=layer, engine="pyogrio", use_arrow=True, **kw)
        single = shapely.get_num_geometries(g.geometry.values) == 1
        multi = g.geometry.geom_type == "MultiPolygon"
        fix = single & multi
        if fix.any():
            g.loc[fix, "geometry"] = shapely.get_geometry(g.geometry.values[fix.to_numpy()], 0)
        return g

    lots = read("lots", where="ward_id = '04'")
    lots["parcelid"] = lots["parcelid"].astype(int)
    lots = lots.set_index("parcelid", drop=False)
    wards = gpd.read_file(GPKG, layer="wards", engine="pyogrio").set_index("ward_id")
    minx, miny, maxx, maxy = lots.total_bounds
    bbox = (minx - 200, miny - 200, maxx + 200, maxy + 200)
    cor = read("corridors", bbox=bbox)
    bld = read("buildings", bbox=bbox)
    adr = gpd.read_file(GPKG, layer="addresses", engine="pyogrio", where="ward_id = '04' AND is_primary = 1")
    adr = adr.drop_duplicates("parcelid").set_index("parcelid")
    return dict(lots=lots, wards=wards, cor=cor, bld=bld, adr=adr)


def lot_input(parcelid: int) -> LotInput:
    L = layers()
    lots, cor, bld, adr = L["lots"], L["cor"], L["bld"], L["adr"]
    cfg = load_config()
    if parcelid not in lots.index:
        pytest.skip(f"parcel {parcelid} is not in {GPKG} (rebuilt data release?)")
    r = lots.loc[parcelid]
    geom = r.geometry
    near_cor = [cor.geometry.iloc[i] for i in cor.sindex.query(geom.buffer(CORRIDOR_FETCH_M), predicate="intersects")]
    nb_pos = lots.sindex.query(geom.buffer(NEIGHBOUR_FETCH_M), predicate="intersects")
    nb = [lots.iloc[i] for i in nb_pos if int(lots.iloc[i]["parcelid"]) != parcelid]
    bl = bld.iloc[bld.sindex.query(geom.buffer(cfg.context_radius_m), predicate="intersects")]
    a = adr.loc[parcelid] if parcelid in adr.index else None
    return LotInput(
        lot_id=str(parcelid), geometry=geom, ward_id="04", ward_name=L["wards"].loc["04", "ward_name"],
        feature_type=r["feature_type"], area_m2=float(r["area_m2"]), stated_area=_none(r["stated_area"]),
        zn_zone=_none(r["zn_zone"]), zn_string=_none(r["zn_string"]),
        gen_zone=None if _none(r["gen_zone"]) is None else int(r["gen_zone"]), zbl_sectn=_none(r["zbl_sectn"]),
        zn_status=int(r["zn_status"]), frontage_min_m=_none(r["frontage_min_m"]),
        units_max=None if _none(r["units_max"]) is None else int(r["units_max"]), ht_overlay_m=_none(r["ht_overlay_m"]),
        coverage_overlay_pct=_none(r["coverage_overlay_pct"]), zn_exception=_none(r["zn_exception"]),
        exception_no=None if _none(r["exception_no"]) is None else int(r["exception_no"]),
        sixplex_overlay=bool(r["sixplex_overlay"]), flag_heritage_register=bool(r["flag_heritage_register"]),
        flag_heritage_district=bool(r["flag_heritage_district"]), flag_ravine=bool(r["flag_ravine"]),
        flag_trca=bool(r["flag_trca"]), address_count=int(r["address_count"]),
        address_id=None if a is None else str(int(a["address_point_id"])),
        address_full=None if a is None else a["address_full"], address_point=None if a is None else a.geometry,
        corridors=near_cor,
        neighbour_lots=[NeighbourLot(lot_id=str(int(n["parcelid"])), geometry=n.geometry, feature_type=n["feature_type"]) for n in nb],
        buildings=[BuildingInput(building_id=int(b.building_id), geometry=b.geometry, avg_height_m=float(b.avg_height_m),
                                 footprint_m2=float(b.footprint_m2)) for b in bl.itertuples()],
    )
