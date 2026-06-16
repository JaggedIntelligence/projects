# Feature: uPlot Based Charts

Date: 2026-06-16

This document records the current design for the experimental uPlot chart route.

The first working route is `/plots2`. It proves that the app can fetch a large packed JSON time-series dataset, transform it into uPlot aligned data, and render it inside the existing Next.js app shell.

## Current Status

Status as of 2026-06-16:

- `uplot-react@1.2.4` is installed.
- The route is implemented at `app/(app)/plots2/page.tsx`.
- The page fetches remote JSON from the uPlot benchmark data URL.
- The fetched JSON is parsed in the browser.
- `prepData()` converts the packed row format into uPlot aligned series arrays.
- The chart renders three visible series:
  - `CPU`
  - `RAM`
  - `TCP Out`
- The page has basic loading and error states.
- The chart is wrapped in a horizontal overflow container because the current chart width is fixed at `1200px`.

## Route Entry

Current route:

```text
app/(app)/plots2/page.tsx
```

Browser URL:

```text
/plots2
```

The route is a client component because the chart library, `fetch()` lifecycle, and `devicePixelRatio`-based stroke sizing are all browser-side concerns.

```ts
"use client";
```

## Dependency

The route uses:

```text
uplot-react
uplot/dist/uPlot.min.css
```

The React wrapper is imported as:

```ts
import UplotReact from "uplot-react";
import "uplot/dist/uPlot.min.css";
```

The CSS import is currently route-local for the prototype. If uPlot becomes the common charting layer, prefer moving the uPlot CSS import to a shared place so future chart routes do not repeat it.

## uPlot References

Original uPlot repo:

[leeoniya/uplot](https://github.com/leeoniya/uplot)

uPlot React wrapper:

[https://github.com/skalinichev/uplot-wrappers/tree/master](https://github.com/skalinichev/uplot-wrappers/tree/master)

Sample/example uPlot chart demos:

[https://leeoniya.github.io/uPlot/demos/index.html](https://leeoniya.github.io/uPlot/demos/index.html)

## Data Source

Remote JSON URL:

```text
https://leeoniya.github.io/uPlot/bench/data.json
```

The response is a packed flat array, not an array of objects.

The shape is:

```text
[
  numFields,
  fieldName1,
  fieldName2,
  ...fieldNameN,
  row1Field1,
  row1Field2,
  ...row1FieldN,
  row2Field1,
  row2Field2,
  ...row2FieldN
]
```

For the current data file, the first values are:

```text
[7, "epoch", "idl", "recv", "send", "writ", "used", "free", ...]
```

Meaning:

```text
numFields = 7
fields    = epoch, idl, recv, send, writ, used, free
```

Each data row then contains seven numeric values in that order.

## Fetch Design

The JSON fetch happens inside `useEffect()` after the component mounts.

High-level flow:

```text
component mounts
  -> set loading state
  -> fetch(DATA_URL)
  -> verify HTTP response
  -> parse response.json()
  -> validate packed array shape
  -> prepData(packed)
  -> set chart data
  -> render UplotReact
```

The route uses `AbortController` so the request can be canceled if the component unmounts while the fetch is still in progress.

Important fetch behavior:

```ts
const response = await fetch(DATA_URL, { signal: controller.signal });
const packed = (await response.json()) as unknown;
```

The response is validated before calling `prepData()`:

```ts
function isPackedData(value: unknown): value is PackedData {
  return Array.isArray(value) && typeof value[0] === "number";
}
```

This prevents the chart preparation step from running against an unexpected response such as an HTML error page or malformed JSON.

## Data Preparation

uPlot expects aligned data:

```text
[
  xValues,
  ySeries1Values,
  ySeries2Values,
  ySeries3Values
]
```

The route defines this as:

```ts
type ChartData = [number[], number[], number[], number[]];
```

`prepData()` converts the packed source array into:

```text
[
  time,
  cpu,
  ram,
  tcpOut
]
```

Current field mapping:

```text
time   = epoch * 60
cpu    = 100 - idl
ram    = 100 * used / (used + free)
tcpOut = send
```

In source-index terms:

```text
epoch = values[i]
idle  = values[i + 1]
send  = values[i + 3]
used  = values[i + 5]
free  = values[i + 6]
```

The current implementation rounds CPU and RAM values:

```text
CPU rounded to 3 decimals
RAM rounded to 2 decimals
```

## Chart Options

The uPlot options are created with `useMemo()`.

Current chart dimensions:

```text
width: 1200
height: 600
```

Current title:

```text
Server Events
```

Current series:

```text
Time
CPU
RAM
TCP Out
```

Series colors:

```text
CPU     red
RAM     blue
TCP Out green
```

CPU and RAM share the `%` scale. TCP Out uses the `mb` scale on the right axis.

The route guards browser-only stroke sizing:

```ts
function getStrokeWidth() {
  return typeof window === "undefined" ? 1 : 1 / window.devicePixelRatio;
}
```

This avoids reading `window.devicePixelRatio` at module scope.

## UI States

The route currently supports three visible states:

```text
loading -> "Loading chart data..."
error   -> error message
ready   -> uPlot chart
```

State ownership:

```ts
const [data, setData] = useState<ChartData | null>(null);
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

The chart only renders once data exists:

```tsx
data ? <UplotReact options={options} data={data} /> : null
```

## Layout

The route inherits the app shell from:

```text
app/(app)/layout.tsx
```

The page content is padded:

```tsx
<main className="space-y-4 p-6">
```

The chart is wrapped with horizontal overflow:

```tsx
<div className="overflow-x-auto">
```

Reason:

- The current uPlot chart has a fixed `1200px` width.
- Smaller viewports need horizontal scrolling instead of squeezing the canvas into an unreadable size.

## Data Flow

High-level route data flow:

```text
/plots2 route
  -> TimeSeriesChart client component
  -> useEffect()
  -> fetch remote packed JSON
  -> response.json()
  -> isPackedData()
  -> prepData()
  -> ChartData aligned arrays
  -> UplotReact
  -> uPlot canvas chart
```

## Design Notes

The `/plots2` route is currently a prototype route. It is intentionally direct and local so the data shape and uPlot behavior are easy to inspect.

Before building more production chart pages, consider extracting:

```text
components/uplot/uplot-time-series-chart.tsx
lib/charts/uplot-data.ts
```

Possible shared responsibilities:

- Fetching and validating packed time-series JSON.
- Converting packed rows into aligned uPlot data.
- Common uPlot loading and error states.
- Shared chart sizing policy.
- Shared color and scale conventions.

## Known Limitations

- The chart width is fixed at `1200px`.
- There is no resize observer yet.
- The route fetches a public demo dataset, not app market data.
- The fetched data is not cached beyond the browser/network cache.
- The current packed-data validator only checks the minimum shape. It does not yet validate each field name.
- `console.time("prep")` is still present for profiling and can be removed once the prototype is stable.
- `/plots` remains a separate smoke-test route and has existing TypeScript typing issues around uPlot options and aligned data.

## Future Enhancements

Recommended next steps:

- Replace the demo JSON URL with an app-owned API route or local market-data endpoint.
- Add responsive sizing with a container measurement hook.
- Extract `prepData()` into a reusable utility with tests.
- Add stronger schema validation for field names and numeric row completeness.
- Add a reusable uPlot chart wrapper component.
- Move chart colors and scale labels into a shared chart config.
- Add a route-level title or toolbar once the chart is no longer just a prototype.
