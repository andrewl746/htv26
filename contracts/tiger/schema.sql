-- contracts/tiger/schema.sql — run once on the Tiger Data service (psql "$TIGER_DSN" -f contracts/tiger/schema.sql)
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS permits (
  permit_id        text    NOT NULL,              -- PERMIT_NUM without its type suffix
  revision         text    NOT NULL DEFAULT '00', -- REVISION_NUM
  issued_at        date    NOT NULL,              -- ISSUED_DATE
  ward             text    NOT NULL,              -- "04"
  units_created    integer NOT NULL,              -- DWELLING_UNITS_CREATED, parsed
  units_lost       integer NOT NULL DEFAULT 0,
  kind             text    NOT NULL,              -- multiplex | secondary_suite | laneway_garden | other
  is_multiplex     boolean NOT NULL,
  lat              double precision,
  lon              double precision,
  address_point_id bigint,
  structure_type   text,
  work             text,
  PRIMARY KEY (permit_id, revision, issued_at)
);

SELECT create_hypertable('permits', 'issued_at',
  chunk_time_interval => INTERVAL '3 months', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS permits_ward_issued_idx ON permits (ward, issued_at DESC);

-- The continuous aggregate behind /ward/{id}/trend
CREATE MATERIALIZED VIEW IF NOT EXISTS permits_ward_month
WITH (timescaledb.continuous) AS
SELECT time_bucket(INTERVAL '1 month', issued_at) AS month,
       ward,
       count(*)           AS permits,
       sum(units_created) AS units
FROM permits
WHERE is_multiplex
GROUP BY month, ward
WITH NO DATA;

SELECT add_continuous_aggregate_policy('permits_ward_month',
  start_offset => INTERVAL '10 years', end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Compression for the full history (the before/after sizes go in /docs/tiger.md)
ALTER TABLE permits SET (timescaledb.compress,
  timescaledb.compress_segmentby = 'ward', timescaledb.compress_orderby = 'issued_at DESC');
SELECT add_compression_policy('permits', INTERVAL '7 days', if_not_exists => TRUE);

-- After load.py (also in pipeline/tiger/load.py):
--   CALL refresh_continuous_aggregate('permits_ward_month', NULL, NULL);
--   SELECT pg_size_pretty(hypertable_size('permits'));                      -- before
--   SELECT compress_chunk(c, if_not_compressed => TRUE) FROM show_chunks('permits') c;
--   SELECT pg_size_pretty(hypertable_size('permits'));                      -- after
--   SELECT * FROM hypertable_compression_stats('permits');
-- Newer Tiger Data releases call compression the columnstore (timescaledb.enable_columnstore,
-- add_columnstore_policy, hypertable_columnstore_stats); the names above still work as aliases.
