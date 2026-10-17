# Report 4: Tiger Data is live (Y2, Y5, Y9)

2026-10-17, branch `yuvi`. Supersedes the "Tiger Data is local-only" lines in `REPORT.md`, report 2 and report 3.

## What changed

- **Y2 done:** a Tiger Data service exists; `TIGER_DSN` is in the local `.env` (gitignored, never committed). `pipeline/tiger/ping.py` returns `[('timescaledb', '2.30.2')]` (PostgreSQL 18.6).
- **Y5 done on the real service:** `schema.sql` applied (hypertable `permits`, continuous aggregate `permits_ward_month`, compression and refresh policies), 7,342 permits loaded in 20 three-month chunks, all 20 compressed.
- **Numbers are real now** (`pipeline/tiger/tiger.md`, `devpost_tiger.md`): total 3,588,096 to 2,596,864 bytes (-27.6%), indexes 1,466,368 to 327,680 (-77.7%).
- **`load.py` fix:** the service's compression policy job runs the instant the table exists, so `hypertable_size()` read after loading was already compressed (it showed 3.29 MB then 3.28 MB). `load.py` now records `size_at_load_end` and `size_after_compression` honestly, and the true before and after come from `hypertable_compression_stats`.
- **Trend cache rebuilt from the real service:** `data/out/trend_cache/01..25.json`; all 25 pass `trend.response.schema.json`.

## Verified against the real service

| Check | Result |
|---|---|
| `ward_trend("04")` | 58 monthly points, 2022-01 to 2026-10, zero months filled |
| Per-ward `count` and `sum(units)` since 2023-05 vs `permit_counts.json` | identical for all 25 wards |
| Aggregate `sum(permits)` since 2023-05 vs `permit_counts.json` | identical |
| `TIGER_DSN` unset | every query raises `TigerUnavailable` |
| Jobs | `policy_compression` (12 h, after 7 days) and `policy_refresh_continuous_aggregate` (daily) both ran successfully |

## What is left on Tiger Data

- Record the 30-second walkthrough (script in `devpost_tiger.md`) and give Simone the Devpost paragraph.
- After the Hour-24 refresh: `python pipeline/refresh.py --tiger` (reloads, re-caches) and update the numbers if the data changed.
- Andrew sets `TIGER_DSN` in his own `.env` for `/ward/{id}/trend` (`source: tigerdata`); without it the API serves the cache (`source: cache`). Send it to him privately, not through GitHub.

**Security note:** the connection string was pasted into the Claude chat. It is in the chat transcript only, not in any file in git. If that transcript might be shared, rotate the service password in the Tiger console and update `.env`.
