"""The API's in-memory data store (MASTERSPEC 3.3, 4.4): the GeoPackage layers as numpy arrays with
STRtree indexes, the lookups behind /search and /check, and `lot_input`, which builds the engine's
`LotInput` the way `pipeline/smoke_engine.py` does.

Everything is in EPSG:2952 metres; only search results and the lon/lat lookup touch EPSG:4326.
The hot path (/check) indexes arrays by position from STRtree results and never iterates rows.
"""
from __future__ import annotations

import json
import logging
import math
import re
import time
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import Point
from suplex_engine.check import run_check
from suplex_engine.config import EngineConfig, contracts_dir, load_config
from suplex_engine.designs import DesignsFile, load_designs
from suplex_engine.models import BuildingInput, LotInput, NeighbourLot

log = logging.getLogger("uvicorn.error")

REQUIRED_LAYERS = ("lots", "corridors", "addresses", "buildings", "wards")
OPTIONAL_LAYERS = ("trees",)
COUNTED_LAYERS = ("lots", "buildings", "addresses", "corridors", "trees")

# Fetch radii, not decisions (the engine applies its own thresholds from engine_config.json to what it gets):
CORRIDOR_FETCH_M = 5.0     # MASTERSPEC 5.1: corridors within 5 m of the lot feed the street-edge test
NEIGHBOUR_FETCH_M = 1.0    # MASTERSPEC 5.7: parcels within 1 m are the neighbours of the attached-house test

# /search (MASTERSPEC 3.3): minimum 2 characters, at most 8 results.
SEARCH_MIN_CHARS = 2
SEARCH_MAX_RESULTS = 8

EPSG_METRES = "EPSG:2952"
EPSG_WGS84 = "EPSG:4326"

# The lots-layer columns LotInput is built from.
LOT_COLUMNS = (
    "feature_type", "area_m2", "stated_area", "ward_id", "zn_zone", "gen_zone", "zbl_sectn", "zn_string",
    "frontage_min_m", "units_max", "zn_exception", "exception_no", "zn_status", "ht_overlay_m",
    "coverage_overlay_pct", "sixplex_overlay", "flag_heritage_register", "flag_heritage_district", "flag_ravine",
    "flag_trca", "address_count",
)

# data_dates.json is keyed by the City's CKAN package names with full timestamps; the contract (DataDates,
# Appendix A) wants snake_case names and YYYY-MM-DD. Names follow pipeline/download.py and the fixtures.
DATA_DATE_KEYS = {
    "3d-massing": "massing",
    "address-points-municipal-toronto-one-address-repository": "address_points",
    "building-permits-active-permits": "permits_active",
    "building-permits-cleared-permits": "permits_cleared",
    "city-wards": "wards",
    "heritage-conservation-districts": "heritage_districts",
    "heritage-register": "heritage_register",
    "property-boundaries": "property_boundaries",
    "ravine-natural-feature-protection-area": "ravine",
    "street-tree-data": "trees",
    "zoning-by-law": "zoning",
}

_WS = re.compile(r"\s+")
_DATE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
_MULTIPOLYGON = 6          # shapely geometry type id


class StoreError(RuntimeError):
    """The data cannot be loaded (the message names the missing file or layer)."""


# ---------- pure helpers ----------

def normalise_address(q: str) -> str:
    """Lowercase, collapse whitespace, strip: the pipeline's `address_norm` (build_lots.py)."""
    return _WS.sub(" ", q.lower()).strip()


def prefix_range(sorted_norms: np.ndarray, prefix: str) -> tuple[int, int]:
    """[lo, hi) of the entries of a sorted array that start with `prefix`."""
    lo = int(np.searchsorted(sorted_norms, prefix, side="left"))
    hi = int(np.searchsorted(sorted_norms, prefix + "￿", side="left"))
    return lo, hi


def one_per_lot(lot_of: np.ndarray, primary: np.ndarray, limit: int) -> np.ndarray:
    """Indices into candidates given in address order: one per lot (its primary address when that one
    is among the candidates, else its first), still in address order, at most `limit`."""
    if len(lot_of) == 0:
        return np.array([], dtype=np.int64)
    rank = np.arange(len(lot_of))
    order = np.lexsort((rank, ~primary.astype(bool), lot_of))
    lots_sorted = lot_of[order]
    first = np.r_[True, lots_sorted[1:] != lots_sorted[:-1]]
    return np.sort(order[first])[:limit]


def normalise_data_dates(raw: dict[str, Any]) -> dict[str, str]:
    """CKAN package name -> last refreshed timestamp becomes snake_case name -> YYYY-MM-DD.
    Bookkeeping keys (leading underscore) and values without a date are dropped."""
    out: dict[str, str] = {}
    for key, value in raw.items():
        if key.startswith("_") or not isinstance(value, str):
            continue
        m = _DATE.match(value)
        if not m:
            continue
        name = DATA_DATE_KEYS.get(key) or re.sub(r"^[^a-z]+", "", re.sub(r"[^a-z0-9]+", "_", key.lower())).strip("_")
        if name:
            out[name] = m.group(1)
    return out


def none(v: Any) -> Any:
    """NaN and pandas NA -> None (pipeline/smoke_engine.py)."""
    if v is None or v is pd.NA or (isinstance(v, float) and math.isnan(v)):
        return None
    return v


def _opt_str(v: Any) -> str | None:
    v = none(v)
    return None if v is None else str(v)


def _opt_float(v: Any) -> float | None:
    v = none(v)
    return None if v is None else float(v)


def _opt_int(v: Any) -> int | None:
    v = none(v)
    return None if v is None else int(v)


def _id_str(v: Any) -> str | None:
    """An integer id stored as int or float (NaN = none) -> its string, as LotInput wants."""
    v = none(v)
    return None if v is None else str(int(v))


def _unwrap_single_part(geoms: np.ndarray) -> np.ndarray:
    """Single-part MultiPolygons -> Polygon; true multi-part shapes stay (the engine calls them unmeasurable)."""
    single = (shapely.get_type_id(geoms) == _MULTIPOLYGON) & (shapely.get_num_geometries(geoms) == 1)
    if single.any():
        geoms = geoms.copy()
        geoms[single] = shapely.get_geometry(geoms[single], 0)
    return geoms


def _read_json(path: Path) -> Any:
    """The parsed file, or None when it is missing or not valid JSON (the optional files never stop startup)."""
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        log.warning("suplex: %s is not readable JSON (%s); treated as missing", path, e)
        return None


def _permit_lonlat(feature: Any, since: str) -> list[float] | None:
    """[lon, lat] of a multiplex permit point issued on or after `since`; None for anything else, including a
    feature with no date, no point or malformed properties."""
    if not isinstance(feature, dict):
        return None
    props, geom = feature.get("properties"), feature.get("geometry")
    if not isinstance(props, dict) or not isinstance(geom, dict) or geom.get("type") != "Point":
        return None
    d = props.get("d")
    if props.get("k") != "multiplex" or not isinstance(d, str) or d < since:
        return None
    xy = geom.get("coordinates")
    if not isinstance(xy, list) or len(xy) < 2 or not all(isinstance(v, int | float) for v in xy[:2]):
        return None
    return [float(xy[0]), float(xy[1])]


def read_permit_points(path: Path, since: str) -> np.ndarray:
    """Multiplex permits issued on or after `since` from permits.geojson, as EPSG:2952 points."""
    doc = _read_json(path)
    if not isinstance(doc, dict) or not isinstance(doc.get("features"), list):
        log.warning("suplex: %s missing or not a FeatureCollection; /check reports no nearby permits", path)
        return np.array([], dtype=object)
    lonlat = [p for p in (_permit_lonlat(f, since) for f in doc["features"]) if p is not None]
    if not lonlat:
        return np.array([], dtype=object)
    xy = np.asarray(lonlat, dtype=np.float64)
    x, y = Transformer.from_crs(EPSG_WGS84, EPSG_METRES, always_xy=True).transform(xy[:, 0], xy[:, 1])
    return shapely.points(x, y)


# ---------- the store ----------

class Store:
    """Every layer as positional numpy arrays plus STRtrees; built once at startup by `load()`."""

    def __init__(self, *, data_dir: Path, gpkg_path: Path, frames: dict[str, gpd.GeoDataFrame],
                 permit_points: np.ndarray, cfg: EngineConfig, designs: DesignsFile, designs_json: dict[str, Any],
                 data_dates: dict[str, str], ward_summary: dict[str, Any] | None) -> None:
        self.data_dir = data_dir
        self.gpkg_path = gpkg_path
        self.cfg = cfg
        self.designs = designs
        self.designs_json = designs_json
        self.data_dates = data_dates
        self.ward_summary = ward_summary
        self.layer_counts = {name: len(frames[name]) if name in frames else 0 for name in COUNTED_LAYERS}
        self.load_seconds = 0.0

        lots, adr, bld = frames["lots"], frames["addresses"], frames["buildings"]
        wards, cor = frames["wards"], frames["corridors"]
        trees = frames.get("trees")

        # Wards: id -> name, and the polygons for the outside_toronto test.
        self.ward_names: dict[str, str] = {str(w): str(n) for w, n in zip(wards["ward_id"], wards["ward_name"],
                                                                            strict=True)}
        self.ward_geoms = wards.geometry.to_numpy()
        shapely.prepare(self.ward_geoms)

        # Lots: geometry, STRtree, the LotInput columns, parcelid (as str) -> position.
        self.lot_geoms = _unwrap_single_part(lots.geometry.to_numpy())
        self.lot_tree = STRtree(self.lot_geoms)
        lot_pids = lots["parcelid"].to_numpy(dtype=np.int64)
        self.lot_ids = np.array([str(p) for p in lot_pids.tolist()], dtype=object)
        self._lot_pos = {pid: i for i, pid in enumerate(self.lot_ids.tolist())}
        self.lot_cols = {c: lots[c].to_numpy() for c in LOT_COLUMNS}

        # Corridors, buildings, trees, multiplex permits.
        self.cor_geoms = cor.geometry.to_numpy()
        self.cor_tree = STRtree(self.cor_geoms)
        self.bld_geoms = _unwrap_single_part(bld.geometry.to_numpy())
        self.bld_tree = STRtree(self.bld_geoms)
        self.bld_id = bld["building_id"].to_numpy(dtype=np.int64)
        self.bld_height = bld["avg_height_m"].to_numpy(dtype=np.float64)
        self.bld_footprint = bld["footprint_m2"].to_numpy(dtype=np.float64)
        self.bld_parcel = bld["parcelid"].to_numpy(dtype=np.float64)
        self.tree_geoms = trees.geometry.to_numpy() if trees is not None else np.array([], dtype=object)
        self.tree_tree = STRtree(self.tree_geoms)
        self.permit_geoms = permit_points
        self.permit_tree = STRtree(permit_points)

        # Addresses: address_point_id (as str) -> position, address -> lot position.
        self.adr_geoms = adr.geometry.to_numpy()
        adr_ids = adr["address_point_id"].to_numpy(dtype=np.int64).tolist()
        self.adr_ids = np.array([str(a) for a in adr_ids], dtype=object)
        self._adr_pos = {aid: i for i, aid in enumerate(self.adr_ids.tolist())}
        self.adr_full = adr["address_full"].to_numpy()
        self.adr_primary = adr["is_primary"].to_numpy(dtype=bool)
        adr_parcel = adr["parcelid"].to_numpy(dtype=np.float64)
        has_parcel = ~np.isnan(adr_parcel)
        self.adr_lot = np.full(len(adr), -1, dtype=np.int64)
        self.adr_lot[has_parcel] = pd.Index(lot_pids).get_indexer(adr_parcel[has_parcel].astype(np.int64))

        # Lot -> primary address: is_primary first, else the lot's first address in file order.
        self.lot_primary = np.full(len(lots), -1, dtype=np.int64)
        on_lot = np.flatnonzero(self.adr_lot >= 0)
        order = on_lot[np.lexsort((on_lot, ~self.adr_primary[on_lot], self.adr_lot[on_lot]))]
        owners = self.adr_lot[order]
        first = np.r_[True, owners[1:] != owners[:-1]] if len(order) else np.array([], dtype=bool)
        self.lot_primary[owners[first]] = order[first]

        # Address lon/lat for the search results, and the transformer for lon/lat lookups.
        lon, lat = Transformer.from_crs(EPSG_METRES, EPSG_WGS84, always_xy=True).transform(
            shapely.get_x(self.adr_geoms), shapely.get_y(self.adr_geoms))
        self.adr_lon, self.adr_lat = np.round(lon, 6), np.round(lat, 6)
        self._to_2952 = Transformer.from_crs(EPSG_WGS84, EPSG_METRES, always_xy=True)

        # Search index: addresses on a lot in a known ward, sorted by address_norm. The ward is the lot's
        # (what /check reports), the address's own as a fallback.
        lot_ward = self.lot_cols["ward_id"]
        self.adr_ward = np.where(self.adr_lot >= 0, lot_ward[np.maximum(self.adr_lot, 0)], adr["ward_id"].to_numpy())
        norms = adr["address_norm"]
        ok = ((self.adr_lot >= 0) & norms.notna().to_numpy() & (norms.str.len() > 0).to_numpy()
              & pd.Series(self.adr_ward).isin(list(self.ward_names)).to_numpy())
        rows = np.flatnonzero(ok)
        norm_values = norms.to_numpy()[rows].astype(str)
        sort = np.argsort(norm_values, kind="stable")
        self.search_rows = rows[sort]
        self.search_norms = np.array(norm_values[sort].tolist(), dtype=object)

    @property
    def lot_count(self) -> int:
        return self.layer_counts["lots"]

    @property
    def ward_ids(self) -> frozenset[str]:
        return frozenset(self.ward_names)

    # ----- lookups -----

    def address_pos(self, address_id: str) -> int | None:
        return self._adr_pos.get(address_id)

    def lot_pos(self, lot_id: str) -> int | None:
        return self._lot_pos.get(lot_id)

    def lot_of_address(self, address_pos: int) -> int | None:
        pos = int(self.adr_lot[address_pos])
        return pos if pos >= 0 else None

    def primary_address(self, lot_pos: int) -> int | None:
        pos = int(self.lot_primary[lot_pos])
        return pos if pos >= 0 else None

    def to_2952(self, lon: float, lat: float) -> tuple[float, float]:
        x, y = self._to_2952.transform(lon, lat)
        return float(x), float(y)

    def lot_at(self, x: float, y: float) -> int | None:
        """The lot containing the point (the smallest one if parcels overlap); no snapping."""
        hits = self.lot_tree.query(Point(x, y), predicate="within")
        if len(hits) == 0:
            return None
        return int(hits[np.argmin(shapely.area(self.lot_geoms[hits]))])

    def in_toronto(self, x: float, y: float) -> bool:
        return bool(shapely.contains_xy(self.ward_geoms, x, y).any())

    def search(self, q: str, limit: int = SEARCH_MAX_RESULTS) -> list[dict[str, Any]]:
        """Prefix match on address_norm, one result per lot (its primary address preferred), in address order."""
        norm = normalise_address(q)
        if len(norm) < SEARCH_MIN_CHARS:
            return []
        lo, hi = prefix_range(self.search_norms, norm)
        rows = self.search_rows[lo:hi]
        picked = rows[one_per_lot(self.adr_lot[rows], self.adr_primary[rows], min(limit, SEARCH_MAX_RESULTS))]
        out = []
        for r in picked.tolist():
            ward_id = str(self.adr_ward[r])
            out.append({"address_id": str(self.adr_ids[r]), "address_full": str(self.adr_full[r]),
                        "ward_id": ward_id, "ward_name": self.ward_names[ward_id],
                        "lon": float(self.adr_lon[r]), "lat": float(self.adr_lat[r])})
        return out

    # ----- the engine input -----

    def lot_input(self, lot_pos: int, address_pos: int | None = None) -> LotInput:
        """The engine's LotInput for one lot, built as pipeline/smoke_engine.py does, plus trees and the
        multiplex permit points near the centroid. The address point is the requested address when given,
        else the lot's primary address, else none."""
        c = {k: v[lot_pos] for k, v in self.lot_cols.items()}
        geom = self.lot_geoms[lot_pos]
        radius = self.cfg.context_radius_m
        if address_pos is None:
            address_pos = self.primary_address(lot_pos)

        cor = np.sort(self.cor_tree.query(geom, predicate="dwithin", distance=CORRIDOR_FETCH_M))
        nb = np.sort(self.lot_tree.query(geom, predicate="dwithin", distance=NEIGHBOUR_FETCH_M))
        nb = nb[nb != lot_pos]
        bl = np.sort(self.bld_tree.query(geom, predicate="dwithin", distance=radius))
        tr = np.sort(self.tree_tree.query(geom, predicate="dwithin", distance=radius))
        pm = np.sort(self.permit_tree.query(geom.centroid, predicate="dwithin",
                                            distance=self.cfg.nearby_permits_radius_m))
        ward_id = str(c["ward_id"])
        feature_types = self.lot_cols["feature_type"]

        return LotInput(
            lot_id=str(self.lot_ids[lot_pos]), geometry=geom, ward_id=ward_id,
            ward_name=self.ward_names.get(ward_id, ward_id), feature_type=str(c["feature_type"]),
            area_m2=float(c["area_m2"]), stated_area=_opt_str(c["stated_area"]), zn_zone=_opt_str(c["zn_zone"]),
            zn_string=_opt_str(c["zn_string"]), gen_zone=_opt_int(c["gen_zone"]), zbl_sectn=_opt_str(c["zbl_sectn"]),
            zn_status=_opt_int(c["zn_status"]), frontage_min_m=_opt_float(c["frontage_min_m"]),
            units_max=_opt_int(c["units_max"]), ht_overlay_m=_opt_float(c["ht_overlay_m"]),
            coverage_overlay_pct=_opt_float(c["coverage_overlay_pct"]), zn_exception=_opt_str(c["zn_exception"]),
            exception_no=_opt_int(c["exception_no"]), sixplex_overlay=bool(c["sixplex_overlay"]),
            flag_heritage_register=bool(c["flag_heritage_register"]),
            flag_heritage_district=bool(c["flag_heritage_district"]),
            flag_ravine=bool(c["flag_ravine"]), flag_trca=bool(c["flag_trca"]),
            address_count=int(c["address_count"]),
            address_id=None if address_pos is None else str(self.adr_ids[address_pos]),
            address_full=None if address_pos is None else _opt_str(self.adr_full[address_pos]),
            address_point=None if address_pos is None else self.adr_geoms[address_pos],
            corridors=list(self.cor_geoms[cor]),
            neighbour_lots=[NeighbourLot(lot_id=str(self.lot_ids[i]), geometry=self.lot_geoms[i],
                                         feature_type=str(feature_types[i])) for i in nb.tolist()],
            buildings=[BuildingInput(building_id=int(self.bld_id[i]), geometry=self.bld_geoms[i],
                                     avg_height_m=float(self.bld_height[i]), footprint_m2=float(self.bld_footprint[i]),
                                     parcelid=_id_str(self.bld_parcel[i])) for i in bl.tolist()],
            trees=list(self.tree_geoms[tr]),
            permit_points=list(self.permit_geoms[pm]),
        )

    def check(self, lot_pos: int, address_pos: int | None = None) -> dict[str, Any]:
        """The full CheckResponse for one lot. Never calls Tiger Data or Gemini."""
        return run_check(self.lot_input(lot_pos, address_pos), self.cfg, self.designs, self.data_dates).to_dict()


def read_designs_json() -> dict[str, Any]:
    """/contracts/designs.json as served by GET /designs."""
    return json.loads((contracts_dir() / "designs.json").read_text(encoding="utf-8"))


def check_crs(gpkg: Path, frames: dict[str, gpd.GeoDataFrame]) -> None:
    """Every layer must be in EPSG:2952 metres (MASTERSPEC 4.4): the engine's distances and areas assume it."""
    for name, frame in frames.items():
        epsg = frame.crs.to_epsg() if frame.crs is not None else None
        if epsg != 2952:
            raise StoreError(f"{gpkg} layer {name} is in {frame.crs.to_string() if frame.crs else 'no CRS'}, "
                             f"not {EPSG_METRES}")


def load(data_dir: str | Path, gpkg_path: str | Path | None = None,
         bbox: tuple[float, float, float, float] | None = None) -> Store:
    """Read the GeoPackage and the small JSON files in `data_dir` and build every index.

    `gpkg_path` overrides `<data_dir>/suplex.gpkg` (SUPLEX_GPKG). `bbox` (EPSG:2952 minx, miny, maxx, maxy)
    reads only the features of each layer that intersect it, wards excepted; the batch run loads one strip of a
    ward this way. Raises StoreError naming the missing file or layer when the GeoPackage cannot be used; the
    other files are optional."""
    t0 = time.perf_counter()
    data_dir = Path(data_dir)
    gpkg = Path(gpkg_path) if gpkg_path else data_dir / "suplex.gpkg"
    if not gpkg.is_file():
        raise StoreError(f"GeoPackage not found: {gpkg} (set SUPLEX_DATA_DIR to the folder with suplex.gpkg, "
                         "or SUPLEX_GPKG to the file)")
    present = {str(name) for name, _ in pyogrio.list_layers(gpkg)}
    missing = [name for name in REQUIRED_LAYERS if name not in present]
    if missing:
        raise StoreError(f"{gpkg} has no layer {', '.join(missing)}")

    frames = {name: gpd.read_file(gpkg, layer=name, engine="pyogrio", use_arrow=True,
                                  bbox=None if name == "wards" else bbox)
              for name in REQUIRED_LAYERS + OPTIONAL_LAYERS if name in present}
    check_crs(gpkg, frames)
    cfg = load_config()
    raw_dates = _read_json(data_dir / "data_dates.json")
    if not isinstance(raw_dates, dict):
        log.warning("suplex: %s missing or not an object; responses carry no data dates", data_dir / "data_dates.json")
        raw_dates = {}
    ward_summary = _read_json(data_dir / "ward_summary.json")
    if ward_summary is not None and not isinstance((ward_summary or {}).get("wards"), dict):
        log.warning("suplex: %s has no wards object; /ward/{id} answers 503", data_dir / "ward_summary.json")
        ward_summary = None
    store = Store(
        data_dir=data_dir, gpkg_path=gpkg, frames=frames,
        permit_points=read_permit_points(data_dir / "permits.geojson", cfg.permits_since),
        cfg=cfg, designs=load_designs(), designs_json=read_designs_json(),
        data_dates=normalise_data_dates(raw_dates), ward_summary=ward_summary,
    )
    store.load_seconds = time.perf_counter() - t0
    return store
