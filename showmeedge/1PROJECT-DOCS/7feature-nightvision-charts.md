# Feature: Night Vision Charts

Date: 2026-06-13

This document records the current design for the Night Vision chart page and component set.

The goal is to provide a Night Vision based stock-chart experience that uses the same live market-data pipeline as the trading setup, while keeping all Night Vision related UI code isolated under `components/nvcharts`.

## Current Status

Status as of 2026-06-13:

- Night Vision package is installed as `night-vision@0.4.0`.
- Local module typing is declared in `types/night-vision.d.ts`.
- Night Vision UI files live under `components/nvcharts`.
- The current route is `app/(app)/charts/page.tsx`.
- The chart consumes live bars through the existing tRPC market-data router.
- The chart panel includes a days-back replay control that can hide or reveal trailing daily bars one day at a time.
- The chart panel displays the latest visible bar date in `Friday JUN 12` format next to the replay arrows.
- The existing `/trading` route and `components/trading` chart implementation remain separate.

## Night Vision Charts Reference

The Night Vision chart code in this project is based on this reference:
https://nightvision.dev/guide/intro/10-basic-examples.html

## Route Entry

Current route:

```text
app/(app)/charts/page.tsx
```

The route imports:

```text
components/nvcharts/nightvision-chart-main-page.tsx
```

The route metadata currently describes the page as:

```text
Night Vision Charts Setup
Chart setup with live DB-backed market data rendered in Night Vision.
```

## Folder Structure

Night Vision chart code is owned by:

```text
components/nvcharts/
  nightvision-chart-main-page.tsx
  nightvision-outerlayer-page.tsx
  nightvision-market-chart-panel.tsx
  nightvision-candlestick-chart.tsx
```

Related test coverage:

```text
tests/components/nightvision-market-chart-panel.test.tsx
```

Supporting package typing:

```text
types/night-vision.d.ts
```

Dependency:

```text
package.json
  night-vision
```

## Ownership Boundary

Night Vision chart files should stay in:

```text
components/nvcharts
```

The `/trading` route should continue to use the existing TradingView lightweight chart components under:

```text
components/trading
```

The Night Vision page should not modify the existing `/trading` route. If behavior needs to be shared later, prefer extracting neutral shared utilities into a non-chart-specific location such as:

```text
components/shared
lib
```

Do not make Night Vision chart behavior depend on TradingView chart internals.

## Component Responsibilities

### `nightvision-chart-main-page.tsx`

Top-level client page component for the Night Vision chart experience.

Responsibilities:

- Imports the Night Vision-specific outer page.
- Injects `NightVisionMarketChartPanel` as the active chart panel.
- Keeps the route entry small and easy to read.

Current flow:

```text
NvChartMainPage
  -> NightVisionOuterlayerPage
     -> NightVisionMarketChartPanel
```

### `nightvision-outerlayer-page.tsx`

Outer page shell for the Night Vision chart screen.

Responsibilities:

- Owns the page-level layout.
- Loads the available symbols using `api.trading.symbols.list`.
- Passes `{ id, ticker, name }` symbol options to the chart panel.
- Keeps the Night Vision page independent from the `/trading` page implementation.

Current visible page text:

```text
Simple Ticker Chart
```

The file contains copied form/query setup from the trading setup page. Much of the broader CRUD code is currently inactive/commented while the Night Vision screen is focused on a simple ticker chart.

### `nightvision-market-chart-panel.tsx`

Panel-level chart controller.

Responsibilities:

- Receives symbol options from the outer page.
- Provides fallback symbols when no live symbols exist:

```text
AAPL
MSFT
SPY
```

- Owns selected ticker state.
- Calls live market-data query:

```ts
api.marketData.bars.useQuery({ ticker, timeframe: "1d" })
```

- Keeps the fetched bars as the source data and derives visible bars with a hidden trailing-day count.
- Computes latest close, one-day change, and one-day percent change from the visible bars.
- Renders the `Days go back` input and `Update` button.
- Renders left/right arrow controls for removing one visible day or adding one hidden day back.
- Displays the latest visible bar date next to the right arrow.
- Renders the selected ticker dropdown.
- Renders the chart loading state while bars are loading.
- Passes visible bars to `NightVisionCandlestickChart`.

The panel currently keeps a simplified UI compared with the original trading market panel:

- Shows the timeframe badge.
- Shows latest close and daily change when data is present.
- Shows a hidden-day badge when the replay window has hidden trailing bars.
- Shows the latest visible bar date as `Weekday MON D`, for example `Friday JUN 12`.
- Does not show the old TradingView credit.
- Does not expose full ingest/backtest controls in the visible UI.

### `nightvision-candlestick-chart.tsx`

Client-only wrapper around the Night Vision library.

Responsibilities:

- Converts app `OhlcvBar[]` rows into Night Vision candle data.
- Builds `Candles`, `SMA 10`, and `SMA 20` overlays.
- Dynamically imports `night-vision` only in the browser.
- Creates the Night Vision instance.
- Destroys the Night Vision instance on component unmount.
- Provides empty-data and load-error states.

The component intentionally uses dynamic import:

```ts
import("night-vision")
```

This avoids loading the browser-only chart library during server rendering.

## Data Flow

High-level flow:

```text
/charts route
  -> NvChartMainPage
  -> NightVisionOuterlayerPage
  -> api.trading.symbols.list({ assetType: "all" })
  -> NightVisionMarketChartPanel
  -> api.marketData.bars({ ticker, timeframe: "1d" })
  -> derive visible bars from hidden trailing-day count
  -> NightVisionCandlestickChart
  -> NightVision canvas chart
```

Market-data source behavior is inherited from the existing market-data router:

```text
server/api/routers/market-data.ts
```

The bars query first attempts the configured market API:

```text
MARKET_API_BASE_URL /market-data/bars
```

When the market API is unavailable, the router can return mock fallback bars from:

```text
lib/mock-ohlcv.ts
```

## Chart Replay Controls

The `/charts` page supports a small daily-bar replay control in `NightVisionMarketChartPanel`.

Visible controls:

```text
Days go back
Update
left arrow
right arrow
latest visible bar date
```

Behavior:

- `Days go back` accepts the number of trailing daily bars to hide.
- `Update` applies the typed value.
- The left arrow removes one more visible bar from the right side of the chart.
- The right arrow adds one hidden trailing bar back to the right side of the chart.
- The hidden-day value is clamped between `0` and `bars.length - 1`, so at least one bar remains visible.
- The latest close, daily change, hidden-day badge, and latest-bar date all follow the visible bar set.
- The original fetched bars are not mutated; the chart receives `displayedBars`.

Example:

```text
Full bars:      100 daily bars
Days go back:  5
Visible bars:  first 95 bars
Hidden tail:   last 5 bars

Right arrow:   hidden tail decreases to 4, visible bars increase to 96
Left arrow:    hidden tail increases to 5, visible bars decrease to 95
```

The latest visible bar date is formatted without a year:

```text
Friday JUN 12
```

Date formatting uses UTC so date-only market bars such as `2026-06-12` do not shift to the previous day in local timezones.

## Night Vision Data Shape

The chart builds this top-level Night Vision data structure:

```ts
{
  indexBased: true,
  panes: [
    {
      overlays: [
        {
          name: `${ticker} Daily`,
          type: "Candles",
          main: true,
          data: [...]
        },
        {
          name: "SMA 10",
          type: "Spline",
          data: [...]
        },
        {
          name: "SMA 20",
          type: "Spline",
          data: [...]
        }
      ]
    }
  ]
}
```

Candles are converted to:

```ts
[timeMs, open, high, low, close, volume]
```

Spline overlays are converted to:

```ts
[timeMs, value]
```

## Time Handling

Application bars use:

```ts
type OhlcvBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
```

Night Vision expects timestamp values in milliseconds.

The conversion handles both date-only and ISO datetime strings:

```ts
Date.parse(date.includes("T") ? date : `${date}T00:00:00.000Z`)
```

This keeps the chart compatible with:

- mock fallback bars like `2025-01-02`
- API bars that may eventually return full ISO timestamps

The replay control date display uses the same UTC interpretation for the latest visible bar date.

## Chart Configuration

The Night Vision instance is created with:

```ts
new NightVision(chartId, {
  id: `${chartId}-instance`,
  autoResize: true,
  height: 820,
  indexBased: true,
  showLogo: false,
  colors,
  data
});
```

Important settings:

- `autoResize: true` lets the chart track its container.
- `indexBased: true` is appropriate for daily stock bars with market-session gaps.
- `showLogo: false` hides the default Night Vision logo.
- `height: 820` gives the current chart a large, trading-terminal style viewport.

Current visual colors:

```text
background: #080d10
grid:       #20303a88
text:       #a8bec7
up candle:  #22c55e
down candle:#fb7185
SMA 10:     #f8c537
SMA 20:     #5cc8ff
```

## Empty And Loading States

Loading state:

```text
h-80 animate-pulse rounded-md border bg-muted
```

Empty bars state:

```text
No bars available for <ticker>.
```

Chart library load error:

```text
The error message is rendered inside a bordered muted panel.
```

## Runtime Dependencies

Night Vision is browser-only in this app.

Key implementation constraints:

- The wrapper component must be `"use client"`.
- Import `night-vision` dynamically inside `useEffect`.
- Do not construct `new NightVision(...)` on the server.
- Destroy the chart instance on cleanup to avoid stale event handlers.

Cleanup pattern:

```ts
return () => {
  isMounted = false;
  chart?.destroy();
};
```

## Authentication And Data Access

The page uses the same tRPC providers as the rest of the app.

Relevant protected APIs:

```text
api.trading.symbols.list
api.marketData.bars
```

The browser must have a valid Clerk session for protected tRPC calls to return live data. In a signed-out session the page shell can render, but market data may not hydrate into candles.

## Verification Checklist

Use these commands after Night Vision chart changes:

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/components/nightvision-market-chart-panel.test.tsx
pnpm run build
```

Use the app locally:

```bash
pnpm run dev
```

Open:

```text
http://localhost:3000/charts
```

Manual checks:

- Route loads without runtime errors.
- Ticker dropdown displays DB-backed symbols or fallback symbols.
- Selected ticker triggers the bars query.
- Chart renders candles when bars are available.
- Entering `5` in `Days go back` and clicking `Update` hides the last 5 daily bars.
- Right arrow adds one hidden daily bar back to the visible chart.
- Left arrow removes one visible daily bar from the chart.
- Latest visible bar date updates next to the right arrow.
- Empty state appears when no bars are available.
- SMA 10 and SMA 20 overlays render over candles.
- Existing `/trading` page remains visually and behaviorally unchanged.

## Future Improvements

Potential next steps:

- Rename the route to `/nightvision` if the product URL should match the feature name.
- Remove inactive copied CRUD code from `nightvision-outerlayer-page.tsx` once the final page scope is settled.
- Move reusable ticker/chart helpers to `lib` if more chart engines are added.
- Add explicit unit tests for `OhlcvBar -> NightVisionData` conversion.
- Add a Playwright smoke test for `/charts` when authenticated test credentials are available.
- Add chart-level controls for SMA period, candle colors, and chart height.
