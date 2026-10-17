# Report 5: ward-by-ward check against the City's 452 (closes the Y3 Tracker comparison)

2026-10-17, branch `yuvi`.

The spec's Y3 check asks for Ward 04's count to be in the same range as the Toronto Multiplex Tracker's. The Tracker is a live map (and counts every permit creating 1 to 6 units, so it is a different, larger set than our multiplex kind). A better benchmark exists: the City's own staff-report attachment lists the 452 multiplex permits **by ward** (council background file 255851, "Multiplex Permits by Ward - All Permits", Figure 10; https://www.toronto.ca/legdocs/mmis/2025/ph/bgrd/backgroundfile-255851.pdf). I extracted that table and compared it with our `multiplex` permits issued 2023-05-01 to 2024-11-30 per ward.

## Result

- **Ward 04: City 42, ours 42 (exact).**
- All 25 wards: City 452, ours 438 (-14, -3.1%; our 446 total includes 8 permits with no ward). Correlation across wards 0.969, mean absolute difference 3.0 permits per ward.
- Largest gaps: Ward 14 (-11), Ward 01 (-7), Ward 12 (-6), Ward 03 (+6), Ward 20 (+7). The City's two review sets used different dates and review methods ("Detailed Review" 222 and "High-level Review" 230), and their window is May 2023 to about November 2024, so small per-ward differences are expected.

| Ward | City (452) | Ours | Diff |
|---|---|---|---|
| 01 | 21 | 14 | -7 |
| 02 | 10 | 13 | +3 |
| 03 | 24 | 30 | +6 |
| 04 | 42 | 42 | +0 |
| 05 | 39 | 35 | -4 |
| 06 | 9 | 12 | +3 |
| 07 | 5 | 5 | +0 |
| 08 | 18 | 18 | +0 |
| 09 | 68 | 69 | +1 |
| 10 | 15 | 14 | -1 |
| 11 | 41 | 36 | -5 |
| 12 | 25 | 19 | -6 |
| 13 | 1 | 2 | +1 |
| 14 | 36 | 25 | -11 |
| 15 | 6 | 5 | -1 |
| 16 | 1 | 3 | +2 |
| 17 | 5 | 4 | -1 |
| 18 | 14 | 16 | +2 |
| 19 | 23 | 20 | -3 |
| 20 | 16 | 23 | +7 |
| 21 | 12 | 10 | -2 |
| 22 | 2 | 4 | +2 |
| 23 | 6 | 3 | -3 |
| 24 | 10 | 10 | +0 |
| 25 | 3 | 6 | +3 |

## What this means

Rule A (units created 2 to 6, non-SFD, one per project) tracks the City's own count closely, both in total and ward by ward. The Y3 check is closed with a better source than the Tracker map. The "did" numbers can be quoted with the method stated ("permits creating 2 to 6 units, one row per project"), not as the City's official count. Do not claim our ward numbers equal the City's; Ward 04 does, most others are within a few permits.
