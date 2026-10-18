# 08. Multiplexes near you, Phase 1: the data

Script: `pipeline/multiplexes.py`. Output: `data/out/multiplexes.geojson` (not committed) and a small committed copy,
`pipeline/snapshots/multiplexes.geojson` (363 KB), so the demo needs no network.

```
python pipeline/download.py --permits && python pipeline/permits.py      # as before
python pipeline/multiplexes.py --snapshot                                # new
python pipeline/multiplexes.py --summary                                 # stats of the existing file
```

## Source decision

The file is built from our own Rule A permits (`permits.parquet`), not from the Toronto Multiplex Tracker's GeoJSON
(https://malcolmkennedy.com/to-multiplex-map/data/permits.geojson, found from open.toronto.ca/?p=4591).
Both start from the same City active and cleared permit datasets. The Tracker also drops rows by an LLM label and an address
match, and states no licence. In the City's 452 window (2023-05-01 to 2024-11-30) the Tracker has 232 permits and Ward 04 has 21;
ours has 438 and 42 (Ward 04 matches the City exactly). We keep our rule so the ward map, the AI numbers and this layer agree.

## What the file holds

Per permit: `id`, `street` ("Dundas St W", no number), `ward`, `units` (gross), `structure` (detached, semi, townhouse, other),
`work` (new_build or conversion), `status` (active or cleared), `issued`. Top level: fetch dates, rule, stats, caveats.
No permit numbers, house numbers or postal codes (checked by a separate reviewer: zero hits).

| | Count |
|---|---|
| Multiplex permits (2 to 6 units, since 2022-01-01) | 1,592 |
| Dropped: cancelled or refused | 17 |
| Left out: could not be geocoded | 22 |
| **Written** | **1,553** (4,619 gross units) |
| Active / cleared | 1,035 / 518 |
| New build / conversion | 725 / 828 |

## Judgement calls

- `cleared` = the permit came from the cleared file (City closed it). `active` includes work already under inspection.
- `work`: only "New Building" and "New Building - By Renovation" count as `new_build`. "Multiple Projects" is `conversion`
  (the reviewer read 15 of them: none was a rebuild).
- "Revocation Pending" permits stay in (not revoked yet).
- 147 permits share a coordinate with another (several permits on one lot): the UI must cluster or offset, and a point is not a building.

## Review

A separate agent re-derived the counts from the parquet (match, per ward and by status), sampled 30 rows against their source,
and searched the whole file for numbers. It found the work-type mislabels and `Mcroberts` casing; both are fixed here.
Coordinates stay at 5 decimals, the same as the existing `permits.geojson`.

## Ward polygons

`python pipeline/multiplexes.py` also writes `data/out/multiplex_wards.geojson` (copy in `pipeline/snapshots/` with `--snapshot`)
for the web choropleth. Source: `data/raw/city-wards-data-4326.gpkg` (`AREA_SHORT_CODE` = ward number, `AREA_NAME` = ward name).
25 Polygon features in EPSG:4326, properties exactly `ward` ("01".."25") and `name`; no counts (the web counts from the filtered permits).
Shapely `simplify(0.0004, preserve_topology=True)` (about 40 m), coordinates rounded to 5 decimals. Size 29 KB (target 400 KB).

- All 25 wards present once; ward 04 is Parkdale-High Park (25-ward model).
- Every geometry is valid after simplifying and rounding.
- All 1,553 multiplex points fall inside the polygon of their own `ward`: 0 mismatches, none on a boundary.

## Not done yet

Phases 2 and 3 (map layer, popups, filters, ward counts, lots like yours, AI context) wait for the Phase 1 check.
Joining permits to lots works through `address_point_id` -> `parcelid` (98.6% match, all of Ward 04) but needs `suplex.gpkg`.
