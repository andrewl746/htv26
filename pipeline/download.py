"""Download the City of Toronto open data files into data/raw/ (spec section 4.1 and Appendix G).

    python pipeline/download.py --permits     # the two building permit CSVs (task Y1)
    python pipeline/download.py --all         # everything build_lots.py needs

Idempotent (a finished file is skipped) and resumable (a partial .part file continues with a Range
request). Writes data/out/data_dates.json with each dataset's last_refreshed from package_show.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "out"

# name -> (dataset package slug/id, resource path under BASE, local relative path)
FILES = {
    "permits_active": ("building-permits-active-permits",
                       "/dataset/108c2bd1-6945-46f6-af92-02f5658ee7f7/resource/dfce3b7b-4f17-4a9d-9155-5e390a5ffa97/download/building-permits-active-permits.csv",
                       "permits/building-permits-active-permits.csv"),
    "permits_cleared": ("building-permits-cleared-permits",
                        "/dataset/9e42a85b-180f-4dc5-b0d7-d46661a6c0ec/resource/b41c3e9e-4d2d-4b09-a789-9569d8da407c/download/cleared-building-permits-since-2017.csv",
                        "permits/cleared-building-permits-since-2017.csv"),
    "address_points": ("address-points-municipal-toronto-one-address-repository",
                       "/dataset/abedd8bc-e3dd-4d45-8e69-79165a76e4fa/resource/f9557b4f-724f-47ff-9326-c9d55050f648/download/address-points-4326.gpkg",
                       "address-points-4326.gpkg"),
    "property_boundaries": ("property-boundaries",
                            "/dataset/1acaa8b0-f235-4df6-8305-02025ccdeb07/resource/7e9fff54-71c8-4958-b74a-2419f727c8a7/download/property-boundaries-4326.gpkg",
                            "property-boundaries-4326.gpkg"),
    "zoning_area": ("zoning-by-law",
                    "/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/f9b16f51-e957-4a2a-88e6-4b9679668e11/download/zoning-area-4326.gpkg",
                    "zoning-area-4326.gpkg"),
    "zoning_height": ("zoning-by-law",
                      "/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/11587cb9-87be-43df-be16-c14136a4c845/download/zoning-height-overlay-4326.gpkg",
                      "zoning-height-overlay-4326.gpkg"),
    "zoning_coverage": ("zoning-by-law",
                        "/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/bdd702b6-c004-4853-9b1d-a3cd8aa32930/download/zoning-lot-coverage-overlay-4326.gpkg",
                        "zoning-lot-coverage-overlay-4326.gpkg"),
    "zoning_readme": ("zoning-by-law",
                      "/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/aa11a6f1-17fd-49b7-bbe4-f381bbc36f94/download/zoning_readme.txt",
                      "zoning_readme.txt"),
    "massing": ("3d-massing",
                "/dataset/387b2e3b-2a76-4199-8b3b-0b7d22e2ec10/resource/667237d6-4d3c-4cf3-8cb7-e91c48d59375/download/3dmassingshapefile_2025_wgs84.zip",
                "3DMassingShapefile_2025_WGS84.zip"),
    "wards": ("city-wards",
              "/dataset/5e7a8234-f805-43ac-820f-03d7c360b588/resource/6f638349-66c8-4830-a82a-f403d7a5219e/download/city-wards-data-4326.gpkg",
              "city-wards-data-4326.gpkg"),
}

# Resolved through package_show at run time (Appendix G): slug -> local name.
RESOLVED = {
    "heritage_register": ("heritage-register", "heritage-register.zip"),
    "heritage_districts": ("heritage-conservation-districts", "heritage-districts.zip"),
    "ravine": ("ravine-natural-feature-protection-area", "ravine.zip"),
    "trees": ("street-tree-data", "street-trees-4326.gpkg"),
}

PERMITS = ["permits_active", "permits_cleared"]
CORE = PERMITS + ["address_points", "property_boundaries", "zoning_area", "zoning_height",
                  "zoning_coverage", "zoning_readme", "massing", "wards"]

session = requests.Session()
session.headers["User-Agent"] = "suplex-pipeline/0.1 (Hack the Valley 11)"


def package_show(slug: str) -> dict:
    r = session.get(f"{BASE}/api/3/action/package_show", params={"id": slug}, timeout=60)
    r.raise_for_status()
    return r.json()["result"]


def fetch(url: str, dest: Path) -> None:
    """Download url to dest, resuming a .part file and skipping a file that is already complete."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    if dest.exists():
        head = session.head(url, allow_redirects=True, timeout=60)
        size = int(head.headers.get("content-length", -1))
        if size in (-1, dest.stat().st_size):
            print(f"  have {dest.relative_to(ROOT)} ({dest.stat().st_size:,} bytes)")
            return
        dest.unlink()
    have = part.stat().st_size if part.exists() else 0
    headers = {"Range": f"bytes={have}-"} if have else {}
    with session.get(url, headers=headers, stream=True, timeout=60) as r:
        if r.status_code == 416:  # the .part is already the whole file
            part.rename(dest)
            return
        r.raise_for_status()
        if have and r.status_code != 206:
            have = 0  # server ignored Range; start over
        total = have + int(r.headers.get("content-length", 0))
        done = have
        with open(part, "ab" if have else "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
                done += len(chunk)
                if sys.stdout.isatty():
                    print(f"\r  {dest.name}: {done / 1e6:7.1f} / {total / 1e6:.1f} MB", end="", flush=True)
    part.rename(dest)
    print(f"\r  got  {dest.relative_to(ROOT)} ({dest.stat().st_size:,} bytes)" + " " * 20)


def resolve_resource(slug: str) -> str:
    """URL of the newest usable resource in a dataset (for files not listed in Appendix G):
    a 4326 GPKG when there is one, otherwise the newest shapefile zip."""
    resources = package_show(slug)["resources"]

    def newest(items: list[dict]) -> str:
        items.sort(key=lambda x: x.get("last_modified") or x.get("created") or "", reverse=True)
        return items[0]["url"]

    gpkg = [x for x in resources if str(x.get("format", "")).upper() == "GPKG"]
    gpkg4326 = [x for x in gpkg if "4326" in x.get("name", "")] or gpkg
    if gpkg4326:
        return newest(gpkg4326)
    shp = [x for x in resources if str(x.get("format", "")).upper() == "SHP"]
    if shp:
        return newest(shp)
    raise SystemExit(f"no GPKG or SHP resource in {slug}")


TRCA_URL = "https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer/0/query"


def fetch_trca(dest: Path) -> None:
    """TRCA Regulated Area (ArcGIS FeatureServer layer 0, 6,307 polygons) as one GeoJSON, paged 1,000 at a time."""
    if dest.exists():
        print(f"  have {dest.relative_to(ROOT)} ({dest.stat().st_size:,} bytes)")
        return
    feats, offset = [], 0
    while True:
        r = session.get(TRCA_URL, params={"where": "1=1", "outFields": "OBJECTID", "outSR": 4326, "f": "geojson",
                                          "resultOffset": offset, "resultRecordCount": 1000,
                                          "orderByFields": "OBJECTID"}, timeout=180)
        r.raise_for_status()
        batch = r.json().get("features", [])
        feats += batch
        print(f"  trca: {len(feats):,} features")
        if len(batch) < 1000:
            break
        offset += 1000
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    print(f"  got  {dest.relative_to(ROOT)} ({dest.stat().st_size:,} bytes)")


def write_dates(slugs: set[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "data_dates.json"
    dates = json.loads(path.read_text()) if path.exists() else {}
    for slug in sorted(slugs):
        try:
            pkg = package_show(slug)
            dates[slug] = pkg.get("last_refreshed") or pkg.get("metadata_modified")
        except Exception as e:  # a missing date must not stop the build
            print(f"  warning: package_show({slug}) failed: {e}", file=sys.stderr)
    dates["_fetched_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    path.write_text(json.dumps(dates, indent=2, sort_keys=True))
    print(f"  wrote {path.relative_to(ROOT)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--permits", action="store_true", help="only the two permit CSVs")
    ap.add_argument("--all", action="store_true", help="every dataset build_lots.py needs")
    ap.add_argument("--ward", help="accepted for symmetry with the other scripts; downloads are citywide")
    ap.add_argument("--with-trees", action="store_true", help="also the optional street trees layer")
    ap.add_argument("--only", nargs="+", choices=sorted(FILES) + sorted(RESOLVED) + ["trca"], help="specific files")
    args = ap.parse_args()
    if not (args.permits or args.all or args.only):
        ap.error("pass --permits, --all or --only")

    names = list(args.only or [])
    if args.permits:
        names += PERMITS
    if args.all:
        names += CORE + ["heritage_register", "heritage_districts", "ravine", "trca"]
        if args.with_trees:
            names.append("trees")
    names = list(dict.fromkeys(names))

    slugs = set()
    for n in names:
        if n == "trca":
            print(n)
            fetch_trca(RAW / "trca-regulated-area.geojson")
            continue
        if n in FILES:
            slug, path, rel = FILES[n]
            print(n)
            fetch(BASE + path, RAW / rel)
        else:
            slug, rel = RESOLVED[n]
            print(n)
            fetch(resolve_resource(slug), RAW / rel)
        slugs.add(slug)
    write_dates(slugs)


if __name__ == "__main__":
    main()
