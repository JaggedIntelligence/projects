# Detailed Design Plan

## Recommended MVP Stack

The MVP stack should stay lean:

- Frontend: React, Vite, TypeScript, Clerk, TanStack Query, TradingView Lightweight Charts.
- API: FastAPI.
- Time-series database: QuestDB.
- App database: Postgres.
- Data processing: pandas and Polars.
- Backtesting: vectorbt first, custom engine later if needed.
- Local development: Docker Compose.

Redis, Dramatiq, and RQ are intentionally omitted from the MVP stack.

The important design choice is that even without Redis or separate job tooling, ingestion, backtesting, and trading should still be structured as separate workflows. In the MVP they can run as direct API calls or CLI commands. Later, they can move behind queues without rewriting the business logic.

## Recommended Repo Structure

```text
showmeedge/
  ARCH-BRAINSTORMING.md
  DESIGN-DETAILED.md
  README.md
  .env.example
  docker-compose.yml

  apps/
    web/
      package.json
      vite.config.ts
      index.html
      src/
        main.tsx
        app/
          App.tsx
          providers.tsx
          router.tsx
        components/
          layout/
          ui/
        features/
          auth/
          dashboard/
          watchlist/
          market-data/
          charts/
          strategies/
          backtests/
          portfolio/
          alerts/
        lib/
          api-client.ts
          env.ts
          query-client.ts
          routes.ts
        styles/
          globals.css

    api/
      pyproject.toml
      README.md
      alembic.ini
      app/
        main.py
        api/
          deps.py
          v1/
            router.py
            routes/
              health.py
              auth.py
              users.py
              watchlists.py
              market_data.py
              strategies.py
              backtests.py
              portfolio.py
        core/
          config.py
          security.py
          logging.py
          errors.py
        db/
          postgres.py
          questdb.py
          migrations/
        models/
          user.py
          watchlist.py
          strategy.py
          backtest.py
          portfolio.py
        schemas/
          user.py
          watchlist.py
          market_data.py
          strategy.py
          backtest.py
          portfolio.py
        repositories/
          users.py
          watchlists.py
          strategies.py
          backtests.py
          market_data.py
        services/
          auth_service.py
          market_data_service.py
          strategy_service.py
          backtest_service.py
          portfolio_service.py
        integrations/
          clerk/
            verifier.py
          market_data/
            base.py
            polygon.py
            alpaca.py
            yfinance_dev.py
          brokers/
            base.py
            paper.py
        research/
          indicators/
          strategies/
            base.py
            moving_average_cross.py
          backtesting/
            engine.py
            metrics.py
        workflows/
          ingest_ohlcv.py
          run_backtest.py
        tests/
          unit/
          integration/

  docs/
    architecture.md
    api.md
    data-model.md

  scripts/
    dev-api.sh
    dev-web.sh
    ingest-sample-data.sh
```

## Why This Structure

`apps/web` and `apps/api` keep frontend and backend cleanly separated. This is simpler than microservices, but still gives the codebase a strong boundary between client and server concerns.

`services/` contains business logic. API routes should stay thin.

`repositories/` contains database access. This prevents FastAPI route files from directly knowing too much about QuestDB or Postgres.

`integrations/` contains external systems such as Clerk, data providers, and brokers.

`research/` contains finance and backtesting logic. This is where Python's finance ecosystem should live.

`workflows/` contains executable flows such as "ingest OHLCV" or "run backtest." These can start as CLI-invoked scripts and later become queued workers if the architecture adds Redis, Kafka, Redpanda, or another job/stream layer.

## Frontend Installs

Create the React/Vite app:

```bash
npm create vite@latest apps/web -- --template react-ts
cd apps/web
npm install
```

Install application dependencies:

```bash
npm install @clerk/clerk-react @tanstack/react-query lightweight-charts react-router-dom zod
```

Install useful development dependencies:

```bash
npm install -D @tanstack/eslint-plugin-query prettier vitest @testing-library/react @testing-library/jest-dom
```

Optional but useful later:

```bash
npm install @tanstack/react-query-devtools
```

References:

- Vite: https://vite.dev/guide/
- Clerk React quickstart: https://clerk.com/docs/quickstarts/react
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/installation
- Lightweight Charts: https://www.tradingview.com/lightweight-charts/

## Backend Installs

Using `uv` is recommended for Python dependency management:

```bash
mkdir -p apps/api
cd apps/api
uv init
uv add "fastapi[standard]" pydantic-settings sqlalchemy alembic psycopg asyncpg
uv add questdb pandas polars numpy vectorbt
uv add python-dotenv httpx structlog
uv add --dev pytest pytest-asyncio ruff mypy
```

If using plain `pip` instead:

```bash
python -m venv .venv
source .venv/bin/activate
pip install "fastapi[standard]" pydantic-settings sqlalchemy alembic psycopg asyncpg
pip install questdb pandas polars numpy vectorbt python-dotenv httpx structlog
pip install pytest pytest-asyncio ruff mypy
```

References:

- FastAPI: https://fastapi.tiangolo.com/
- QuestDB Python client: https://questdb.com/docs/ingestion/clients/python/
- QuestDB Python PGWire: https://questdb.com/docs/query/pgwire/python/

## Local Docker Compose

For the MVP, Docker Compose should run only infrastructure:

- Postgres.
- QuestDB.

Do not include Redis or separate worker services yet.

The local development flow should be:

```bash
docker compose up -d
cd apps/api && uv run fastapi dev app/main.py
cd apps/web && npm run dev
```

## Environment Variables

Root `.env.example`:

```bash
# Web
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=

# API
APP_ENV=local
API_CORS_ORIGINS=http://localhost:5173
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER=

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=showmeedge
POSTGRES_USER=showmeedge
POSTGRES_PASSWORD=showmeedge

QUESTDB_HOST=localhost
QUESTDB_PG_PORT=8812
QUESTDB_ILP_HOST=localhost
QUESTDB_ILP_PORT=9009
```

## Build Sequence

### 1. Foundation

- Create `apps/web` Vite app.
- Create `apps/api` FastAPI app.
- Add Docker Compose with Postgres and QuestDB.
- Add `.env.example`.
- Add `/health` API endpoint.
- Confirm frontend can call backend.

### 2. Auth

- Add Clerk to React.
- Add protected frontend routes.
- Add Clerk JWT verification in FastAPI.
- Create `/api/v1/me`.
- Store app user profile in Postgres after first login.

### 3. Market Data Storage

- Create QuestDB tables for OHLCV.
- Add backend QuestDB connection.
- Add ingestion workflow: `workflows/ingest_ohlcv.py`.
- Start with one development provider, even `yfinance_dev.py`, but isolate it so production providers can replace it.
- Add `/market-data/bars?symbol=AAPL&timeframe=1d`.

### 4. Charts

- Add `features/charts/`.
- Create `CandlestickChart.tsx` using `lightweight-charts`.
- Fetch bars with TanStack Query.
- Render symbol/timeframe picker.

### 5. Watchlists

- Add Postgres tables:
  - `watchlists`.
  - `watchlist_symbols`.
- Add CRUD endpoints.
- Add frontend watchlist panel.
- Make clicking a symbol load the chart.

### 6. Strategies

- Add Postgres tables:
  - `strategies`.
  - `strategy_versions`.
- Start with one strategy: moving average crossover.
- Store config as JSONB.
- Add frontend strategy form.

### 7. Backtesting

- Add `research/backtesting/engine.py`.
- Add `research/backtesting/metrics.py`.
- Add `workflows/run_backtest.py`.
- Add API endpoint to run a small backtest synchronously for MVP.
- Store results in Postgres.
- Store time-series equity curve either in QuestDB or as compressed JSON/artifact depending on size.

### 8. Portfolio / Paper Trading

- Add paper broker implementation under `integrations/brokers/paper.py`.
- Add simulated cash, positions, orders, and fills.
- Keep it paper-only at first.
- Add risk checks before simulated orders.

### 9. Alerts

- Start with in-app alerts stored in Postgres.
- Later add email or webhooks.

### 10. Live Broker Integration

- Only add this after paper trading feels reliable.
- Add broker adapter interface first.
- Add one real broker implementation.
- Add kill switch, audit log, idempotency keys, and order reconciliation.

## Initial API Routes

```text
GET  /api/v1/health
GET  /api/v1/me

GET  /api/v1/watchlists
POST /api/v1/watchlists
POST /api/v1/watchlists/{id}/symbols
DEL  /api/v1/watchlists/{id}/symbols/{symbol}

GET  /api/v1/market-data/bars
POST /api/v1/market-data/ingest

GET  /api/v1/strategies
POST /api/v1/strategies
GET  /api/v1/strategies/{id}

POST /api/v1/backtests
GET  /api/v1/backtests/{id}

GET  /api/v1/portfolio
GET  /api/v1/alerts
```

## QuestDB Tables

Start with:

```sql
CREATE TABLE market_bars (
  symbol SYMBOL,
  provider SYMBOL,
  timeframe SYMBOL,
  ts TIMESTAMP,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  volume LONG
) TIMESTAMP(ts) PARTITION BY DAY;
```

Later tables:

- `market_ticks`.
- `quotes`.
- `signals`.
- `indicator_values`.
- `paper_equity_curve`.

## Postgres Tables

Start with:

- `users`.
- `watchlists`.
- `watchlist_symbols`.
- `strategies`.
- `strategy_versions`.
- `backtests`.
- `backtest_trades`.
- `paper_accounts`.
- `paper_orders`.
- `paper_fills`.
- `paper_positions`.
- `alerts`.
- `audit_events`.

## No Redis / Jobs MVP Rule

Since Redis, Dramatiq, and RQ are omitted:

- Small ingestion can run from the API or CLI.
- Backtests can run synchronously only while they are small.
- Long-running work should be exposed as CLI workflows first.
- `run_backtest.py` should call `BacktestService`, not route-specific code.
- When the app grows, adding a job system should mostly wrap existing services.

This gives the app a clean MVP without prematurely adding infrastructure. The key is to keep internal boundaries sharp from day one.

