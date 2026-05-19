# Features Add-On

## Simple Charting And Mock OHLCV Data

Implemented points 3 and 4 from `DESIGN/DESIGN2-revised.md`:

```text
3. Add simple charting with TradingView Lightweight Charts.
4. Use mock/static OHLCV data first.
```

## What Was Added

- Mock/static OHLCV data provider:
  - `lib/mock-ohlcv.ts`

- Market data tRPC router:
  - `server/api/routers/market-data.ts`

- TradingView Lightweight Charts wrapper using the official standalone build:
  - `components/trading/lightweight-candlestick-chart.tsx`

- Chart panel on `/trading`:
  - `components/trading/market-chart-panel.tsx`

- Trading page integration:
  - `components/trading/trading-page.tsx`

## Current Behavior

The chart uses symbols from the current DB-backed `symbols` CRUD when available.

If no symbols exist yet, the chart falls back to mock symbols:

```text
AAPL
MSFT
SPY
```

The price bars are currently static mock OHLCV bars generated inside the Next.js app layer.

No database schema changes were needed for this feature.

## Architecture Note

Market data is exposed through a small tRPC boundary:

```text
api.marketData.bars
```

Even though this endpoint currently returns mock data, the boundary is intentional. Later, when FastAPI and QuestDB are added, this route can call the dedicated market data service instead of generating static bars locally.

Current flow:

```text
Trading page
  -> market chart panel
    -> api.marketData.bars
      -> mock OHLCV provider
```

Future flow:

```text
Trading page
  -> market chart panel
    -> api.marketData.bars
      -> FastAPI market data service
        -> QuestDB
```

## Verification

The implementation passed:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next lint
```

The dev server could not be fully started because of the existing local Next SWC native binary code-signature issue. The server selected `http://localhost:3001`, then failed while loading `@next/swc-darwin-arm64`.

## References

- TradingView Lightweight Charts: https://www.tradingview.com/lightweight-charts/
- Lightweight Charts getting started: https://tradingview.github.io/lightweight-charts/docs/5.0

## FastAPI, QuestDB, Ingestion, And Backtesting

Implemented points 5, 6, and 7 from `DESIGN/DESIGN2-revised.md`:

```text
5. Add FastAPI as a separate service once the product shape is clear.
6. Add QuestDB behind FastAPI.
7. Add ingestion and backtesting.
```

## What Was Added

Added a separate FastAPI market service:

```text
services/market-api
```

The service currently supports:

- QuestDB connection through PostgreSQL Wire Protocol.
- `market_bars` table creation.
- Mock OHLCV ingestion into QuestDB.
- OHLCV reads from QuestDB.
- Simple SMA crossover backtest endpoint.

## Docker And Infrastructure Updates

Updated local Compose infrastructure:

- QuestDB added to `scripts/docker-compose.yml`.
- FastAPI `market-api` service added to `scripts/docker-compose.yml`.
- New script added: `pnpm run market-api:start`.
- `.env.example` now includes `MARKET_API_BASE_URL` and QuestDB settings.
- `README.md` now includes QuestDB and FastAPI startup notes.

QuestDB local endpoints:

```text
http://localhost:9000
postgresql://admin:quest@localhost:8812/qdb
```

FastAPI docs:

```text
http://127.0.0.1:8000/docs
```

## Next.js Integration

The existing Next.js market-data tRPC router now calls FastAPI first and falls back to local mock data if the service is unavailable:

```text
server/api/routers/market-data.ts
```

The trading chart panel now includes:

- Ingest mock bars.
- Run SMA backtest.
- Backtest result metrics.

Updated UI file:

```text
components/trading/market-chart-panel.tsx
```

## Current Flow

```text
Trading page
  -> market chart panel
    -> api.marketData.bars
      -> FastAPI market-api
        -> QuestDB
```

Mock ingestion flow:

```text
Trading page
  -> Ingest mock bars
    -> api.marketData.ingestMock
      -> FastAPI /market-data/ingest/mock
        -> QuestDB market_bars
```

Backtest flow:

```text
Trading page
  -> Run SMA backtest
    -> api.marketData.runBacktest
      -> FastAPI /backtests/run
        -> QuestDB market_bars
```

## Verification

The implementation passed:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next lint
PYTHONPYCACHEPREFIX=/private/tmp/showmeedge-pycache python3 -m compileall services/market-api/app
docker compose -f scripts/docker-compose.yml config
docker compose -f scripts/docker-compose.yml up -d questdb market-api
```

Endpoint verification passed:

```text
GET  http://127.0.0.1:8000/health
GET  http://127.0.0.1:8000/questdb/health
POST http://127.0.0.1:8000/market-data/ingest/mock
GET  http://127.0.0.1:8000/market-data/bars?symbol=AAPL&timeframe=1d
POST http://127.0.0.1:8000/backtests/run
```

QuestDB and `market-api` were verified running locally.

Stop local services with:

```bash
pnpm run db:stop
```

## References

- QuestDB Docker docs: https://questdb.com/docs/get-started/docker
- QuestDB Python PGWire docs: https://questdb.com/docs/pgwire/python/
- FastAPI Docker docs: https://fastapi.tiangolo.com/deployment/docker/
