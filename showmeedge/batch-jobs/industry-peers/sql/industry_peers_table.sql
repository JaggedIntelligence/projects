CREATE TABLE IF NOT EXISTS industry_peers (
  snapshot_ts TIMESTAMP,
  source_ticker SYMBOL CAPACITY 8192,
  peer_ticker SYMBOL CAPACITY 8192,
  rank INT,
  company_name STRING,
  industry SYMBOL CAPACITY 4096,
  program_id SYMBOL CAPACITY 256,
  run_id SYMBOL CAPACITY 256
) TIMESTAMP(snapshot_ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(snapshot_ts, source_ticker, peer_ticker);