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

