# Tiger Data in Suplex (Y5)

What it does: the City's multiplex permits (Rule A, since 2022-01) live in a TimescaleDB hypertable on Tiger Data.
A continuous aggregate (`permits_ward_month`) serves the ward trend chart; the API falls back to
`data/out/trend_cache/*.json` if Tiger is unreachable (2 s timeout).

| Piece | File |
|---|---|
| Schema (hypertable, continuous aggregate + policy, compression + policy) | `pipeline/tiger/schema.sql` |
| Loader (COPY, refresh aggregate, compress, record sizes) | `pipeline/tiger/load.py` -> `tiger_stats.json` |
| Queries used by the API (`ward_trend`, `ward_count_since`, `all_wards_count_since`; raise `TigerUnavailable`) | `pipeline/tiger/queries.py` |
| Trend cache for all 25 wards | `pipeline/tiger/cache_trends.py` -> `data/out/trend_cache/{01..25}.json` |
| Connection check | `pipeline/tiger/ping.py` |

Run: `export TIGER_DSN=...` (or put it in `.env`), then `python pipeline/tiger/ping.py`, `python pipeline/tiger/load.py`,
`python pipeline/tiger/cache_trends.py`.

## Sizes (from `tiger_stats.json`)

Measured on a local TimescaleDB 2.30.2 (Docker, `timescale/timescaledb:latest-pg17`), 7,342 geocoded permits in 20 three-month chunks.
**Re-run `load.py` on the real Tiger Data service and replace these numbers before they go in the Devpost.**

| | before compression | after compression |
|---|---|---|
| `hypertable_size('permits')` | 3,620,864 bytes (3536 kB) | 3,284,992 bytes (3208 kB) |
| `hypertable_compression_stats` total | 3,588,096 bytes | 2,596,864 bytes (about 28% smaller) |
| index bytes | 1,466,368 | 327,680 |

The dataset is small (7K rows), so the absolute savings are small; the point is the policy and the continuous aggregate, which keep working as the
history grows. Do not claim a compression ratio beyond these measured numbers.

## Checks

- `ward_trend("04")` returns 58 monthly points from 2022-01 to 2026-10, zero months filled.
- Per-ward `sum(permits)` in the aggregate since 2023-05 equals `permit_counts.json` for all 25 wards; `units` equal too.
- With `TIGER_DSN` unset, every query raises `TigerUnavailable`.
