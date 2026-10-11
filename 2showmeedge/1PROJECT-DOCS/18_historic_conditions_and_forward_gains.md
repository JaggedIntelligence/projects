# Feature: Historic Conditions and Forward Gains

## Goal

Add reusable forward-gain metrics for every row in the existing QuestDB daily OHLCV table:

```text
equity_ohlcv_daily
```

The first version should support questions like:

- After a given trading condition occurred, what was the stock's next-day gain?
- What was the forward 2-day, 5-day, 2-week, and 1-month percentage change?
- For a symbol/universe, how often did a historic setup lead to positive forward returns?

Requested forward-gain horizons:

```text
forward_1day_percentage_change
forward_2day_percentage_change
forward_5day_percentage_change
forward_2week_percentage_change
forward_1month_percentage_change
```

Use this spelling in implementation: `forward_*`, not `forwared_*`.

## Key Design Decision

Do not physically add these derived columns to `equity_ohlcv_daily` as the primary design.

Instead, keep `equity_ohlcv_daily` as the raw source table and write forward-gain metrics into a derived QuestDB table:

```text
equity_ohlcv_daily
    -> equity_forward_returns_daily
```

Reason:

- `equity_ohlcv_daily` is already the canonical raw daily price table.
- It is WAL enabled and dedupes/upserts on `(ts, symbol, provider)`.
- Forward gains depend on future bars, so today's row cannot have complete values until future trading days arrive.
- A derived table can be safely rebuilt without mutating raw price history.
- A partial upsert into the raw table is risky because omitted raw OHLCV columns may become null depending on the insert/update path.
- Later historic-condition features can join against the forward-return table without recalculating horizons during user requests.

The app can still expose a "daily bars with forward gains" shape through an API query, SQL query, or QuestDB view if the deployed QuestDB version supports the desired view syntax.

## Existing Source Table

Current QuestDB table:

```sql
CREATE TABLE IF NOT EXISTS equity_ohlcv_daily (
  ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  provider_symbol SYMBOL CAPACITY 1024,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  adj_close DOUBLE,
  volume LONG,
  currency SYMBOL CAPACITY 8,
  ingested_at TIMESTAMP
) TIMESTAMP(ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(ts, symbol, provider)
```

Important rules:

- Use `adj_close` for return calculations when present.
- Fall back to `close` only when `adj_close` is null.
- Always partition calculations by both `symbol` and `provider`.
- Treat `ts` as the trading date at daily granularity.

## Horizon Semantics

Use trading-row offsets, not calendar-day offsets.

That means weekends and market holidays are naturally skipped because they do not appear as rows in `equity_ohlcv_daily`.

Recommended mapping:

```text
1day   = next 1 trading row
2day   = next 2 trading rows
5day   = next 5 trading rows
2week  = next 10 trading rows
1month = next 21 trading rows
```

Formula:

```text
forward_percentage_change = 100.0 * (future_adjusted_close / current_adjusted_close - 1.0)
```

Example:

```text
current adjusted close = 100.00
future adjusted close  = 103.25
forward gain           = 3.25
```

Store percentage points, not decimal returns. A value of `3.25` means `+3.25%`.

Rows near the latest available date will have null values for horizons whose future bar does not exist yet.

## Derived Table

Recommended QuestDB schema:

```sql
CREATE TABLE IF NOT EXISTS equity_forward_returns_daily (
  ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,

  base_price DOUBLE,

  forward_1day_percentage_change DOUBLE,
  forward_2day_percentage_change DOUBLE,
  forward_5day_percentage_change DOUBLE,
  forward_2week_percentage_change DOUBLE,
  forward_1month_percentage_change DOUBLE,

  source_ingested_at TIMESTAMP,
  calculated_at TIMESTAMP
) TIMESTAMP(ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(ts, symbol, provider)
```

Field notes:

- `ts`: same trading date as the source OHLCV row.
- `symbol`: canonical app symbol.
- `provider`: source provider, for example `yfinance`.
- `base_price`: `coalesce(adj_close, close)` for the source row.
- `forward_*_percentage_change`: future percentage change at each trading-row horizon.
- `source_ingested_at`: source row's `ingested_at`, useful for debugging stale derived rows.
- `calculated_at`: timestamp when the derived row was calculated.

## Full Backfill SQL

Run this once after creating the derived table, and any time the derived table needs a complete rebuild.

```sql
WITH priced AS (
  SELECT
    ts,
    symbol,
    provider,
    coalesce(adj_close, close) AS base_price,
    ingested_at AS source_ingested_at
  FROM equity_ohlcv_daily
  WHERE provider = 'yfinance'
),
calc AS (
  SELECT
    ts,
    symbol,
    provider,
    base_price,
    source_ingested_at,
    lead(base_price, 1) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_1day,
    lead(base_price, 2) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_2day,
    lead(base_price, 5) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_5day,
    lead(base_price, 10) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_2week,
    lead(base_price, 21) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_1month
  FROM priced
)
INSERT INTO equity_forward_returns_daily
SELECT
  ts,
  symbol,
  provider,
  base_price,
  CASE
    WHEN base_price > 0 AND price_1day IS NOT NULL
    THEN 100.0 * (price_1day / base_price - 1.0)
  END AS forward_1day_percentage_change,
  CASE
    WHEN base_price > 0 AND price_2day IS NOT NULL
    THEN 100.0 * (price_2day / base_price - 1.0)
  END AS forward_2day_percentage_change,
  CASE
    WHEN base_price > 0 AND price_5day IS NOT NULL
    THEN 100.0 * (price_5day / base_price - 1.0)
  END AS forward_5day_percentage_change,
  CASE
    WHEN base_price > 0 AND price_2week IS NOT NULL
    THEN 100.0 * (price_2week / base_price - 1.0)
  END AS forward_2week_percentage_change,
  CASE
    WHEN base_price > 0 AND price_1month IS NOT NULL
    THEN 100.0 * (price_1month / base_price - 1.0)
  END AS forward_1month_percentage_change,
  source_ingested_at,
  now() AS calculated_at
FROM calc
WHERE base_price > 0;
```

Because the target table has dedup upsert keys on `(ts, symbol, provider)`, rerunning the insert-select should update the derived rows for the same source keys.

## Incremental Refresh SQL

Daily refresh should recompute a recent rolling window, not just the newly inserted date.

Reason:

- The row from yesterday gets its 1-day forward return only after today's bar exists.
- The row from 5 trading days ago gets its 5-day return only after today's bar exists.
- The row from roughly 21 trading days ago gets its 1-month return only after today's bar exists.

Use a lookback window large enough to cover the maximum forward horizon plus weekends, holidays, and late corrections.

Recommended default:

```text
70 calendar days
```

Incremental SQL shape:

```sql
WITH bounds AS (
  SELECT
    dateadd('d', -70, max(ts)) AS refresh_start_ts,
    max(ts) AS refresh_end_ts
  FROM equity_ohlcv_daily
  WHERE provider = 'yfinance'
),
priced AS (
  SELECT
    d.ts,
    d.symbol,
    d.provider,
    coalesce(d.adj_close, d.close) AS base_price,
    d.ingested_at AS source_ingested_at
  FROM equity_ohlcv_daily d
  WHERE d.provider = 'yfinance'
),
calc AS (
  SELECT
    ts,
    symbol,
    provider,
    base_price,
    source_ingested_at,
    lead(base_price, 1) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_1day,
    lead(base_price, 2) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_2day,
    lead(base_price, 5) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_5day,
    lead(base_price, 10) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_2week,
    lead(base_price, 21) OVER (
      PARTITION BY symbol, provider
      ORDER BY ts
    ) AS price_1month
  FROM priced
)
INSERT INTO equity_forward_returns_daily
SELECT
  c.ts,
  c.symbol,
  c.provider,
  c.base_price,
  CASE
    WHEN c.base_price > 0 AND c.price_1day IS NOT NULL
    THEN 100.0 * (c.price_1day / c.base_price - 1.0)
  END AS forward_1day_percentage_change,
  CASE
    WHEN c.base_price > 0 AND c.price_2day IS NOT NULL
    THEN 100.0 * (c.price_2day / c.base_price - 1.0)
  END AS forward_2day_percentage_change,
  CASE
    WHEN c.base_price > 0 AND c.price_5day IS NOT NULL
    THEN 100.0 * (c.price_5day / c.base_price - 1.0)
  END AS forward_5day_percentage_change,
  CASE
    WHEN c.base_price > 0 AND c.price_2week IS NOT NULL
    THEN 100.0 * (c.price_2week / c.base_price - 1.0)
  END AS forward_2week_percentage_change,
  CASE
    WHEN c.base_price > 0 AND c.price_1month IS NOT NULL
    THEN 100.0 * (c.price_1month / c.base_price - 1.0)
  END AS forward_1month_percentage_change,
  c.source_ingested_at,
  now() AS calculated_at
FROM calc c
CROSS JOIN bounds b
WHERE c.base_price > 0
  AND c.ts >= b.refresh_start_ts;
```

This computes `lead(...)` over the full provider history, then only writes rows inside the refresh window. That keeps the forward offsets correct at the start of the rolling window.

If performance becomes an issue, optimize by loading a bounded calculation window per symbol:

```text
write rows where ts >= refresh_start
calculate over rows where ts >= refresh_start - warmup_window
```

For this feature, the simple full-provider window calculation is acceptable for the first implementation.

## Joined Read Shape

For consumers that want OHLCV rows plus forward-gain columns, use a joined query:

```sql
SELECT
  d.ts,
  d.symbol,
  d.provider,
  d.provider_symbol,
  d.open,
  d.high,
  d.low,
  d.close,
  d.adj_close,
  d.volume,
  d.currency,
  d.ingested_at,
  f.forward_1day_percentage_change,
  f.forward_2day_percentage_change,
  f.forward_5day_percentage_change,
  f.forward_2week_percentage_change,
  f.forward_1month_percentage_change
FROM equity_ohlcv_daily d
LEFT JOIN equity_forward_returns_daily f
  ON d.ts = f.ts
 AND d.symbol = f.symbol
 AND d.provider = f.provider
WHERE d.symbol = 'AAPL'
  AND d.provider = 'yfinance'
ORDER BY d.ts ASC;
```

If the current QuestDB deployment supports the desired view syntax, create a view for this joined shape. Otherwise, keep the join in the repository/API query layer.

## Batch Job Design

Add a Python job:

```text
services/market-api/app/jobs/refresh_forward_returns.py
```

Arguments:

```text
--provider yfinance
--universe sp500_current
--symbols AAPL MSFT
--lookback-days 70
--full
--run-summary-file /tmp/forward-returns-summary.json
```

Behavior:

- Ensure `equity_forward_returns_daily` exists.
- Resolve symbols from `--symbols` or `--universe`.
- For `--full`, compute all rows for the selected provider/symbols.
- For default incremental mode, compute only rows with `ts >= max(ts) - lookback_days`.
- Use QuestDB insert-select into the derived table.
- Rely on dedup upsert keys for idempotent reruns.
- Write a JSON run summary with row counts, min/max timestamps, provider, universe, and symbols.

Recommended Python repository functions:

```text
ensure_equity_forward_returns_daily_table()
refresh_forward_returns(provider, symbols, lookback_days)
refresh_forward_returns_full(provider, symbols)
fetch_forward_returns_coverage(provider, symbols)
```

## Safe Shell Wrapper

Add a safe batch wrapper similar to the existing EOD refresh wrapper:

```text
batch-jobs/forward-returns/refresh-forward-returns-safe.sh
```

Example usage:

```bash
bash batch-jobs/forward-returns/refresh-forward-returns-safe.sh \
  --universe sp500_current \
  --lookback-days 70
```

The wrapper should:

- Start or verify `questdb` and `market-api`.
- Wait for `/health` and `/questdb/health`.
- Validate the requested universe has enough symbols unless `--allow-small-universe` is passed.
- Run the Python job inside the `market-api` container.
- Copy the run summary from the container to a host log directory.
- Run a verification query.
- Exit non-zero if refresh or verification fails.

Suggested log layout:

```text
batch-jobs/forward-returns/LOG/showmeedge-sp500-forward-returns/<run-id>/
  refresh.log
  verification.log
  run-summary.json
```

## Daily Pipeline Order

Forward gains should refresh after the OHLCV EOD job succeeds.

Pipeline:

```text
1. Refresh recent OHLCV bars.
   batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh

2. Refresh recent forward-gain metrics.
   batch-jobs/forward-returns/refresh-forward-returns-safe.sh

3. Rebuild or refresh any historic-condition aggregates that depend on forward gains.
```

Do not refresh forward gains before OHLCV ingestion completes, because the most recent forward horizons would be stale or incomplete.

## Verification Queries

Check total derived coverage:

```sql
SELECT
  count(),
  count_distinct(symbol),
  min(ts),
  max(ts)
FROM equity_forward_returns_daily
WHERE provider = 'yfinance';
```

Check recent null counts by horizon:

```sql
SELECT
  count() AS rows,
  sum(CASE WHEN forward_1day_percentage_change IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_1day,
  sum(CASE WHEN forward_2day_percentage_change IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_2day,
  sum(CASE WHEN forward_5day_percentage_change IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_5day,
  sum(CASE WHEN forward_2week_percentage_change IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_2week,
  sum(CASE WHEN forward_1month_percentage_change IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_1month
FROM equity_forward_returns_daily
WHERE provider = 'yfinance'
  AND ts >= dateadd('d', -90, now());
```

Spot-check one symbol:

```sql
SELECT
  d.ts,
  d.symbol,
  d.adj_close,
  d.close,
  f.base_price,
  f.forward_1day_percentage_change,
  f.forward_5day_percentage_change,
  f.forward_1month_percentage_change,
  f.calculated_at
FROM equity_ohlcv_daily d
LEFT JOIN equity_forward_returns_daily f
  ON d.ts = f.ts
 AND d.symbol = f.symbol
 AND d.provider = f.provider
WHERE d.symbol = 'AAPL'
  AND d.provider = 'yfinance'
ORDER BY d.ts DESC
LIMIT 40;
```

Expected behavior:

- The latest row usually has null forward returns because future rows do not exist yet.
- The row one trading day before the latest row should usually have `forward_1day_percentage_change`.
- The row five trading days before the latest row should usually have `forward_5day_percentage_change`.
- The row twenty-one trading days before the latest row should usually have `forward_1month_percentage_change`.

## Historic Conditions Integration

Once `equity_forward_returns_daily` exists, historic condition queries should use it as the reusable outcome table.

Example condition query:

```sql
SELECT
  d.ts,
  d.symbol,
  d.provider,
  d.close,
  f.forward_1day_percentage_change,
  f.forward_5day_percentage_change,
  f.forward_1month_percentage_change
FROM equity_ohlcv_daily d
JOIN equity_forward_returns_daily f
  ON d.ts = f.ts
 AND d.symbol = f.symbol
 AND d.provider = f.provider
WHERE d.provider = 'yfinance'
  AND d.symbol = 'AAPL'
  AND d.close > d.open
  AND d.volume > 10000000
  AND f.forward_5day_percentage_change IS NOT NULL
ORDER BY d.ts ASC;
```

Later, derived condition tables can store reusable aggregate results:

```text
equity_historic_condition_results
equity_historic_condition_runs
```

But the first implementation should keep condition evaluation query-driven and focus on getting forward gains correct, refreshed, and easy to join.

## Alternative: Physical Columns on Source Table

If physical columns on `equity_ohlcv_daily` are still required, use this as a secondary design:

```sql
ALTER TABLE equity_ohlcv_daily
  ADD COLUMN forward_1day_percentage_change DOUBLE;

ALTER TABLE equity_ohlcv_daily
  ADD COLUMN forward_2day_percentage_change DOUBLE;

ALTER TABLE equity_ohlcv_daily
  ADD COLUMN forward_5day_percentage_change DOUBLE;

ALTER TABLE equity_ohlcv_daily
  ADD COLUMN forward_2week_percentage_change DOUBLE;

ALTER TABLE equity_ohlcv_daily
  ADD COLUMN forward_1month_percentage_change DOUBLE;
```

Then run an update from a calculated subquery if the deployed QuestDB version supports the required `UPDATE ... FROM` syntax.

This approach is less preferred because:

- It mixes raw vendor data with derived analytics.
- It makes historical rebuilds more invasive.
- It requires updates to the source table after every EOD run.
- It can make corrections and debugging harder.

Use the derived-table design unless there is a strong UI or query constraint that requires physical source-table columns.

## Implementation Checklist

- Create repository module for forward returns in `services/market-api/app/repositories/`.
- Add `ensure_equity_forward_returns_daily_table`.
- Add full refresh SQL.
- Add incremental refresh SQL with a default 70-day lookback.
- Add `services/market-api/app/jobs/refresh_forward_returns.py`.
- Add `batch-jobs/forward-returns/refresh-forward-returns-safe.sh`.
- Run one full backfill after deployment.
- Wire daily refresh after the existing OHLCV EOD job.
- Add verification logs and run summaries.
- Add tests for SQL generation or repository behavior where practical.
