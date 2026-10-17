-- 30-second Tiger Data walkthrough (Yuvi). Paste each block into the Tiger Data SQL editor or psql "$TIGER_DSN".
-- Script and talking points: pipeline/tiger/devpost_tiger.md

-- 1. (0:00) the service runs TimescaleDB
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';

-- 2. (0:06) "a hypertable, three-month chunks"
SELECT hypertable_name, num_chunks, compression_enabled FROM timescaledb_information.hypertables;

-- 3. (0:12) the continuous aggregate behind the trend chart: Ward 04, first months
SELECT to_char(month, 'YYYY-MM') AS month, permits, units
FROM permits_ward_month WHERE ward = '04' ORDER BY month LIMIT 6;

-- 4. (0:20) compression, measured on this service
SELECT pg_size_pretty(before_compression_total_bytes) AS before,
       pg_size_pretty(after_compression_total_bytes)  AS after,
       round(100.0 * (1 - after_compression_total_bytes::numeric / before_compression_total_bytes), 1) AS pct_smaller
FROM hypertable_compression_stats('permits');

-- 5. (0:26) the headline number the app reads: Ward 04 multiplex permits since May 2023
SELECT count(*) AS ward_04_multiplex_since_may_2023
FROM permits WHERE ward = '04' AND is_multiplex AND issued_at >= '2023-05-01';
