# Feature Plan: Backtesting With VectorBT

## Goal

Add a simple backtesting workflow for exploring trading strategies from the web app.

The first strategy is intentionally narrow:

- User opens `/backtest`.
- User enters a ticker symbol.
- User clicks `Run`.
- The app runs a daily dual-SMA crossover backtest.
- The result shows summary metrics, an equity curve, and recent trades.

This is the first research workflow. It should prove the end-to-end architecture before adding strategy builders, parameter sweeps, persistence, or portfolio-level backtests.

## Key Design Decision

Keep quantitative computation in the Python market service, not inside the Next.js app.

Flow:

```text
Browser
  -> /backtest page
  -> tRPC marketData.runBacktest
  -> FastAPI /backtests/run
  -> QuestDB daily OHLCV read
  -> vectorbt strategy execution
  -> JSON result returned to the UI
```

This preserves the separation already used elsewhere in the project:

- Next.js owns product UI, auth, app shell, and user workflows.
- tRPC owns the app-facing typed API boundary.
- FastAPI owns market-data access and finance/math computation.
- QuestDB owns time-series market data.

## Implemented MVP

Status as of 2026-06-06:

- Route added at `app/(app)/backtest/page.tsx`.
- Client UI added at `components/backtest/backtest-page.tsx`.
- App shell navigation includes `Backtest`.
- `/backtest` is protected by Clerk middleware.
- tRPC mutation exists as `marketData.runBacktest`.
- FastAPI endpoint exists as `POST /backtests/run`.
- FastAPI backtesting engine uses vectorbt when available.
- Manual SMA crossover fallback remains for environments without vectorbt installed.
- Market API Docker image installs `vectorbt`.
- Tests were added for the UI submit contract, input defaults, and the FastAPI internal provider call.

## Strategy Defaults

The MVP follows the VectorBT dual-SMA crossover example shape.

Default parameters:

```text
timeframe: 1d
initial_cash: 100
fast_sma: 10
slow_sma: 50
seed_if_empty: true
```

The UI currently exposes only:

```text
ticker
```

The other values are fixed defaults for the first slice. They should become editable in a later iteration.

## Backtest Semantics

The current strategy is long-only:

- Compute fast SMA over close prices.
- Compute slow SMA over close prices.
- Enter when fast SMA crosses above slow SMA.
- Exit when fast SMA crosses below slow SMA.
- Use all available cash on entry.
- Stay in cash after exit.
- Use daily close as the signal and fill price.

Current implementation path:

```text
services/market-api/app/backtesting.py
```

VectorBT path:

```python
fast_ma = vbt.MA.run(price, fast_sma)
slow_ma = vbt.MA.run(price, slow_sma)
entries = fast_ma.ma_crossed_above(slow_ma)
exits = fast_ma.ma_crossed_below(slow_ma)
portfolio = vbt.Portfolio.from_signals(price, entries, exits, init_cash=initial_cash, freq="1D")
```

The manual fallback uses the same crossover idea, but vectorbt should be considered the preferred research engine.

## API Contract

Request to FastAPI:

```json
{
  "symbol": "AAPL",
  "timeframe": "1d",
  "initial_cash": 100,
  "fast_sma": 10,
  "slow_sma": 50,
  "seed_if_empty": true
}
```

Response shape:

```json
{
  "symbol": "AAPL",
  "timeframe": "1d",
  "strategy": "SMA crossover 10/50",
  "engine": "vectorbt",
  "source": "questdb_yfinance_daily",
  "initial_cash": 100,
  "final_equity": 33061.48,
  "total_return": 329.614807,
  "max_drawdown": -0.720763,
  "trade_count": 195,
  "win_rate": 0.4742268041237113,
  "trades": [],
  "equity_curve": []
}
```

Notes:

- `engine` can be `vectorbt`, `manual`, or test/mock values.
- `trades` contains buy/sell rows with `side`, `time`, `price`, `quantity`, and `value`.
- `equity_curve` contains daily `time` and `equity` points.
- The UI only displays a summary, sparkline, and recent trades for now.

## Data Source

FastAPI reads bars through:

```text
GET /market-data/bars
```

The preferred source is:

```text
equity_ohlcv_daily in QuestDB
```

When daily bars exist for the ticker/provider pair, the response source is:

```text
questdb_yfinance_daily
```

If no daily bars exist and `seed_if_empty=true`, the existing mock data path can seed/read local mock bars. This keeps the UI usable during development, but real strategy research should use backfilled daily bars.

## UI Design

The first `/backtest` page is intentionally operational rather than decorative.

Main sections:

- Header with strategy family and timeframe badges.
- Ticker input and `Run` button.
- Fixed default settings display.
- Summary metric tiles:
  - Final equity
  - Total return
  - Max drawdown
  - Trades
  - Win rate
- Equity curve sparkline.
- Recent trades table.

The page should remain compact because this is a repeated research workflow, not a landing page.

## Authentication

`/backtest` is protected by middleware:

```text
middleware.ts
```

Reason:

- The page calls protected tRPC procedures.
- Unauthenticated users should go through Clerk sign-in before reaching the workflow.
- This avoids rendering a page that can load but cannot run its mutation.

## Current Files

Frontend:

```text
app/(app)/backtest/page.tsx
components/backtest/backtest-page.tsx
components/app-shell.tsx
lib/market-data-validators.ts
middleware.ts
server/api/routers/market-data.ts
```

Python service:

```text
services/market-api/app/backtesting.py
services/market-api/app/main.py
services/market-api/app/models.py
services/market-api/requirements.txt
services/market-api/README.md
```

Tests:

```text
tests/components/backtest-page.test.tsx
tests/unit/market-data-validators.test.ts
services/market-api/tests/test_backtest_api.py
```

## Verification

Commands used for the MVP:

```bash
pnpm vitest run tests/components/backtest-page.test.tsx tests/unit/market-data-validators.test.ts
pnpm exec tsc --noEmit
pnpm lint
docker compose -f scripts/docker-compose.yml build market-api
docker compose -f scripts/docker-compose.yml run --rm --no-deps -v /Users/sreddy/projects/showmeedge/services/market-api/tests:/app/tests:ro market-api python -m unittest discover -s tests
```

Live FastAPI smoke test:

```bash
curl -sS -X POST http://127.0.0.1:8000/backtests/run \
  -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","timeframe":"1d","initial_cash":100,"fast_sma":10,"slow_sma":50,"seed_if_empty":true}'
```

Expected important fields:

```json
{
  "strategy": "SMA crossover 10/50",
  "engine": "vectorbt"
}
```

## Known Limitations

This MVP is useful for architecture validation, but it is not yet research-grade.

Limitations:

- No user-editable SMA windows in the UI.
- No date range controls.
- No benchmark comparison.
- No fees, slippage, or execution timing controls.
- No persisted backtest results.
- No parameter sweep or optimization workflow.
- No strategy registry.
- No multi-asset portfolio backtests.
- No explicit adjusted-vs-raw-price selection.

The current QuestDB daily table stores `adj_close`, but the FastAPI `OhlcvBar` response currently maps to `close`. This should be made explicit before relying on results for serious research.

## Next Slices

Recommended next implementation order:

1. Add UI controls for `initial_cash`, `fast_sma`, and `slow_sma`.
2. Add start/end date filters to the FastAPI backtest request.
3. Add a benchmark buy-and-hold comparison for the same ticker and date range.
4. Add fees and slippage inputs.
5. Persist backtest summaries in Postgres and optionally store full curves/trades separately.
6. Add a strategy registry so SMA crossover is one strategy among many.
7. Add parameter sweeps using vectorbt over fast/slow window grids.
8. Add export/download for trades and equity curve.

## Future Persistence Direction

Postgres should own app-facing backtest records:

```text
backtests
backtest_trades
```

QuestDB should remain the market-data/time-series store.

For larger backtest artifacts, consider object storage or compressed JSON files referenced by Postgres, especially for long equity curves and parameter sweep matrices.

## Open Questions

- Should backtests use raw `close`, `adj_close`, or a user-selectable price field?
- Should the default data provider remain `yfinance` for research, or should we add a licensed provider before expanding the feature?
- Should vectorbt run in FastAPI request/response for small jobs only, with longer sweeps moved to a worker?
- Should strategy definitions live as Python modules, database records, or both?
- Should the app save every run automatically, or only when the user explicitly saves a result?
