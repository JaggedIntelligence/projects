# QuestDB Stock Data Implementation Notes

Date: 2026-06-02

This document records the Phase 1 and Phase 2 coding work completed for adding daily stock price data to QuestDB.

## Scope Completed

Implemented the first two phases from `1PROJECT-DOCS/2feature-add-QuestDB-detailed-plan.md`:

- Phase 1: QuestDB daily OHLCV schema and repository methods.
- Phase 2: Provider abstraction, yfinance provider, and starter S&P 500 symbol universe.

The current UI and existing mock `market_bars` flow were intentionally left intact. The new code creates the foundation for real daily OHLCV ingestion without breaking the existing FastAPI and Next.js chart path.

## Phase 1: QuestDB Daily OHLCV Repository

### Added Daily Bar Models

File:

```text
services/market-api/app/models.py
```

Added:

- `DailyOhlcvBar`
- `MarketDataCoverage`

`DailyOhlcvBar` includes:

- Canonical app symbol.
- Provider name.
- Provider-specific symbol.
- Daily timestamp.
- Open, high, low, close.
- Adjusted close.
- Volume.
- Currency.
- Basic OHLC validation.

The model validates that:

- Price fields are positive.
- Volume is non-negative.
- `high` is greater than or equal to open, low, and close.
- `low` is less than or equal to open, high, and close.

### Added QuestDB Daily Table Repository

File:

```text
services/market-api/app/repositories/questdb_daily_bars.py
```

Added table creation SQL for:

```text
equity_ohlcv_daily
```

Schema shape:

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

Repository methods added:

- `ensure_equity_ohlcv_daily_table`
- `insert_daily_bars`
- `fetch_daily_bars`
- `fetch_daily_coverage`

Design choices:

- `ts` is the designated timestamp.
- Monthly partitions are used because this is daily data.
- WAL is enabled.
- Dedup/upsert keys are `(ts, symbol, provider)`.
- `provider_symbol` is stored separately from the canonical app symbol.
- `ingested_at` is populated on insert.

### Wired Table Creation Into FastAPI Startup

File:

```text
services/market-api/app/main.py
```

FastAPI startup now creates both:

- Existing mock/prototype `market_bars` table.
- New real-data `equity_ohlcv_daily` table.

This keeps backward compatibility while adding the real daily-bar storage path.

## Phase 2: Provider Abstraction And yfinance Provider

### Added Provider Package

Files:

```text
services/market-api/app/providers/__init__.py
services/market-api/app/providers/base.py
services/market-api/app/providers/symbols.py
services/market-api/app/providers/yfinance_provider.py
```

### Added Provider Protocol

File:

```text
services/market-api/app/providers/base.py
```

Added `DailyBarProvider` protocol with:

```text
fetch_daily_bars(symbols, start, end)
```

The point of this abstraction is to keep yfinance replaceable. Future providers such as Polygon, Tiingo, Alpaca, Intrinio, or Nasdaq Data Link can implement the same interface.

### Added Symbol Universe Loader

File:

```text
services/market-api/app/providers/symbols.py
```

Added:

- `SymbolMetadata`
- `load_symbol_universe`
- `load_symbol_map`
- `to_provider_symbol`
- `normalize_symbol`

The symbol loader reads CSV files from:

```text
services/market-api/app/data/
```

It supports both the app's preferred column names and common S&P 500 CSV column names such as:

- `Symbol`
- `Security`
- `GICS Sector`
- `GICS Sub-Industry`

Yahoo-specific ticker mapping is handled by:

```text
to_provider_symbol
```

Examples:

```text
BRK.B -> BRK-B
BF.B  -> BF-B
```

### Added Starter S&P 500 CSV

File:

```text
services/market-api/app/data/sp500_current.csv
```

Added a small starter current-S&P-500 seed list with representative symbols:

- `AAPL`
- `MSFT`
- `NVDA`
- `AMZN`
- `GOOGL`
- `GOOG`
- `META`
- `BRK.B`
- `BF.B`
- `JPM`
- `LLY`
- `AVGO`
- `XOM`
- `UNH`
- `V`

This is intentionally a starter seed for the first implementation slice, not the full current S&P 500 yet. The loader is now ready for a full refreshed CSV later.

### Added yfinance Provider

File:

```text
services/market-api/app/providers/yfinance_provider.py
```

Added `YFinanceProvider`.

Responsibilities:

- Normalize requested symbols.
- Map canonical symbols to Yahoo provider symbols.
- Fetch daily data through `yfinance.download`.
- Preserve `Adj Close`.
- Convert provider rows into `DailyOhlcvBar`.
- Skip incomplete rows.

The yfinance import is lazy. This means the service modules can still compile in a local environment before `yfinance` is installed.

### Updated Python Requirements

File:

```text
services/market-api/requirements.txt
```

Added:

```text
yfinance>=0.2,<1
```

`yfinance` remains MVP-only. It should stay isolated behind the provider interface so a production data vendor can replace it later.

## Tests And Verification

### Added Symbol Loader Tests

File:

```text
services/market-api/tests/test_symbols.py
```

Tests added:

- Loads seeded `sp500_current` symbols.
- Verifies Yahoo class-share symbol mapping:
  - `BRK.B -> BRK-B`
  - `bf.b -> BF-B`

### Verification Commands Run

From repo root:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/showmeedge-pycache python3 -m compileall services/market-api/app services/market-api/tests
```

Result:

```text
Passed
```

From `services/market-api`:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/showmeedge-pycache python3 -m unittest discover tests
```

Result:

```text
Ran 2 tests
OK
```

## Suggested First Implementation Slice Completed

The suggested first implementation slice has now been implemented.

### Added Backfill CLI

File:

```text
services/market-api/app/jobs/backfill_daily.py
```

Command:

```bash
python -m app.jobs.backfill_daily --symbols AAPL MSFT SPY --start 2010-01-01
```

Behavior:

- Defaults to `AAPL MSFT SPY` when neither `--symbols` nor `--universe` is provided.
- Supports `--symbols`.
- Supports `--universe`, loading from `services/market-api/app/data/<universe>.csv`.
- Supports `--start`, `--end`, `--provider`, and `--batch-size`.
- Fetches bars through `YFinanceProvider`.
- Inserts bars into `equity_ohlcv_daily`.
- Prints JSON progress events.
- Waits briefly for QuestDB coverage visibility before printing final coverage.

### Updated FastAPI Bars Endpoint

File:

```text
services/market-api/app/main.py
```

`GET /market-data/bars` now:

- Checks `equity_ohlcv_daily` first.
- Returns source `questdb_yfinance_daily` when yfinance daily bars exist.
- Falls back to the existing mock `market_bars` path when daily data is absent.
- Keeps the existing response shape compatible with the chart.

### Updated Next.js Market Data Router

File:

```text
server/api/routers/market-data.ts
```

The tRPC market-data router now passes:

```text
provider=yfinance
```

to FastAPI and accepts the optional `provider` field in the response.

### Updated Chart Source Label

File:

```text
components/trading/market-chart-panel.tsx
```

The chart now labels real backfilled data as:

```text
QuestDB / yfinance
```

instead of showing raw internal source names.

### Live QuestDB Verification

The local Docker Compose stack was rebuilt and restarted:

```bash
docker compose -f scripts/docker-compose.yml build market-api
docker compose -f scripts/docker-compose.yml up -d market-api
```

Backfill command run:

```bash
docker compose -f scripts/docker-compose.yml exec -T market-api python -m app.jobs.backfill_daily --batch-size 3
```

Result:

```text
Fetched and inserted 12,381 bars.
AAPL: 4,127 rows
MSFT: 4,127 rows
SPY: 4,127 rows
```

QuestDB verification:

```sql
select symbol, provider, count() from equity_ohlcv_daily;
```

Result:

```text
AAPL yfinance 4127
MSFT yfinance 4127
SPY  yfinance 4127
```

FastAPI verification inside the market-api container:

```text
GET /market-data/bars?symbol=AAPL&timeframe=1d&provider=yfinance&seed_if_empty=false
```

Result:

```text
source: questdb_yfinance_daily
provider: yfinance
bars: 4127
first bar: 2010-01-04
last bar: 2026-06-01
```

## Not Yet Implemented

The following items are intentionally deferred to the next coding slice:

- Full S&P 500 CSV refresh/import.
- Incremental daily ingestion CLI.
- UI changes for coverage and date range controls.
- Postgres ingestion job metadata.
- ILP ingestion path for high-volume writes.

## Recommended Next Coding Slice

Next implement the incremental daily ingestion job:

```bash
python -m app.jobs.ingest_daily --symbols AAPL MSFT SPY
```

The incremental job should:

- Read existing coverage from QuestDB.
- Fetch only missing dates plus a correction window.
- Upsert into `equity_ohlcv_daily`.
- Print inserted row count and failed symbols.
- Reuse the provider and repository code from the backfill CLI.

After that works locally, expand the CSV and job batching toward the full `sp500_current` universe.
