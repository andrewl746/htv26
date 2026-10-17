# Hand-checked test lots (A8)

Real Ward 04 parcels that pin the engine down (MASTERSPEC 5.9). The tests live in `engine/tests/test_lots.py`
and run whenever `data/out/suplex.gpkg` (GitHub release `data-2026-10-17`) is present; without it they skip.
`pytest engine` must stay green before every merge to `main`.

How each lot was checked, without the engine: the parcel's minimum rotated rectangle (width and depth of a
regular lot), its area against the City's stated area, cross-sections at the 6.0 m setback line and across the
17 m building band computed from the corridor-facing edge, the 3D Massing footprints clipped to the parcel and
to its neighbours, and an ASCII plot of the parcel fabric, footprints, street space and address point. The
scripts are throwaway; the numbers below are what they gave. Width and depth must agree within 0.3 m (5.9).

## The lots

| Parcel | Address | Zone | What it exercises | Hand width x depth (m) | Expected |
|---|---|---|---|---|---|
| 5431267 | 326 Quebec Ave | R | clear fit on a wide, deep detached lot | 12.51 x 48.2 | checked; all four designs fit (deep-lot test allows the 19 m Sixplex Narrow) |
| 5465380 | 281 Armadale Ave | R | the narrow-street case: 7.45 m against the Fourplex Narrow's 7.6 m | 7.45 x 41.5 | checked; Fourplex Narrow too close to call, the others no_fit on lot_width |
| 5427581 | 32 Warren Cres | RM f12 | a true 25-foot lot (7.62 m); detached house whose roof outline sits 0.17 m from the neighbour's | 7.62 x 33.5 | checked (was `attached` under the old 0.3 m tolerance); Fourplex Narrow borderline (RM yards 1.2 + 1.2 need 7.9 m) |
| 5458247 | 135 Colbeck St | R | borderline depth: 30.14 m against 6 + 17 + 7.5 = 30.5 | 10.2 x 30.15 | checked (was `attached`); FN, FW, SW borderline, SN no_fit on lot_depth |
| 5456573 | 20 Humberview Rd | RD f12 | borderline depth with the 25 % rear setback: 30.46 m against 30.62 | 10.65 x 30.5 | checked; FN, FW, SW borderline, SN no_fit |
| 5422686 | 34 Rexford Rd | RM f12 | clear fail: 6.40 m lot, Fourplex Narrow short by 1.5 m | 6.40 x 33.5 | checked; all no_fit on lot_width; FW depth row reports 33.5 (see fix 2) |
| 5496138 | 43 Tyndall Ave | R | corner lot: 8.7 m and 37.5 m street edges at 90 degrees; the shorter is the front (by-law convention) | 8.72 x 37.5 | checked; FN fits, FW and SN borderline, SW no_fit |
| 5464574 | 4 Olympus Ave | RD f12 | pie lot: 15.6 m at the setback line, 10.9 m across the band, 2.4 m at the rear | 15.6 x 37.05 | checked; width row uses the band minimum 10.9; every design no_fit on lot_depth (the rear boundary closes in behind the building's corners) |
| 5424074 | 15 Rexford Rd | RM | semi, one massing polygon over two 3.66 m lots (cross-lot area 42 m2) | 3.66 x 33.7 | attached; detached_building blocks every design |
| 5521671 | 552 Beresford Ave | RM | semi split at the party wall in the massing; the two polygons touch (shared-wall rule) | 7.61 x 42.5 | attached |
| 5442045 | 602 Indian Rd | R | a 3-storey house, 13.4 m in the massing: not a larger building | 6.60 x 34.1 | not `larger_building` (its class is `checked`: the party wall is split with a 0.19 m gap, see limits) |
| 5411260 | 155 Vine Ave | R | row house: one 883 m2 massing polygon over 12 lots; clipped to this lot it is 81 m2 | 5.0 x 31.35 | attached (was `larger_building` before footprints were clipped) |
| 5494876 | 1 Ripley Ave | R | condo parcel | - | condo, not checked |
| 5442016 | 405 Jane St | CR | not a residential house zone | - | non_residential, not checked |
| 5443123 | 22 Baby Point Rd | RD f12 | heritage register and heritage district flags on a lot that fits | 10.66 x 35.0 | checked; FN and FW fit, SW borderline (10.66 against 10.5), SN no_fit on building_length (frontage over 10 m needs a 40 m lot for the 19 m length); flags never change the result |
| 5489750 | 74 Elm Grove Ave | R | heritage register flag on a lot that does not fit | 6.86 x 30.9 | checked; all no_fit on lot_width |
| 5491389 | 20 Grafton Ave | R | vacant: no footprint in the massing (22 Grafton next door is vacant too) | 6.09 x 30.6 | checked, flagged vacant; all no_fit on lot_width |
| 5452627 | 62 Alhambra Ave | R | rear lane: street to the east, a 3 m lane to the west; also a semi | 5.75 x 34.45 | attached; front bearing about 73 degrees (the street), not 253 (the lane) |
| 5476952 | 219 Geoffrey St | R | detached house whose roof outline crosses the lot line by 6.5 m2 (eaves) | 9.22 x 39.2 | checked (was `attached`); FN and SN fit, FW borderline (9.22 against 9.04), SW no_fit |

Every expected result above is what the engine produces at the thresholds below; the hand widths and depths
agree with the engine within 0.05 m on every regular lot.

## What the real data changed (2026-10-17)

Four engine changes came out of these lots. Each has a synthetic test as well as the real-lot test.

1. **Rear lanes are not the frontage** (`geometry.choose_frontage`). The derived street-space layer includes
   public lanes, so 34 % of Ward 04 lots have two or more street edges, and in a sample of 600 of them 78 % had
   *parallel* edges (a lane behind) rather than a corner. The by-law's shorter-edge rule then faced the lane in
   about half of those (62 Alhambra Ave: bearing 253 instead of 73). Now, when the lot has an address point,
   street edges parallel to the edge nearest that point and apart from it (direction within
   `street_edge.merge_angle_deg`, distance over `street_edge.min_length_m`) are dropped before the corner rule.
   On Ward 04 this changes the frontage of 2,451 house lots (13 %); 1,824 true corners are untouched; 33 lots
   with no address point keep the shorter edge. Rectangular lots keep the same width and depth; placement,
   bearing and tapered lots change.
2. **Depth row when the placed design reaches past the lot's sides** (`fit.check_design`). The depth across the
   building's width used to be sampled wherever the centred rectangle stood, and past a leaning or dogleg side
   lot line that sample exits the lot part-way back: 24.6 m on the 33.5 m lot at 34 Rexford Rd (a design wider
   than the lot), 17.4 m on the 31 m lot at 166 Varsity Rd and 21.4 m on the 35 m lot at 72 Humbercrest Blvd
   (designs that pass on width but sit on leaning lots). Whenever the placed rectangle leaves the lot's inside
   extent over the band, the row now reports the lot's centre-line depth. On Ward 04 this touches 1,844 of the
   26,756 design rows that pass or are borderline on width and changes 542 results, the sampled ones all moving
   away from the false-short depths (the full direction count was not completed). A finer rule, measuring each
   depth sample along its own front-to-rear piece of the lot, is a candidate for the next session.
3. **Footprints are clipped to the lot** (Task 1c, MASTERSPEC section 0 item 6): 155 Vine Ave stops being a
   "larger building" because its row polygon is 883 m2.
4. **Thresholds** in `contracts/engine_config.json`, below.

## Thresholds and the lots that set them

All counts are over the 18,089 Ward 04 lots in a residential house zone (R, RD, RS, RT, RM), COMMON parcel,
measurable, with a building footprint and at most three address points. The runs varied one value at a time
with the real engine (`is_attached`, `buildings_on_lot`), nothing else.

### `attached.cross_lot_m2`: 4 -> 20

A footprint that crosses the side lot line into a COMMON neighbour by more than this area makes the lot attached.
The massing polygons are roof outlines, so a detached house's eaves and a slightly misaligned lot line produce a
thin crossing of 4 to 20 m2 (0.3 to 1.0 m deep along the wall); a semi drawn as one polygon crosses by 40 to
100 m2 (its other half). Area versus depth of every crossing in the ward:

| cross-lot area | crossing depth 0 to 1 m | 1 to 2 m | 2 to 3 m | 3 m or more |
|---|---|---|---|---|
| 4 to 10 m2 | 1,284 | 24 | 3 | 0 |
| 10 to 20 m2 | 204 | 309 | 32 | 6 |
| 20 to 30 m2 | 0 | 8 | 23 | 19 |
| 30 to 50 m2 | 0 | 1 | 24 | 245 |
| 50 m2 or more | 0 | 0 | 90 | 7,110 |

| `cross_lot_m2` | 4 (old) | 10 | 15 | 20 (new) | 25 | 30 |
|---|---|---|---|---|---|---|
| attached share (shared-wall rule as it was) | 60.6 % | 55.6 % | 54.2 % | 53.7 % | 53.5 % | 53.4 % |
| lots that become detached, from 4 | - | 912 | 1,160 | 1,244 | 1,285 | 1,298 |

The curve flattens at 20: 1,244 lots flip to detached, among them 219 Geoffrey St (6.5 m2), 94 Mayfield Ave
(11.7 m2), 181 Keele St (19.9 m2), all detached houses on the plot. 29 lots with a crossing deeper than 2 m but
under 20 m2 are diagonal slivers of skewed lot lines, not semis.

### `attached.tolerance_m`: 0.3 -> 0.05

The shared-wall rule counts a footprint on a neighbour's lot that runs along this lot's footprint within the
tolerance for more than `shared_edge_m`. In this data, two *detached* roofs 1.2 to 1.8 m apart wall to wall sit
0.1 to 0.5 m apart outline to outline, so the 0.3 m tolerance flagged thousands of detached houses:

| gap between the two outlines | 0 | 0 to 0.05 | 0.05 to 0.1 | 0.1 to 0.15 | 0.15 to 0.2 | 0.2 to 0.3 | 0.3 to 0.45 | 0.45 to 0.6 |
|---|---|---|---|---|---|---|---|---|
| lots (any crossing) | 303 | 20 | 68 | 246 | 292 | 435 | 1,602 | 1,892 |

| `tolerance_m`, shared-wall rule alone | 0.05 | 0.1 | 0.2 | 0.3 (old) |
|---|---|---|---|---|
| attached share | 1.8 % | 2.7 % | 6.5 % | 16.7 % |

32 Warren Cres (gap 0.17 m) and 135 Colbeck St (0.24 m) are detached houses the old tolerance called semis.
Together, 20 m2 and 0.05 m take the ward's attached share from 60.6 % to 41.6 %; 3,438 lots flip to detached
(1,892 eaves crossings of 4 to 20 m2, 1,546 shared-wall hits at gaps of 0.05 to 0.3 m) and none flip the other
way. The spec's synthetic fixture assumed 35.8 %.

`attached.shared_edge_m` stays 3 m and `attached.on_lot_m2` stays 10 m2: nothing in the data argued either way.

### `larger_building.avg_height_m`: 12 -> 16

| `avg_height_m` | 12 (old) | 13 | 14 | 16 (new) | 20 |
|---|---|---|---|---|---|
| house lots classed larger_building by height | 393 | 248 | 158 | 75 | 32 |

Of the 318 lots between 12 and 16 m, 274 have a clipped footprint under 150 m2 and one address (3-storey houses
such as 602 Indian Rd, 13.4 m, and 15 Lincoln Ave, 13.1 m); 17 have footprints over 350 m2 and are caught by the
footprint rule regardless. Every apartment building in the sample (188 Jameson Ave 19.4 m, 85 Spencer Ave
18.2 m, 1447 King St W 16.3 m) has a footprint over 350 m2. Above 16 m, 43 small-footprint lots remain
larger_building; some may be tall narrow houses on the escarpment, so this is the conservative side.

### `larger_building.footprint_m2`: 350 (unchanged, now on the clipped footprint)

| `footprint_m2` | 300 | 350 | 400 | 500 |
|---|---|---|---|---|
| house lots classed larger_building by footprint | 169 | 143 | 135 | 100 |

Flat between 350 and 400; the lots just under 350 are large single houses on 600 to 2,000 m2 lots (131 High Park
Ave 300 m2, 112 Baby Point Rd 315 m2). Unchanged.

## Limits worth knowing

- **Split semis with a gap.** When the massing splits a semi into two polygons at the party wall with a visible
  gap (602 Indian Rd 0.19 m, 95 Grenadier Rd 0.15 m), Suplex now reads the lot as detached. The gap between two
  detached roofs and the gap between two split halves overlap in this data, so no tolerance separates them; the
  cross-lot area (one polygon over both halves, the common case) is the reliable signal. Both example lots still
  read "doesn't fit", on lot width instead of the attached rule. An estimate from footprint-width ratios puts such
  lots at 2 to 3 % of house lots.
- **Garages make lots unmeasurable.** 5.2 step 6 says two or more footprints over 20 m2 make a lot unmeasurable;
  343 Ward 04 house lots (1.8 %) hit this, mostly a house plus a detached garage. The copy ("lot shape too
  irregular to measure") is misleading there. Left as the spec says; a second threshold for the second building
  would be a contract change for Andrew.
- **No address point.** 33 house lots with several street edges and no address point keep the by-law
  shorter-edge rule, which may face a lane.
- **Pie lots fail on depth across the building.** 4 Olympus Ave fails every design because the rear lot line
  converges behind the building's corners; the by-law measures the rear setback from the rear wall, so this is
  the rule as written, but a tapered rear yard reads as "lot too shallow".
