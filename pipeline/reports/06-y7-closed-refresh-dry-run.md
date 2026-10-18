# Report 6: Y7 closed on the citywide file, Hour-24 refresh dry run

2026-10-17, branch `yuvi`.

## Y7: Andrew's hand-checked lots pass on the citywide file

`docs/test-lots.md` (19 real Ward 04 parcels, A8) is on `main`. I ran main's engine from a clean extract of `origin/main` against my local `data/out/suplex.gpkg`, which is byte-identical to the `data-2026-10-17` release asset (sha256 `7fb34839...ecb0`).

- `pytest engine`: 155 passed, 0 skipped. `engine/tests/test_lots.py`: 39 passed, so the real-lot tests ran rather than skipping.
- `checks.py --all`: ALL CHECKS PASSED. Median `area_m2` / `STATEDAREA` = 1.0000 (needs 0.97 to 1.03).
- The 59 % `attached` share from the smoke run (report 3) came from the old thresholds (Andrew measured 60.6 % with them). With his tuned `attached.cross_lot_m2` 20 and `attached.tolerance_m` 0.05 it is 41.6 %, per `docs/test-lots.md`. I did not re-measure the share myself.

Y7 acceptance is met.

## Release files verified

`suplex_ward04.gpkg`, `suplex_citywide.gpkg.gz` (integrity ok, decompressed hash equals the local file), `permits.geojson`, `permit_counts.json`, `data_dates.json` match the local copies. The 25 trend-cache series equal the local ones (the files differ in bytes only).

## Hour-24 refresh: `pipeline/refresh.py --dry-run`

New flag. It changes nothing and checks: Python and imports, free disk, every step's script, the current outputs, Tiger Data (reachable, timescaledb present, row count; the connection string is never printed), and each City dataset's `last_refreshed` against `data/out/data_dates.json`. It exits non-zero and prints `[FIX]` lines if anything is missing.

The real run also prints how the multiplex counts since May 2023 moved, citywide and per ward, so the team knows which numbers to re-read.

Dry run at 2026-10-17 afternoon: READY. Two of 11 datasets changed upstream since the last download (both permit files, refreshed 2026-10-17); the rest are unchanged.

```
python pipeline/refresh.py --dry-run --tiger    # check
python pipeline/refresh.py --tiger              # the Hour-24 run
```

`load.py` truncates the permits table before the COPY, so a failed load leaves it empty until rerun; the API serves the trend cache meanwhile. Uploading to the GitHub release stays a manual step.

## What is left

- Hour-24: run the refresh, replace the release files, tell Andrew and Simone (Devpost numbers must equal the new `ward_summary.json`).
- The 30 s Tiger walkthrough video (waiting on Simone: Devpost or live demo).
- Checkpoint output into `docs/decisions.md` at Hours 18, 24 and 30 (through Simone).
