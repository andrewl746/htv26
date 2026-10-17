"""Render pipeline/data/sixplex_overlay_map.png: the sixplex overlay over the 25 ward outlines (Y6 screenshot)."""
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
w = gpd.read_file(ROOT / "data/raw/city-wards-data-4326.gpkg").to_crs(2952)
w["id"] = w["AREA_SHORT_CODE"].astype(str).str.zfill(2)
ov = gpd.read_file(ROOT / "pipeline/data/sixplex_overlay_ward23.geojson").to_crs(2952)
full = w[w["id"].isin(["04", "09", "10", "11", "12", "13", "14", "19"])]
fig, ax = plt.subplots(figsize=(10, 7))
w.plot(ax=ax, facecolor="#f3f3f3", edgecolor="#888", linewidth=0.6)
full.plot(ax=ax, facecolor="#9ecae1", edgecolor="#08519c", linewidth=1.0)
ov.plot(ax=ax, facecolor="#9ecae1", edgecolor="#08519c", linewidth=1.4)
for _, r in w.iterrows():
    c = r.geometry.representative_point()
    ax.text(c.x, c.y, r["id"], ha="center", va="center", fontsize=8)
ax.set_title("Sixplex overlay (By-law 654-2025): wards 04, 09-14, 19 and 23 (blue)")
ax.set_axis_off()
fig.savefig(ROOT / "pipeline/data/sixplex_overlay_map.png", dpi=110, bbox_inches="tight")
