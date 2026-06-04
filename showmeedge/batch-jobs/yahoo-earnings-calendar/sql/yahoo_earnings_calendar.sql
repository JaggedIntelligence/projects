CREATE TABLE IF NOT EXISTS yahoo_earnings_calendar (
  earnings_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 8192,
  company_name STRING,
  event_name STRING,
  earnings_call_time SYMBOL CAPACITY 32,
  eps_estimate DOUBLE,
  reported_eps DOUBLE,
  surprise_percent DOUBLE,
  market_cap STRING,
  source_url STRING,
  scraped_at TIMESTAMP,
  run_id SYMBOL CAPACITY 256
) TIMESTAMP(earnings_ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(earnings_ts, symbol)

