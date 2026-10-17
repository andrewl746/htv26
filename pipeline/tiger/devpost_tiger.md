# Tiger Data: Devpost section and 30-second walkthrough (draft, Y9)

For Simone's `docs/devpost.md`. The numbers below were measured on the real Tiger Data service on 2026-10-17 (PostgreSQL 18.6, TimescaleDB 2.30.2); re-run `pipeline/tiger/load.py` after the Hour-24 refresh and update them if the data changes. The permit counts come from `permit_counts.json` / `ward_summary.json` and must equal them.

## Devpost text (about 120 words)

**How we used Tiger Data.** The "did" half of Suplex's headline is the multiplex permits the City has actually issued since May 2023. We load every building permit that passes our rule (permits creating 2 to 6 units, one row per project; 7,342 geocoded permits since January 2022) into a TimescaleDB hypertable on Tiger Data, chunked by quarter. A continuous aggregate, `permits_ward_month`, keeps permits and units per ward per month, so each ward's trend chart is one indexed read and refreshes daily with a policy. Compression is switched on with a seven-day policy and shrinks the table's total footprint by 27.6% (indexes by 77.7%). If Tiger Data is unreachable, the API serves a cached trend file within two seconds, and the page says so ("cached"). The address check never touches Tiger Data.

## 30-second walkthrough (Yuvi, live at the sponsor table; a screen recording is only a backup)

The SQL for every step is in `pipeline/tiger/walkthrough.sql` (all five queries tested on the real service). Step 3 of the original script below is the first six rows of the aggregate; step 5 shows the number the app reads.

1. (0:00) Tiger Data console: the service, and `SELECT extversion FROM pg_extension WHERE extname='timescaledb'`.
2. (0:06) `\d+ permits` and `SELECT * FROM timescaledb_information.hypertables;` — "a hypertable, 3-month chunks".
3. (0:12) `SELECT month, permits, units FROM permits_ward_month WHERE ward='04' ORDER BY month LIMIT 6;` — "the continuous aggregate behind the trend chart".
4. (0:20) `SELECT * FROM hypertable_compression_stats('permits');` — "3.59 MB to 2.60 MB in total (27.6% smaller), indexes 77.7% smaller".
5. (0:26) Switch to the web app's ward 04 chart; unset `TIGER_DSN`, reload: the "cached" badge appears.

## Facts to keep honest

- 7,342 permits is a small table; say "keeps working as the history grows", not "big data". Do not claim a compression ratio beyond the measured one.
- The aggregate refresh policy is daily; the Hour-24 refresh re-runs `pipeline/permits.py` then `pipeline/tiger/load.py`.
- Credit the City of Toronto building permits (active and cleared) and the Toronto Multiplex Tracker's filtering rule.
