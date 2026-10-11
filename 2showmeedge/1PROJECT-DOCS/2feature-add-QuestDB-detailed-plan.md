# Feature Plan: Add Daily Stock Price Data To QuestDB

Date: 2026-06-02

## Goal

Add daily stock price data to ShowMeEdge by ingesting historical OHLCV bars into QuestDB, exposing the data through the existing FastAPI market service, and displaying it in the web UI through the existing Next.js/tRPC chart path.

The MVP should support:

- Daily OHLCV bars for current S&P 500 symbols.
- Historical backfill starting from `2010-01-01`.
- Incremental daily updates after market close.
- QuestDB as the time-series store.
- FastAPI as the read/API surface.
- A separate ingestion worker or CLI process that uses the same `services/market-api` codebase.

## Main Decision

Use FastAPI for market-data APIs, but do not run ingestion as an in-process FastAPI background task.

Preferred shape:

```text
Next.js UI
  -> tRPC marketData router
    -> FastAPI /market-data/bars
      -> QuestDB

Scheduled worker / CLI job
  -> market-data provider adapter
    -> normalize and validate bars
      -> QuestDB ingest
      -> Postgres job and coverage metadata
```

This keeps the API responsive and keeps ingestion retries, backfills, provider failures, and observability out of request handling.

## Critical Notes

### yfinance Is MVP-Only

`yfinance` is acceptable for development and MVP validation, but it should not be treated as the long-term production provider.

Reasons:

- It is not officially affiliated with Yahoo.
- Yahoo Finance data/API usage has personal-use constraints.
- Reliability, rate limits, adjusted price behavior, and symbol mapping may change.
- It may be unsuitable for commercial production without a separate data license.

Design implication:

```text
Do not bake yfinance directly into route handlers or QuestDB code.
Create a provider interface and make yfinance only the first provider implementation.
```

### Current S&P 500 Backfill Has Survivorship Bias

Fetching today's S&P 500 symbols back to `2010-01-01` is fine for charting current companies, but it is not correct for serious index backtesting.

Problem:

- The current S&P 500 list excludes companies that were removed, merged, acquired, or failed.
- Strategies tested only against surviving companies can look better than they really are.

MVP decision:

- Start with current S&P 500 constituents for product/UI validation.
- Explicitly label this universe as `sp500_current`.
- Later add historical S&P 500 membership with effective dates for research-grade backtests.

### QuestDB Should Own Time-Series Data, Not App State

QuestDB should store market time-series:

- Daily bars.
- Future intraday bars.
- Ticks.
- Quotes.
- Indicator values.
- Signal timelines.
- Equity curves when large.

Postgres should remain the source for relational app state:

- Users and organizations.
- Symbols metadata.
- Watchlists.
- Portfolios.
- Strategies.
- Job status and ingestion coverage.
- Backtest run summaries.

## Existing Codebase Fit

The repo already has the right integration skeleton:

- FastAPI market service: `services/market-api/app/main.py`
- QuestDB access: `services/market-api/app/questdb.py`
- Next.js tRPC market-data router: `server/api/routers/market-data.ts`
- Trading chart panel: `components/trading/market-chart-panel.tsx`
- Local Compose stack with QuestDB and FastAPI: `scripts/docker-compose.yml`

The current implementation supports mock OHLCV ingestion and QuestDB reads. The real-data feature should evolve that foundation rather than replace it.

## Recommended QuestDB Schema

The current `market_bars` table is a good prototype, but for daily equity data the MVP should move toward a clearer daily table.

Recommended table:

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
PARTITION BY MONTH
WAL
DEDUP UPSERT KEYS(ts, symbol, provider);
```

Rationale:

- `ts` is the designated timestamp.
- `symbol` is the canonical app symbol, for example `BRK.B`.
- `provider_symbol` stores the provider-specific symbol, for example Yahoo's `BRK-B`.
- `provider` allows multiple data sources later.
- `adj_close` is important for backtesting and split/dividend-aware analysis.
- `PARTITION BY MONTH` is more appropriate than daily partitions for daily bars.
- `DEDUP UPSERT KEYS(ts, symbol, provider)` allows safe reloads and correction windows.
- `WAL` is preferred for modern QuestDB ingestion patterns.

Keep future intraday/tick data in separate tables. Do not force daily bars, minute bars, and ticks into one generic table too early.

Future tables:

```text
equity_ohlcv_1m
equity_ticks
equity_quotes
indicator_values
strategy_signals
backtest_equity_curve
```

## Provider Layer

Create a provider abstraction in the FastAPI service codebase.

Suggested files:

```text
services/market-api/app/providers/base.py
services/market-api/app/providers/yfinance_provider.py
services/market-api/app/providers/symbols.py
```

Provider interface:

```python
class DailyBarProvider(Protocol):
    provider_name: str

    def fetch_daily_bars(
        self,
        symbols: list[str],
        start: date,
        end: date | None,
    ) -> list[ProviderDailyBar]:
        ...
```

Normalized bar shape:

```python
class ProviderDailyBar(BaseModel):
    symbol: str
    provider_symbol: str
    ts: date
    open: float
    high: float
    low: float
    close: float
    adj_close: float | None
    volume: int
    currency: str = "USD"
```

Provider responsibilities:

- Convert app symbols to provider symbols.
- Fetch data.
- Return normalized daily bars.
- Surface provider errors clearly.

Provider should not:

- Know about QuestDB tables.
- Know about Next.js.
- Decide product-level universe rules.

## Symbol Universe

Start with `sp500_current`.

Options for MVP:

1. Use a checked-in CSV file of current S&P 500 symbols.
2. Seed Postgres `symbols` with current S&P 500 metadata.
3. Read symbols from Postgres when available, with CSV fallback for local development.

Recommended initial path:

```text
services/market-api/app/data/sp500_current.csv
```

Columns:

```text
symbol,provider_symbol,name,exchange,currency,sector,industry
```

Important symbol mapping examples:

```text
BRK.B -> BRK-B for Yahoo
BF.B  -> BF-B for Yahoo
```

Later, add a historical index-membership table:

```text
index_memberships
  index_code
  symbol
  provider_symbol
  effective_from
  effective_to
  source
```

## Ingestion Jobs

Add ingestion as separate CLI/job entrypoints inside `services/market-api`.

Suggested files:

```text
services/market-api/app/jobs/backfill_daily.py
services/market-api/app/jobs/ingest_daily.py
services/market-api/app/jobs/job_models.py
services/market-api/app/repositories/questdb_daily_bars.py
services/market-api/app/repositories/ingestion_metadata.py
```

### Historical Backfill

Command shape:

```bash
python -m app.jobs.backfill_daily --universe sp500_current --start 2010-01-01
```

Responsibilities:

- Load the selected universe.
- Fetch daily bars from provider.
- Normalize and validate rows.
- Write to QuestDB.
- Record job status and coverage metadata.
- Support retrying failed symbols.

Backfill should run in batches, not as one huge provider request.

Recommended batch behavior:

- Batch size: 25 to 100 symbols, depending on provider stability.
- Retry transient provider failures.
- Write each successful batch independently.
- Log failed symbols separately.
- Do not fail the entire universe because one symbol failed.

### Incremental Daily Update

Command shape:

```bash
python -m app.jobs.ingest_daily --universe sp500_current
```

Responsibilities:

- Run after market close.
- Find latest stored date for each symbol/provider.
- Fetch missing dates.
- Re-fetch a small correction window, such as the last 5 to 10 trading days.
- Upsert into QuestDB.
- Update coverage metadata.

Correction window matters because adjusted prices and corporate action data can change after splits, dividends, and vendor corrections.

### Scheduling

For local development:

```text
Manual CLI command is enough.
```

For production:

```text
Containerized scheduled job, cron, GitHub Actions, Render cron job, Fly machine, ECS scheduled task, or a worker queue.
```

Do not schedule the job inside Next.js or as a FastAPI startup task.

## QuestDB Ingestion Method

For the mock MVP, PGWire inserts are acceptable. For real S&P 500 backfills, prefer QuestDB's Python ILP client for bulk ingestion.

Recommended:

```text
Use ILP/Python client for writes.
Use PGWire/SQL for reads.
```

Reasons:

- Faster ingestion.
- Better fit for high-volume time-series writes.
- Cleaner separation between write-heavy jobs and query endpoints.

## FastAPI API Changes

Current endpoint:

```text
GET /market-data/bars?symbol=AAPL&timeframe=1d
```

Recommended MVP endpoint:

```text
GET /market-data/bars?symbol=AAPL&timeframe=1d&start=2010-01-01&end=2026-06-02&provider=yfinance
```

Response:

```json
{
  "symbol": "AAPL",
  "timeframe": "1d",
  "provider": "yfinance",
  "source": "questdb",
  "coverage": {
    "start": "2010-01-04",
    "end": "2026-06-01",
    "row_count": 3880
  },
  "bars": [
    {
      "time": "2026-06-01",
      "open": 0,
      "high": 0,
      "low": 0,
      "close": 0,
      "adj_close": 0,
      "volume": 0
    }
  ]
}
```

Also add admin/status endpoints:

```text
GET /market-data/coverage?symbol=AAPL&provider=yfinance
GET /market-data/universes
GET /market-data/universes/sp500_current/symbols
```

Optional admin trigger endpoint for local development only:

```text
POST /market-data/jobs/backfill
```

If added, it should enqueue or launch a worker job. It should not perform the whole backfill inside the HTTP request.

## Next.js/UI Changes

Keep the existing path:

```text
UI chart panel
  -> api.marketData.bars
    -> server/api/routers/market-data.ts
      -> FastAPI
        -> QuestDB
```

Changes:

- Add `start` and `end` inputs to the tRPC market-data schema.
- Add `provider` to the API request.
- Replace "Ingest mock bars" with a real data status/action flow.
- Remove silent mock fallback in production mode.
- Keep mock fallback only for local development, clearly labeled.

Recommended UI behavior:

- Symbol selector/search.
- Date range selector.
- Source badge, for example `questdb / yfinance`.
- Latest close and daily change.
- Data coverage indicator.
- Empty state when data has not been ingested.
- Admin-only button to trigger local/dev ingestion if useful.

Avoid a giant S&P 500 dropdown if the list grows. Use search/typeahead.

## Postgres Metadata

QuestDB stores bars, but Postgres should track job and coverage metadata.

Suggested tables:

```text
market_data_jobs
  id
  job_type
  provider
  universe
  status
  started_at
  completed_at
  requested_start
  requested_end
  symbols_total
  symbols_succeeded
  symbols_failed
  error_message
  metadata

market_data_coverage
  id
  symbol_id
  symbol
  provider
  timeframe
  first_bar_at
  last_bar_at
  row_count
  last_ingested_at
  last_job_id
  status
```

This allows the UI and admin views to answer:

- Has AAPL been ingested?
- What is the latest available date?
- Did the last job fail?
- Which symbols failed in the S&P 500 backfill?

## Data Quality Checks

Validate bars before writing to QuestDB.

Checks:

- Required OHLC fields are present.
- `high >= open`, `high >= close`, and `high >= low`.
- `low <= open`, `low <= close`, and `low <= high`.
- Volume is non-negative.
- Date is not in the future beyond expected market calendar behavior.
- Duplicate dates are handled by dedup/upsert.
- Provider returns enough bars for the requested period.
- Symbol mapping is correct.

Log and report:

- Missing data.
- Provider request failures.
- Suspicious rows.
- Symbols with no data.
- Symbols that changed ticker.

## Backtesting Price Choice

For chart display:

```text
Use raw OHLC and close.
```

For backtests:

```text
Prefer adjusted close or adjusted OHLC when available.
```

MVP can start with raw OHLC plus `adj_close`, but later backtesting should clearly define whether signals and fills use adjusted or raw prices.

Do not mix adjusted close with raw open/high/low without documenting the implications.

## MVP Implementation Checklist

### Phase 1: Schema And Repository

- Add `equity_ohlcv_daily` table creation in QuestDB setup.
- Add QuestDB repository methods:
  - `ensure_equity_ohlcv_daily_table`
  - `insert_daily_bars`
  - `fetch_daily_bars`
  - `fetch_daily_coverage`
- Keep old `market_bars` mock table temporarily if needed for compatibility.

### Phase 2: Provider Abstraction

- Add provider base models.
- Add `YFinanceProvider`.
- Add symbol mapping.
- Add `sp500_current.csv`.
- Add provider unit tests with mocked provider responses.

### Phase 3: Backfill CLI

- Add `python -m app.jobs.backfill_daily`.
- Add arguments:
  - `--universe`
  - `--symbols`
  - `--start`
  - `--end`
  - `--provider`
  - `--batch-size`
- Write batches to QuestDB.
- Print summary and failed symbols.

### Phase 4: Incremental CLI

- Add `python -m app.jobs.ingest_daily`.
- Fetch missing data per symbol.
- Re-fetch last 5 to 10 trading days.
- Upsert/dedup into QuestDB.

### Phase 5: API

- Extend `/market-data/bars`.
- Add coverage endpoint.
- Add universe symbols endpoint.
- Remove production silent mock fallback.

### Phase 6: UI

- Add symbol search or better selector.
- Add date range controls.
- Show provider/source/coverage.
- Handle "not ingested yet" state.

### Phase 7: Scheduling And Operations

- Add Docker Compose worker command or script entrypoint.
- Add production scheduling later.
- Add logs and job metadata.
- Add retry strategy.

## Suggested First Implementation Slice

The best first coding slice is:

1. Add the new QuestDB daily table and repository.
2. Add `YFinanceProvider`.
3. Add a CLI that backfills a tiny symbol list, for example `AAPL`, `MSFT`, and `SPY`.
4. Verify rows in QuestDB.
5. Update `/market-data/bars` to read from the new table.
6. Update the UI source label from mock/static to real QuestDB data.

Only after that works locally should we expand to all current S&P 500 symbols.

## Risks And Mitigations

Risk: yfinance instability or usage limitations.

Mitigation: isolate it behind provider interface; prepare to swap in Polygon, Tiingo, Nasdaq Data Link, Alpaca, Intrinio, or another licensed provider.

Risk: survivorship bias.

Mitigation: label MVP universe as `sp500_current`; add historical membership later.

Risk: duplicate or corrected bars.

Mitigation: use QuestDB dedup/upsert keys and a rolling correction window.

Risk: huge request timeouts.

Mitigation: never run backfill inside FastAPI request handling.

Risk: unclear adjusted price semantics.

Mitigation: store `adj_close` now and explicitly document chart vs backtest price usage.

Risk: silent bad data.

Mitigation: add validation, coverage metadata, and failed-symbol reporting from the beginning.

## MVP Recommendation

Proceed with:

```text
yfinance-backed worker
  + QuestDB ILP ingestion
  + FastAPI read endpoints
  + Postgres ingestion metadata
  + Next.js/tRPC chart display
```

This is fast enough for product progress, but structured enough to replace yfinance with a production provider later without rewriting the frontend or QuestDB read path.
