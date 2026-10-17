Every fixture in this folder is synthetic: made-up addresses ("100 Fixture St" and its neighbours), made-up lots and made-up counts. No fixture number may ever appear in the pitch, the Devpost or a briefing.

# Fixtures

Build against these before the pipeline, the API and the AI service exist. `python contracts/validate.py` checks each one against its schema in `../schemas/`.

| File | Schema | What it exercises |
|---|---|---|
| `search.json` | `search.response` | four results, one per check fixture (`fixture-1` to `fixture-4`) |
| `check.borderline.json` | `check.response` | `100 Fixture St`: 7.62 × 33.5 m RD (f7.5) lot; Fourplex Narrow too close to call on width (margin 0.02 m); the other three don't fit on width; Sixplex Narrow also fails building length |
| `check.fits.json` | `check.response` | `200 Fixture St`: 12.2 × 40.0 m RD (f12.0) lot; all four designs fit; deep lot, so 19.0 m length is allowed (10.20.40.20(3)) |
| `check.no_fit.json` | `check.response` | `300 Fixture St`: 6.1 × 30.0 m RD (f6.0) lot, vacant (`vacant` flag, no `existing_building`); every design fails on width; depth fails inside the band (borderline row, still no fit) |
| `check.not_checked.json` | `check.response` | `400 Fixture St`: a condo; four `not_checked` designs with empty rules and null polygons |
| `ward.04.json` | `ward.response` | the ward panel for Ward 04 |
| `ward_summary.sample.json` | `ward_summary.file` | wards 04 and 19 plus the `city` entry (`ward_id: "city"`) |
| `trend.04.json` | `trend.response` | one entry per month 2022-01 to 2026-10, zero months filled; sums match `ward.04.json` `permits.by_year` and the since-May-2023 counts |
| `lots.04.sample.geojson` | `lot_feature.props` (each feature) | 12 lots covering every class and every result |
| `permits.sample.geojson` | `permit_feature.props` (each feature) | 12 permit points: all four kinds, one from 2022 (filtered off the map), two in Ward 19 |
| `explain.request.json` | `explain.request` | `check` is `check.borderline.json`, `design_id` `fourplex_narrow`, `lang` `en` |
| `explain.response.json` | `explain.response` | the English explanation for that request |
| `briefing.request.json` | `briefing.request` | `ward` is `ward.04.json` (the GET /ward/04 response, urls included), `trend` is `trend.04.json` |
| `briefing.04.en.json`, `briefing.04.fr.json` | `briefing.response` | the Ward 04 briefing in English and French, same placeholders in both |

## Conventions the check fixtures follow (the engine reproduces them)

- Local frame: lot centroid at the origin, x east, y north; the street is on the south edge (`front_bearing_deg` 180). "Left" is the negative-x side, as seen from the street; `side_yards_m[0]` is the left yard.
- Each required side yard is the larger of the design's own yard and the zone minimum for the zone's `f` value. Required width = building width + both yards.
- Rear setback = max(7.5, 25% of lot depth). Required depth = 6.0 front + building length + rear.
- Building length allowed is a lot-level value: 19.0 m for every design on a deep lot (10.20.40.20(3)), else 17.0 m (10.20.40.20(1)).
- Coverage allowed = max(overlay, 45); actual = building area / lot area × 100.
- A row is `borderline` when it is banded (width, depth, coverage) and |margin| ≤ the band (0.5 m, 2 pp), inclusive, using the rounded margin. `pass` is margin ≥ 0. A design is `no_fit` when any row has `pass: false` and is not borderline; `blocking_rule` is the first such row. Otherwise `borderline` if any row is borderline, else `fits`. `blocking_rule` is null unless the result is `no_fit`.
- Placement: front wall at the front setback; left edge at the left lot line + left yard + half of (lot width − required width), so a design that is too wide overhangs both yards equally. Placement corners are front-left, front-right, rear-right, rear-left.
- `buildable_local` is the lot inset by front, rear, left and right setbacks for that design. `setbacks_local` are the four strips: front and rear span the full lot width, left and right run between the front and rear setback lines.
- `fail_slices_local` is placement minus buildable: one polygon per connected part (two side strips when only the width fails; one U-shape when the building also crosses the rear setback, as on the no-fit lot). Each ring is counter-clockwise from its lowest (y, x) corner.
- Depth is measured only where the building's x range overlaps the lot, so a building wider than the lot still reports the lot's depth.
- Rounding: compute in full precision, then Python `round(x, 2)` for metres and `round(x, 1)` for percentages (ties go to even on the exact binary value: 8.375 → 8.38, 2.125 → 2.12, 0.125 → 0.12).
- Rings: `polygon_local` and `polygon_wgs84` are closed (first point repeated); every other polygon is open.
- `permits_nearby` holds the sample permits that are `multiplex`, issued since 2023-05-01, within 500 m; it is filled for every class, condos included.
