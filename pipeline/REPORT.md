# Pipeline report (Yuvi) — paste into /docs/decisions.md via Simone, tell Andrew

## Findings that change the spec (read these first)

1. **Rule A works, with one classifier fix** (Y1, T6): 446 multiplex permits issued 2023-05-01 to 2024-11-30 vs the City's 452 (-1.3%). Spec 4.3 step 5 also lets a structure type naming 2-6 units make a multiplex; that adds ~830 permits that create 1 unit (a suite in a house) and gives 1,278. The rule used: **units created 2 to 6**. Rule B is not needed. `permit_rule` string: "A: permits creating 2-6 units, non-SFD structure, one row per project (Toronto Multiplex Tracker rule), multiplex kind" (the spec's fixture text says "1-6"; the 1-unit rows are kind `other`).
2. **The Property Boundaries file has no CORRIDOR parcels** (only COMMON 491,687, CONDO 3,769, RESERVE 2,983). The engine's street-edge test (5.2 step 1) needs corridors. The `corridors` layer is therefore **derived**: ward polygon minus every parcel = road allowance, cut into 250 m tiles; `parcelid` is a negative synthetic id. 98.9% of dev-ward lots touch it. Water and rail not held as parcels also show up as "street" along their edges. Andrew: use it as the spec says, and the fallback (edge nearest the address point) when none touches.
3. **Height overlay column is `HT_LABEL`** (float metres), not `HT_HEIGHT` (T4). Coverage overlay is `PRCNT_CVER`. Ward 04 has no coverage overlay polygons; 57% of lots citywide do.
4. **No zone polygon has `ZN_STATUS` 5** in the current GPKG (values 0-3). "Older bylaw" lots are those with no zone polygon covering at least 25% of the lot (4.8% of COMMON lots citywide); they get `zn_zone` null and `zn_status` 5.
5. **The Ward 23 sixplex area is City Ward 23, no hand-drawing needed** (T11). By-law 654-2025 **Diagram 1** (not Diagram 2) is "Scarborough North (23) Ward Area" and its outline matches the City Wards polygon for ward 23 (Diagram 2 is the Toronto and East York Community Council area = the eight wards). So `pipeline/data/sixplex_overlay_ward23.geojson` is that ward polygon, and **ward 23 is `sixplex_overlay: "full"`, not "partial"**; no ward is partial. Map: `pipeline/data/sixplex_overlay_map.png`.
6. **GEO_ID join rate is 98.5%** (T5); with the street-name fallback the geocode rate is 99.3% (7,342 of 7,397 projects). 55 permits have no location and no ward (counted under `unlocated` in `permit_counts.json`, not on the map).
7. **One massing polygon often covers several houses** (row houses, semis): 78% of lots have a building assigned by largest overlap, but ~98% intersect a building footprint. Use intersection, not `parcelid`, for "vacant" and for building-on-lot area; a merged row polygon can exceed the 350 m² `larger_building` footprint threshold without the lot being a larger building. Tune on the test lots.
8. **88% of ward 04 lots (75% of zone polygons) have `zn_exception` = Y**; most zones carry an exception number, so `site_exception` will flag most lots unless the engine ignores exceptions it cannot read.
9. **permit_counts.json** `since_may_2023` and `by_year` count kind `multiplex` only (the "did" number); `by_kind_since_may_2023` and `by_year_by_kind` have every kind. Public `permits.geojson` includes all four kinds (`k`), so the web should filter to `multiplex` for the dots.
10. **Tiger Data (Y2) is not signed up yet**: needs a human with a browser (free service at the Tiger Data site, then `TIGER_DSN` in `.env`). Everything was tested against a local TimescaleDB 2.30.2 in Docker; the compression numbers in `pipeline/tiger/tiger.md` are from that and must be re-measured on the real service.

## Deliverables on this branch and where the data is

- Scripts: `pipeline/download.py`, `permits.py`, `build_lots.py`, `checks.py`, `lots_checks.py`, `overlay_map.py`, `tiger/*`.
- Not in git (shared on the drive): `data/out/suplex.gpkg` (all 25 wards, 507 MB, 193 s build), `permits.parquet`, `permits.geojson` (1.1 MB), `permit_counts.json`, `data_dates.json`, `trend_cache/01..25.json`.
- Re-run order: `python pipeline/download.py --all`, `python pipeline/permits.py`, `python pipeline/build_lots.py --all`, `python pipeline/checks.py --all`, then (with `TIGER_DSN`) `python pipeline/tiger/load.py` and `python pipeline/tiger/cache_trends.py`.

## Checkpoint output (checks.py --all, 2026-10-17)

```
== permits ==
  rows 7,397; with coordinates 7,342; with a ward 7,342
  geocode method: geo_id 7,283, street_match 59, none 55
  [PASS] geocode rate 90% or better: 99.3%
  GEO_ID -> ADDRESS_POINT_ID join rate (T5): 98.5%
  issued 2023-05-01 to 2024-11-30 by kind: {'other': 897, 'secondary_suite': 530, 'laneway_garden': 528, 'multiplex': 446}
  [PASS] multiplex count within 15% of the City's 452: 446 (-1.3%)
  multiplex permits since 2023-05-01 by ward (compare with the Toronto Multiplex Tracker map):
   01:38  02:33  03:104  04:81  05:92  06:63  07:27  08:79  09:177  10:34  11:99  12:71  13:5  14:81  15:26  16:20  17:27  18:83  19:68  20:93  21:46  22:16  23:7  24:28  25:29
   wards with at least one: 25 of 25; no ward: 17
  [PASS] permit_counts.json: ward totals plus unlocated equal the city total: 1427 + 17 = 1444
  [PASS] permits.geojson carries only id, d, w, u, k (no permit numbers or addresses): 7,342 points
== lots (suplex.gpkg) ==
  layers: lots (MultiPolygon), corridors (Polygon), addresses (Point), buildings (MultiPolygon), wards (MultiPolygon), sixplex_overlay (MultiPolygon)
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
  [PASS] lot parcelid unique: 0 duplicates
  slivers under 30 m²: 5,826; lots over 5,000 m²: 11,216

ALL CHECKS PASSED
```

## Y1:  permits fields and rule check

**Rule A works** (after one classifier fix, below). 446 multiplex permits issued 2023-05-01 to 2024-11-30 vs the City's 452 (-1.3%).

Classifier fix: spec 4.3 step 5 says a structure type or use that names 2 to 6 units also makes a multiplex. Taken literally that gives 1,278 (+183%) because ~830 permits create 1 unit in a '2 Unit - Detached' structure (a suite added to a house). Counting only permits that create 2 to 6 units gives 446. Units created decides; named counts are reported but do not make a multiplex.

```
== Y1 permits report ==
active   rows  202,039   issued 1985-12-25 to 2026-10-14   no issue date 14,971
cleared  rows  444,342   issued 1979-11-27 to 2026-10-09   no issue date 35,021
total rows 646,381
rows repeating a (PERMIT_NUM, REVISION_NUM) pair: 5,082

DWELLING_UNITS_CREATED parsed as a number: 243,710 of 243,710 non-null (100.0%); null: 402,671
integer between 1 and 6: 43,139
integer between 1 and 6 and issued since 2022-01-01: 12,786

Rule A funnel:
    646,381  rows loaded
    182,261  issued on or after 2022-01-01
     12,786  units created 1 to 6
      8,301  STRUCTURE_TYPE not SFD* (or suite/laneway work)
      7,397  one row per project
  rows removed by the one-per-project step: 904
rows with units created = 1 whose structure/use names 2 to 6 units (kind other, not multiplex): 2,422

Rule A rows by kind (since 2022):
kind
other              2582
laneway_garden     1693
multiplex          1592
secondary_suite    1530

Issued 2023-05-01 to 2024-11-30 by kind:
kind
other              897
secondary_suite    530
laneway_garden     528
multiplex          446
multiplex in window: 446  vs the City's 452: -1.3%

Distinct STRUCTURE_TYPE (rows with units 1 to 6 issued since 2022-01-01; top 40 of 30):
STRUCTURE_TYPE
SFD - Detached                  3494
2 Unit - Detached               3463
Laneway / Rear Yard Suite       1908
3+ Unit - Detached              1095
SFD - Townhouse                  801
2 Unit - Semi-detached           674
Stacked Townhouses               343
3+ Unit - Semi-detached          290
SFD - Semi-Detached              199
2 Unit - Townhouse               151
Multiple Unit Building           136
Apartment Building                66
Duplex                            36
3+ Unit - Townhouse               34
Triplex                           24
Other                             22
Mixed Use/Res w Non Res           17
Multiple Use/Non Residential      12
Boarding/Lodging House             5
Triplex/Semi-Detached              5
Office                             2
Apartment Hotel                    1
Restaurant 30 Seats or Less        1
Other (New Housing)                1
Industrial                         1
Medical/Dental Office              1
Motel/Hotel                        1
Hospital                           1
Live/Work Unit                     1
Duplex/Semi-Detached               1

Distinct WORK (rows with units 1 to 6 issued since 2022-01-01; top 40 of 21):
WORK
New Building                     5357
Multiple Projects                2148
New Laneway / Rear Yard Suite    1948
Second Suite (New)               1703
Interior Alterations              922
Other(SR)                         188
Addition(s)                       140
New Building - By Renovation      138
New Building - Lead               117
New Building-Certified             56
Finishing Basements                26
Other(BA)                          16
Change of Use                      14
Accessory Building(s)               3
Walk-Out Stair                      2
Garage                              2
New Building Certified - Lead       2
Building Permit Related(PS)         1
Underpinning                        1
Fire Damage                         1
Deck                                1

Distinct PROPOSED_USE (rows with units 1 to 6 issued since 2022-01-01; top 40 of 1816):
PROPOSED_USE
Sfd                              1612
Sfd-Detached                      797
2 Unit Detached                   709
Sfd - Detached                    453
Sfd-Townhouse                     431
2 Unit - Detached                 417
Sfd Detached                      406
2 Unit Dwelling                   387
Stacked Townhouse                 274
Garden Suite                      238
Fourplex                          210
Sfd - Townhouse                   191
Laneway Suite                     149
2 Unit Sfd                        145
New House                         125
Duplex                            106
Single Family                     104
2 Unit-Detached                    99
Triplex                            94
3 Unit Detached                    89
2 Units-Detached                   88
2-Unit Dwelling                    85
Detached Sfd                       84
2 Unit                             81
2 Units Detached                   74
2 Unit Semi                        69
4 Unit Detached                    66
2-Unit Detached                    64
Sfd + Garden Suite                 55
2-Unit                             52
2 Unit - Semi Detached             51
4 Unit Dwelling                    50
2 Unit Semi Detached               50
3 Unit Dwelling                    49
Single Family Dwelling             48
Sfd-Detached/Garden Suite          46
Sfd - Detached + Garden Suite      45
3 Unit - Detached                  43
Sfd-Detached/Laneway Suite         42
2 Units                            39

Distinct STRUCTURE_TYPE among kept rows by kind (top 25):
kind             STRUCTURE_TYPE              
laneway_garden   Laneway / Rear Yard Suite       1630
                 2 Unit - Detached                 38
                 2 Unit - Semi-detached            13
                 3+ Unit - Detached                 4
                 2 Unit - Townhouse                 3
                 SFD - Detached                     2
                 3+ Unit - Semi-detached            2
                 SFD - Townhouse                    1
multiplex        3+ Unit - Detached               844
                 2 Unit - Detached                320
                 3+ Unit - Semi-detached          180
                 Multiple Unit Building            64
                 2 Unit - Semi-detached            45
                 Apartment Building                43
                 3+ Unit - Townhouse               23
                 Triplex                           18
                 Mixed Use/Res w Non Res           12
                 Duplex                            12
                 Other                             11
                 Multiple Use/Non Residential       5
                 Triplex/Semi-Detached              5
                 Boarding/Lodging House             4
                 2 Unit - Townhouse                 3
                 Motel/Hotel                        1
                 Office                             1
                 Apartment Hotel                    1
other            2 Unit - Detached               1670
                 2 Unit - Semi-detached           375
                 3+ Unit - Detached               166
                 2 Unit - Townhouse                90
                 3+ Unit - Semi-detached           84
                 Multiple Unit Building            72
                 Duplex                            23
                 Laneway / Rear Yard Suite         21
                 Apartment Building                18
                 Stacked Townhouses                17
                 Other                             11
                 3+ Unit - Townhouse                9
                 Multiple Use/Non Residential       7
                 Triplex                            6
                 Mixed Use/Res w Non Res            5
                 Office                             1
                 Live/Work Unit                     1
                 Medical/Dental Office              1
                 Industrial                         1
                 Restaurant 30 Seats or Less        1
                 Other (New Housing)                1
                 Hospital                           1
                 Boarding/Lodging House             1
secondary_suite  2 Unit - Detached               1251
                 2 Unit - Semi-detached           205
                 2 Unit - Townhouse                36
                 3+ Unit - Detached                15
                 3+ Unit - Semi-detached           11
                 SFD - Detached                     6
                 Laneway / Rear Yard Suite          4
                 Duplex/Semi-Detached               1
                 Stacked Townhouses                 1
```

## Y3: permits file checks

```
== permits ==
  rows 7,397; with coordinates 7,342; with a ward 7,342
  geocode method: geo_id 7,283, street_match 59, none 55
  [PASS] geocode rate 90% or better: 99.3%
  GEO_ID -> ADDRESS_POINT_ID join rate (T5): 98.5%
  issued 2023-05-01 to 2024-11-30 by kind: {'other': 897, 'secondary_suite': 530, 'laneway_garden': 528, 'multiplex': 446}
  [PASS] multiplex count within 15% of the City's 452: 446 (-1.3%)
  multiplex permits since 2023-05-01 by ward (compare with the Toronto Multiplex Tracker map):
   01:38  02:33  03:104  04:81  05:92  06:63  07:27  08:79  09:177  10:34  11:99  12:71  13:5  14:81  15:26  16:20  17:27  18:83  19:68  20:93  21:46  22:16  23:7  24:28  25:29
   wards with at least one: 25 of 25; no ward: 17
  [PASS] permit_counts.json: ward totals plus unlocated equal the city total: 1427 + 17 = 1444
  [PASS] permits.geojson carries only id, d, w, u, k (no permit numbers or addresses): 7,342 points

ALL CHECKS PASSED
```
