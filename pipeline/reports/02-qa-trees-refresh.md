# Report 2: QA columns, trees layer, refresh script (Y7, Y8, Y9)

Branch `yuvi`, 2026-10-17. Only `pipeline/` changes. Data is rebuilt (`data/out/suplex.gpkg`, 590 MB, 212 s citywide) but not in git.

## What changed

**New columns on the `lots` layer (additive; nothing renamed or removed)**

| Column | Meaning | Why |
|---|---|---|
| `bldg_count` | buildings with at least 5 m² inside the lot | `parcelid` (largest overlap) leaves 22% of lots with no building because one massing polygon covers a whole row of houses |
| `bldg_area_on_lot_m2` | total building area inside the lot | use for the "vacant" test (spec: no footprint over 20 m² on the lot) and lot coverage |
| `bldg_max_footprint_m2` | footprint of the largest intersecting polygon | the `larger_building` test (> 350 m²) fires on merged row polygons; compare with this and `bldg_area_on_lot_m2` to tell the two apart |
| `bldg_avg_height_m` | area-weighted average height of the buildings on the lot | the `larger_building` height test (> 12 m) |
| `is_sliver` | area under 30 m² or shorter side of its minimum rotated rectangle under 3 m | those lots are `unmeasurable` anyway (frontage under 3 m) |

**New column on the `addresses` layer:** `is_primary` — exactly one address point per lot (land class first, regular stage first, lowest street number). Autocomplete (T7) can filter `is_primary` so each lot appears once. Addresses with no lot are never primary.

**New layer `trees` (Y8, optional):** 688,335 street tree points (EPSG:2952, `tree_id` = feature id). Decoration only: positions are geocoded to parcel addresses. Download with `python pipeline/download.py --only trees`.

**`pipeline/refresh.py` (Y9):** one command for the Hour-24 refresh: download, permits, lots build, optional Tiger reload (`--tiger`), checks saved to `data/out/checks_<time>.txt`.

## What this means for Andrew

- Use `bldg_count > 0` (or `bldg_area_on_lot_m2 > 20`) instead of joining buildings by `parcelid` for `vacant`. 95.2% of lots have a building by intersection; 78.0% by `parcelid`.
- Tune `larger_building` on `bldg_max_footprint_m2` and `bldg_area_on_lot_m2` together. 85,147 lots share a building polygon with another lot.
- The spec's `lots` schema (section 4.4) is unchanged; these columns only add.

## QA findings (Y7)

| Item | Result |
|---|---|
| Duplicate address points on one lot | 15,515 lots have 2+ address points; `is_primary` resolves it |
| Sliver parcels | 7,335 lots (1.5%) flagged `is_sliver` |
| Lots straddling wards | 132 lots (0.03%) have a centroid outside their assigned ward; assignment is deterministic (largest overlap) so none are in two wards |
| Buildings split across lots | the other way round: one polygon spans many lots (above) |
| Median `area_m2` / `STATEDAREA` | 1.0000 over 493,822 lots (passes 0.97 to 1.03) |

Still open: Andrew's hand-checked test lots (A8). I haven't run them against the citywide file because I don't have them. Send them, or run `python pipeline/checks.py --all` and your own test lots against `data/out/suplex.gpkg`.

## Check output (`python pipeline/checks.py --all`)

```
== lots (suplex.gpkg) ==
  layers: lots (MultiPolygon), corridors (Polygon), addresses (Point), buildings (MultiPolygon), trees (Point), wards (MultiPolygon), sixplex_overlay (MultiPolygon)
  [PASS] layer lots present
  [PASS] layer corridors present
  [PASS] layer addresses present
  [PASS] layer buildings present
  [PASS] layer wards present
  [PASS] layer sixplex_overlay present
  [PASS] lots are in EPSG:2952: 2952
  [PASS] 25 wards present in lots: 25
  lots by feature_type: COMMON 491,687, CONDO 3,769
  [PASS] 95% or more of COMMON lots have a zone or zn_status 5: 100.0%
  COMMON lots with a zone 95.2%; zn_status 5 (no zone / older bylaw) 4.8%
  zones: RD 233,604, R 103,487, RM 54,248, RS 29,529, CR 18,583, RT 14,739, E 4,581, ON 2,577, RA 2,300, OR 1,507
  with height overlay 89.8%; coverage overlay 57.0%; sixplex_overlay 35.6%
  flags: heritage_register 11,435 (2.3%), heritage_district 11,598 (2.3%), ravine 32,759 (6.6%), trca 35,805 (7.2%)
  zone exceptions (zn_exception = Y): 359,326
  [PASS] median area_m2 / STATEDAREA between 0.97 and 1.03: 1.0000 over 493,822 lots
  [PASS] 95% or more of lots touch street space (the derived corridors layer): 98.0% of 495,456; 19,243 street tiles
  [PASS] address join (addresses with a lot) 95% or more: 99.9% of 525,372
  address classes: L 478,853, S 33,753, SE 12,033, LE 733
  land+regular addresses with a lot: 99.9%
  lots with at least one address: 96.1%; address_count >= 4: 3,370
  [PASS] buildings are in EPSG:2952: 2952
  [PASS] avg_height_m populated on 99%+ of buildings: 100.0%
  buildings 428,184; with a parcel 100.0%; median footprint 148 m²; median height 5.5 m
  lots with a building footprint over 20 m² assigned to them: 78.0% (the rest are 'vacant' or share a footprint)
  [PASS] exactly one primary address per lot (autocomplete shows each lot once): 475,980 primary of 525,372 addresses; lots with 2+ address points 15,515
  [PASS] bldg_* columns present on lots
  lots with a building by intersection (bldg_count > 0): 95.2% (by largest-overlap parcelid only: 78.0%: row-house massing polygons span several lots)
  no building at all (vacant): 23,964
  is_sliver (area under 30 m² or shorter side under 3 m): 7,335 (1.5%)
  lots whose centroid lies outside their assigned ward (straddlers): 132 (0.0%)
  trees layer: 688,335 points
  [PASS] lot parcelid unique: 0 duplicates
  slivers under 30 m²: 5,826; lots over 5,000 m²: 11,216

ALL CHECKS PASSED
```

## Not done

- Tiger Data on the real service (needs your sign-up and `TIGER_DSN`); the Hour-14 go/no-go is still open.
- Y9's Devpost Tiger section and the 30-second walkthrough (needs the real service for honest numbers).
- Comparison of ward permit counts with the Toronto Multiplex Tracker map (offline).
