# Feature: Stock Seasonality

## Goal

Add stock seasonality analytics for a given symbol using the existing QuestDB daily OHLCV table.

The first version should answer questions like:

- In January, across all available AMD history, what percentage of trading days closed up or down?
- On the 5th trading day of January, how often has AMD been up?
- How often has AMD finished January positive as a whole month?

Example month-level result:

```json
{
  "symbol": "AMD",
  "provider": "yfinance",
  "month_code": "JAN",
  "percent_up_days": 44.47,
  "percent_down_days": 53.76,
  "percent_flat_days": 1.77,
  "sample_days": 958
}
```

## Key Design Decision

Use the existing QuestDB table as the source price table:

```text
equity_ohlcv_daily
```

Do not create a new `daily_prices` table for this feature.

The new derived tables should also live in QuestDB, not Postgres:

```text
equity_ohlcv_daily
    -> equity_daily_returns
    -> equity_month_seasonality
    -> equity_month_trading_day_seasonality
    -> equity_month_outcome_seasonality
```

Reason:

- `equity_ohlcv_daily` already owns daily market bars.
- Seasonality is derived market/time-series analytics data.
- QuestDB is the right storage layer for time-series calculations and chart-friendly reads.
- Postgres should remain focused on app metadata such as users, watchlists, saved queries, preferences, and auth-related records.

## Source Table

Existing QuestDB table:

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

Sample row:

```json
{
  "ts": "2025-01-03T00:00:00Z",
  "symbol": "AMD",
  "provider": "yfinance",
  "provider_symbol": "AMD",
  "open": 125.1,
  "high": 127.35,
  "low": 123.8,
  "close": 125.37,
  "adj_close": 125.37,
  "volume": 45230100,
  "currency": "USD",
  "ingested_at": "2026-06-10T21:05:22Z"
}
```

Important notes:

- Use `adj_close` for return calculations when available.
- If `adj_close` is missing, fall back to `close` only as a defensive fallback.
- Keep `provider` in every derived table so data from different vendors does not mix accidentally.
- `ts` is the trading date at daily granularity.

## Derived Table: `equity_daily_returns`

One row per symbol, provider, and trading day where a previous adjusted close exists.

This table converts raw daily OHLCV bars into reusable daily return rows.

Recommended QuestDB schema:

```sql
CREATE TABLE IF NOT EXISTS equity_daily_returns (
  ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,

  trade_year INT,
  month_num INT,
  month_code SYMBOL CAPACITY 3,

  trading_day_of_month INT,
  trading_day_of_year INT,

  close_price DOUBLE,
  adj_close_price DOUBLE,
  previous_adj_close_price DOUBLE,

  return_pct DOUBLE,
  direction SYMBOL CAPACITY 8,

  source_ingested_at TIMESTAMP,
  calculated_at TIMESTAMP
) TIMESTAMP(ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(ts, symbol, provider)
```

Field explanation:

- `ts`: trading date.
- `symbol`: canonical app symbol, for example `AMD`.
- `provider`: data provider, for example `yfinance`.
- `trade_year`: calendar year of `ts`.
- `month_num`: calendar month number, `1` through `12`.
- `month_code`: month abbreviation such as `JAN`, `FEB`, or `DEC`.
- `trading_day_of_month`: ordinal trading day inside that symbol/provider/month.
- `trading_day_of_year`: ordinal trading day inside that symbol/provider/year.
- `close_price`: raw close from `equity_ohlcv_daily`.
- `adj_close_price`: adjusted close used for return calculation.
- `previous_adj_close_price`: previous trading day's adjusted close for the same symbol/provider.
- `return_pct`: close-to-close percentage return, where `1.25` means `+1.25%`.
- `direction`: `UP`, `DOWN`, or `FLAT`.
- `source_ingested_at`: source bar's `ingested_at`, useful for debugging stale derived rows.
- `calculated_at`: timestamp when the derived row was calculated.

Sample row:

```json
{
  "ts": "2025-01-03T00:00:00Z",
  "symbol": "AMD",
  "provider": "yfinance",
  "trade_year": 2025,
  "month_num": 1,
  "month_code": "JAN",
  "trading_day_of_month": 2,
  "trading_day_of_year": 2,
  "close_price": 125.37,
  "adj_close_price": 125.37,
  "previous_adj_close_price": 124.62,
  "return_pct": 0.6,
  "direction": "UP",
  "source_ingested_at": "2026-06-10T21:05:22Z",
  "calculated_at": "2026-06-10T21:08:00Z"
}
```

Return formula:

```text
return_pct = ((adj_close_price / previous_adj_close_price) - 1) * 100
```

Direction rules:

```text
UP    when return_pct > 0
DOWN  when return_pct < 0
FLAT  when return_pct = 0
```

The first available bar for a symbol/provider should not produce a return row because there is no previous adjusted close.

## Cache Table: `equity_month_seasonality`

One row per symbol, provider, month, lookback window, and `as_of_ts`.

This is the main month-level daily seasonality cache. It answers:

```text
Across all January trading days, how often was AMD up or down?
```

Recommended QuestDB schema:

```sql
CREATE TABLE IF NOT EXISTS equity_month_seasonality (
  as_of_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,

  month_num INT,
  month_code SYMBOL CAPACITY 3,

  lookback_years SYMBOL CAPACITY 16,
  start_year INT,
  end_year INT,

  sample_years INT,
  sample_days LONG,

  up_days LONG,
  down_days LONG,
  flat_days LONG,

  percent_up_days DOUBLE,
  percent_down_days DOUBLE,
  percent_flat_days DOUBLE,

  avg_return_pct DOUBLE,
  median_return_pct DOUBLE,
  avg_up_day_return_pct DOUBLE,
  avg_down_day_return_pct DOUBLE,

  best_daily_return_pct DOUBLE,
  worst_daily_return_pct DOUBLE,
  stddev_return_pct DOUBLE,

  calculated_at TIMESTAMP
) TIMESTAMP(as_of_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(as_of_ts, symbol, provider, month_num, lookback_years)
```

Field explanation:

- `as_of_ts`: latest source trading date included in this calculation.
- `symbol`: canonical app symbol.
- `provider`: source provider.
- `month_num`: month number being summarized.
- `month_code`: month abbreviation being summarized.
- `lookback_years`: calculation window, for example `ALL`, `20Y`, `10Y`, or `5Y`.
- `start_year`: first year included.
- `end_year`: last year included.
- `sample_years`: number of distinct years represented.
- `sample_days`: total daily return rows included.
- `up_days`, `down_days`, `flat_days`: daily direction counts.
- `percent_up_days`, `percent_down_days`, `percent_flat_days`: percentages over `sample_days`.
- `avg_return_pct`: average daily return in that month across all included years.
- `median_return_pct`: median daily return.
- `avg_up_day_return_pct`: average return among up days only.
- `avg_down_day_return_pct`: average return among down days only.
- `best_daily_return_pct`: best single daily return in the sample.
- `worst_daily_return_pct`: worst single daily return in the sample.
- `stddev_return_pct`: standard deviation of daily returns.
- `calculated_at`: timestamp when the cache row was generated.

Sample row:

```json
{
  "as_of_ts": "2026-06-10T00:00:00Z",
  "symbol": "AMD",
  "provider": "yfinance",
  "month_num": 1,
  "month_code": "JAN",
  "lookback_years": "ALL",
  "start_year": 1980,
  "end_year": 2025,
  "sample_years": 46,
  "sample_days": 958,
  "up_days": 426,
  "down_days": 515,
  "flat_days": 17,
  "percent_up_days": 44.47,
  "percent_down_days": 53.76,
  "percent_flat_days": 1.77,
  "avg_return_pct": -0.06,
  "median_return_pct": -0.04,
  "avg_up_day_return_pct": 1.82,
  "avg_down_day_return_pct": -1.64,
  "best_daily_return_pct": 12.34,
  "worst_daily_return_pct": -9.87,
  "stddev_return_pct": 2.41,
  "calculated_at": "2026-06-10T21:08:30Z"
}
```

## Cache Table: `equity_month_trading_day_seasonality`

One row per symbol, provider, month, trading day of month, lookback window, and `as_of_ts`.

This table answers:

```text
Across all years, how does AMD behave on the 5th trading day of January?
```

Recommended QuestDB schema:

```sql
CREATE TABLE IF NOT EXISTS equity_month_trading_day_seasonality (
  as_of_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,

  month_num INT,
  month_code SYMBOL CAPACITY 3,
  trading_day_of_month INT,

  lookback_years SYMBOL CAPACITY 16,
  start_year INT,
  end_year INT,

  sample_observations LONG,

  up_days LONG,
  down_days LONG,
  flat_days LONG,

  percent_up_days DOUBLE,
  percent_down_days DOUBLE,
  percent_flat_days DOUBLE,

  avg_return_pct DOUBLE,
  median_return_pct DOUBLE,
  avg_up_day_return_pct DOUBLE,
  avg_down_day_return_pct DOUBLE,

  best_return_pct DOUBLE,
  worst_return_pct DOUBLE,
  stddev_return_pct DOUBLE,

  calculated_at TIMESTAMP
) TIMESTAMP(as_of_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(as_of_ts, symbol, provider, month_num, trading_day_of_month, lookback_years)
```

Field explanation:

- `trading_day_of_month`: ordinal trading day, not calendar day.
- `sample_observations`: number of historical observations for that trading-day slot.
- The count, percentage, average, median, best, worst, and standard deviation fields match the month-level cache, but are scoped to one trading-day slot.

Sample row:

```json
{
  "as_of_ts": "2026-06-10T00:00:00Z",
  "symbol": "AMD",
  "provider": "yfinance",
  "month_num": 1,
  "month_code": "JAN",
  "trading_day_of_month": 5,
  "lookback_years": "ALL",
  "start_year": 1980,
  "end_year": 2025,
  "sample_observations": 46,
  "up_days": 28,
  "down_days": 17,
  "flat_days": 1,
  "percent_up_days": 60.87,
  "percent_down_days": 36.96,
  "percent_flat_days": 2.17,
  "avg_return_pct": 0.42,
  "median_return_pct": 0.31,
  "avg_up_day_return_pct": 1.74,
  "avg_down_day_return_pct": -1.21,
  "best_return_pct": 7.82,
  "worst_return_pct": -5.46,
  "stddev_return_pct": 2.08,
  "calculated_at": "2026-06-10T21:08:30Z"
}
```

This table is useful for charts with trading day `1` through roughly `23` on the x-axis.

## Cache Table: `equity_month_outcome_seasonality`

One row per symbol, provider, month, lookback window, and `as_of_ts`.

This table is different from daily seasonality. It answers:

```text
How often does AMD finish January positive?
What is AMD's average January return?
```

Recommended QuestDB schema:

```sql
CREATE TABLE IF NOT EXISTS equity_month_outcome_seasonality (
  as_of_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,

  month_num INT,
  month_code SYMBOL CAPACITY 3,

  lookback_years SYMBOL CAPACITY 16,
  start_year INT,
  end_year INT,

  sample_months LONG,

  positive_months LONG,
  negative_months LONG,
  flat_months LONG,

  percent_positive_months DOUBLE,
  percent_negative_months DOUBLE,
  percent_flat_months DOUBLE,

  avg_month_return_pct DOUBLE,
  median_month_return_pct DOUBLE,
  avg_positive_month_return_pct DOUBLE,
  avg_negative_month_return_pct DOUBLE,

  best_month_return_pct DOUBLE,
  worst_month_return_pct DOUBLE,
  stddev_month_return_pct DOUBLE,

  calculated_at TIMESTAMP
) TIMESTAMP(as_of_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(as_of_ts, symbol, provider, month_num, lookback_years)
```

Field explanation:

- `sample_months`: number of historical month outcomes included.
- `positive_months`, `negative_months`, `flat_months`: count of month-level outcomes.
- `percent_positive_months`, `percent_negative_months`, `percent_flat_months`: percentages over `sample_months`.
- `avg_month_return_pct`: average full-month return.
- `median_month_return_pct`: median full-month return.
- `avg_positive_month_return_pct`: average return among positive months only.
- `avg_negative_month_return_pct`: average return among negative months only.
- `best_month_return_pct`: best historical return for that calendar month.
- `worst_month_return_pct`: worst historical return for that calendar month.
- `stddev_month_return_pct`: standard deviation of full-month returns.

Sample row:

```json
{
  "as_of_ts": "2026-06-10T00:00:00Z",
  "symbol": "AMD",
  "provider": "yfinance",
  "month_num": 1,
  "month_code": "JAN",
  "lookback_years": "ALL",
  "start_year": 1980,
  "end_year": 2025,
  "sample_months": 46,
  "positive_months": 20,
  "negative_months": 25,
  "flat_months": 1,
  "percent_positive_months": 43.48,
  "percent_negative_months": 54.35,
  "percent_flat_months": 2.17,
  "avg_month_return_pct": -1.35,
  "median_month_return_pct": -0.82,
  "avg_positive_month_return_pct": 9.62,
  "avg_negative_month_return_pct": -8.74,
  "best_month_return_pct": 28.41,
  "worst_month_return_pct": -24.12,
  "stddev_month_return_pct": 11.38,
  "calculated_at": "2026-06-10T21:08:30Z"
}
```

Month outcome calculation:

```text
month_return_pct = ((last_adj_close_in_month / previous_trading_day_adj_close_before_month) - 1) * 100
```

This includes the first trading day's close-to-close move from the prior month. If the previous trading day's adjusted close is unavailable, skip that month outcome.

## Calculation Semantics

Use these conventions consistently:

- Percent values are stored as `0` to `100` values, not ratios.
- `1.25` means `+1.25%`.
- Direction counts include `FLAT` separately.
- `percent_up_days + percent_down_days + percent_flat_days` should equal roughly `100`, allowing for rounding.
- Month grouping uses the trading date `ts`, not ingestion time.
- Trading day of month is based on actual trading sessions, not calendar day.
- The source return price is `coalesce(adj_close, close)`.
- Do not round values before storing them. Round only in API/UI presentation when needed.

## Lookback Windows

The schema supports multiple lookback windows:

```text
ALL
20Y
10Y
5Y
```

MVP can calculate only `ALL` first. The table design keeps room for later shorter windows without changing the API shape.

## MVP Decisions

Decided MVP behavior:

- Calculate and expose only `ALL` lookback first.
- Add `20Y`, `10Y`, and `5Y` later without changing the table design.
- Store flat-day and flat-month counts in QuestDB for correctness, but do not show flat values in the primary UI.
- Return all twelve months for a symbol/provider/lookback in one endpoint response so the UI can support heatmaps, month grids, and calendar-style summaries.
- Add the protected app route at `/seasonality`.
- Treat seasonality generation as a batch/cache build. The UI should read prepared QuestDB cache rows, not calculate seasonality synchronously from raw OHLCV data on page load.

## Route And UI Entry

The web route should be:

```text
/seasonality
```

Suggested files:

```text
app/(app)/seasonality/page.tsx
components/seasonality/seasonality-page.tsx
```

The page should be protected by the existing app auth boundary, like the other internal research tools.

The first UI can stay simple:

- Symbol input, defaulting to a familiar symbol such as `AMD`.
- Provider fixed to `yfinance` for MVP unless the existing data selector already supports providers.
- Lookback fixed to `ALL`.
- Month grid or table showing all twelve months.
- Primary values focused on up/down percentages and average returns.
- No primary flat-day display.

If cache data is missing for a requested symbol, the UI should show a clear "seasonality data not built yet" state rather than triggering a heavy rebuild in the request path.

## Batch Build Model

Yes, this feature should provide a batch script for the first-time seasonality build.

The intended usage is:

```text
Run OHLCV backfill/EOD first
  -> run seasonality batch build
  -> users open /seasonality after cache tables are ready
```

The route should be a fast cache reader. It should not perform full historical calculations during a user request.

Recommended implementation files:

```text
services/market-api/app/jobs/rebuild_stock_seasonality.py
batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh
```

The Python job should own the QuestDB calculations:

```text
services/market-api/app/jobs/rebuild_stock_seasonality.py
  -> ensure derived/cache tables exist
  -> resolve symbols to rebuild
  -> rebuild equity_daily_returns
  -> rebuild equity_month_seasonality
  -> rebuild equity_month_trading_day_seasonality
  -> rebuild equity_month_outcome_seasonality
  -> verify expected cache rows
```

The shell wrapper should follow the existing safe batch-job pattern used by the OHLCV backfill/EOD jobs:

```text
batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh
  -> start/check Docker Compose services
  -> wait for market-api and QuestDB health
  -> create timestamped logs
  -> invoke the Python rebuild job inside market-api
  -> run post-build verification queries
  -> exit nonzero on hard failures
```

Example operator commands:

```bash
bash batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh \
  --symbol AMD \
  --provider yfinance
```

```bash
bash batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh \
  --all-symbols \
  --provider yfinance
```

Suggested Python CLI options:

```text
--symbol SYMBOL
--symbols-file PATH
--all-symbols
--provider yfinance
--lookback-years ALL
--start-date YYYY-MM-DD
--end-date YYYY-MM-DD
--rebuild-returns
--rebuild-caches
--verify
```

For MVP, `--lookback-years ALL` is the only supported lookback. The option still makes the CLI shape ready for `20Y`, `10Y`, and `5Y` later.

The job should be idempotent. Re-running it for the same symbol/provider/lookback should replace or upsert the same logical cache rows using the QuestDB dedup keys.

## Refresh Model

This feature should integrate with the existing `equity_ohlcv_daily` backfill and EOD refresh jobs.

MVP refresh flow:

```text
Existing OHLCV backfill/EOD refresh updates equity_ohlcv_daily
  -> seasonality batch rebuilds equity_daily_returns for affected symbols/providers
  -> seasonality batch rebuilds cache rows for affected symbols/providers
```

For the first version, it is acceptable to rebuild seasonality for the full covered symbol/provider after new daily data arrives. The derived table sizes are small relative to raw intraday data, and correctness is more important than optimizing prematurely.

This design does not add separate sync-run metadata tables. If operational tracking becomes necessary later, it can be added around the existing EOD job framework.

## API Shape

The app-facing API should be served by the Python market service through QuestDB reads, then exposed to Next.js through the existing tRPC boundary.

The MVP endpoint should return all twelve months for one symbol/provider/lookback. The example below is abbreviated to two months, but the real response should include `JAN` through `DEC`.

Suggested route/API flow:

```text
Browser /seasonality
  -> tRPC marketData.getSeasonality
  -> FastAPI GET /seasonality/{symbol}?provider=yfinance&lookback_years=ALL
  -> QuestDB cache-table reads
  -> JSON response
```

```json
{
  "symbol": "AMD",
  "provider": "yfinance",
  "lookback_years": "ALL",
  "as_of_ts": "2026-06-10T00:00:00Z",
  "months": [
    {
      "month_num": 1,
      "month_code": "JAN",
      "monthly_daily_seasonality": {
        "sample_years": 46,
        "sample_days": 958,
        "percent_up_days": 44.47,
        "percent_down_days": 53.76,
        "avg_return_pct": -0.06,
        "median_return_pct": -0.04,
        "stddev_return_pct": 2.41
      },
      "trading_day_seasonality": [
        {
          "trading_day_of_month": 1,
          "sample_observations": 46,
          "percent_up_days": 52.17,
          "percent_down_days": 45.65,
          "avg_return_pct": 0.18
        },
        {
          "trading_day_of_month": 2,
          "sample_observations": 46,
          "percent_up_days": 47.83,
          "percent_down_days": 52.17,
          "avg_return_pct": -0.11
        }
      ],
      "monthly_outcome_seasonality": {
        "sample_months": 46,
        "percent_positive_months": 43.48,
        "percent_negative_months": 54.35,
        "avg_month_return_pct": -1.35,
        "median_month_return_pct": -0.82,
        "stddev_month_return_pct": 11.38
      }
    },
    {
      "month_num": 2,
      "month_code": "FEB",
      "monthly_daily_seasonality": {
        "sample_years": 46,
        "sample_days": 892,
        "percent_up_days": 51.12,
        "percent_down_days": 47.98,
        "avg_return_pct": 0.04,
        "median_return_pct": 0.02,
        "stddev_return_pct": 2.28
      },
      "trading_day_seasonality": [
        {
          "trading_day_of_month": 1,
          "sample_observations": 46,
          "percent_up_days": 54.35,
          "percent_down_days": 45.65,
          "avg_return_pct": 0.22
        }
      ],
      "monthly_outcome_seasonality": {
        "sample_months": 46,
        "percent_positive_months": 50,
        "percent_negative_months": 47.83,
        "avg_month_return_pct": 0.41,
        "median_month_return_pct": 0.19,
        "stddev_month_return_pct": 10.76
      }
    }
  ]
}
```

Flat values are stored in QuestDB but intentionally omitted from the primary response shape for MVP UI use.

## MVP Scope

First implementation:

- Create QuestDB table definitions for the four derived/cache tables.
- Add Python repository functions to create and rebuild the seasonality tables.
- Calculate `equity_daily_returns` from `equity_ohlcv_daily`.
- Calculate `ALL` lookback seasonality for selected symbols.
- Add first-time rebuild batch job and safe shell wrapper.
- Add FastAPI endpoint for all twelve months for one symbol/provider/lookback.
- Add tRPC wrapper.
- Add `/seasonality` protected route.
- Add a simple UI panel backed by the prebuilt seasonality cache.

Not included in the first slice:

- New `daily_prices` table.
- New Postgres tables.
- New sync-run tracking tables.
- Intraday seasonality.
- Provider comparison.
- Strategy backtesting from seasonality signals.

## Useful Validation Queries

Check raw source coverage:

```sql
SELECT symbol, provider, min(ts), max(ts), count()
FROM equity_ohlcv_daily
WHERE symbol = 'AMD'
GROUP BY symbol, provider;
```

Check derived daily returns:

```sql
SELECT ts, symbol, provider, month_code, trading_day_of_month, return_pct, direction
FROM equity_daily_returns
WHERE symbol = 'AMD' AND provider = 'yfinance'
ORDER BY ts DESC
LIMIT 20;
```

Check January seasonality:

```sql
SELECT *
FROM equity_month_seasonality
WHERE symbol = 'AMD'
  AND provider = 'yfinance'
  AND month_code = 'JAN'
  AND lookback_years = 'ALL'
ORDER BY as_of_ts DESC
LIMIT 1;
```

Check trading-day seasonality chart rows:

```sql
SELECT trading_day_of_month, percent_up_days, percent_down_days, avg_return_pct, sample_observations
FROM equity_month_trading_day_seasonality
WHERE symbol = 'AMD'
  AND provider = 'yfinance'
  AND month_code = 'JAN'
  AND lookback_years = 'ALL'
ORDER BY as_of_ts DESC, trading_day_of_month ASC;
```

Check month outcome seasonality:

```sql
SELECT *
FROM equity_month_outcome_seasonality
WHERE symbol = 'AMD'
  AND provider = 'yfinance'
  AND month_code = 'JAN'
  AND lookback_years = 'ALL'
ORDER BY as_of_ts DESC
LIMIT 1;
```

## Open Questions

- Should seasonality cache tables keep historical `as_of_ts` snapshots, or should the job periodically prune older snapshots and keep only latest values?
