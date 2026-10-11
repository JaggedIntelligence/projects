# Feature: Time-Window-Based Edge

## Goal

Add a protected `/twedge` page that compares a symbol's performance over the
same calendar window across a selected range of historical years.

Example request:

```text
symbol: AAPL
provider: yfinance
date1: March 1
date2: May 15
start year: 2015
end year: 2025
```

The first version should produce one result per year containing:

- The first and last trading dates found inside the requested window.
- The adjusted starting and ending close prices.
- The percentage change from the starting price to the ending price.
- The lowest adjusted close and its percentage change from the starting price.
- The highest adjusted close and its percentage change from the starting price.
- The number of trading days used.

## MVP Assumptions

Keep the first version deliberately small:

- `date1` and `date2` are recurring month/day values.
- Both dates belong to the same calendar year.
- `date1` must be earlier than `date2`.
- `startYear` must be less than or equal to `endYear`.
- The maximum requested range is 50 years.
- A single symbol and provider are queried at a time.
- Daily bars come from the existing `equity_ohlcv_daily` QuestDB table.
- No derived QuestDB table is required.
- Results are calculated on demand.
- No classical peak-to-trough maximum drawdown calculation is included yet.
- No cross-year window, such as November 15 through February 15, is included
  yet.

## Routes

UI route:

```text
/twedge
```

Node.js API route:

```text
/api/twedge
```

Suggested files:

```text
app/(app)/twedge/page.tsx
components/twedge/time-window-edge-page.tsx
app/api/twedge/route.ts
server/services/time-window-edge.ts
server/questdb.ts
```

The exact Node.js API organization may use the existing tRPC boundary instead
of a standalone route handler. The public UI route remains `/twedge` either
way.

## Architecture

```text
Browser
  -> /twedge
  -> Node.js API
  -> validate and normalize input
  -> build one date pair for each requested year
  -> execute one parameterized QuestDB query per date pair
  -> collect and normalize yearly results
  -> return one JSON response
  -> render the results table
```

The Node.js API owns:

- Input validation.
- Date-pair generation.
- QuestDB query orchestration.
- Limited query concurrency.
- Response shaping.
- Per-year no-data handling.

QuestDB owns:

- Filtering the daily bars.
- Selecting the first, last, lowest, and highest adjusted close.
- Calculating the three requested percentages.

The browser must never connect directly to QuestDB or receive QuestDB
credentials.

## Source Price

Use adjusted close whenever it is available and fall back to raw close:

```sql
coalesce(adj_close, close) AS close
```

This prevents stock splits and similar corporate actions from creating false
historical gains or losses. API fields such as `startClose` and `endClose`
therefore mean the adjusted close when `adj_close` is present.

## UI Inputs

Required inputs:

```text
symbol
provider
date1 month
date1 day
date2 month
date2 day
start year
end year
```

Recommended defaults:

```text
symbol: AAPL
provider: yfinance
date1: March 1
date2: May 15
start year: 2015
end year: 2025
```

UI validation:

- Normalize `symbol` to uppercase.
- Normalize `provider` to lowercase.
- Require valid calendar month/day combinations.
- Exclude February 29 from the MVP because it is not valid in every year.
- Require `date1 < date2`.
- Require `startYear <= endYear`.
- Require no more than 50 inclusive years.
- Do not submit while a request is already running.

## API Request

```http
POST /api/twedge
Content-Type: application/json
```

```json
{
  "symbol": "AAPL",
  "provider": "yfinance",
  "date1": {
    "month": 3,
    "day": 1
  },
  "date2": {
    "month": 5,
    "day": 15
  },
  "startYear": 2015,
  "endYear": 2025
}
```

Suggested Zod constraints:

```text
symbol: trimmed string, 1-32 characters
provider: trimmed string, 1-32 characters
month: integer, 1-12
day: integer valid for the selected month
startYear/endYear: integer, 1970 through the current year
inclusive year count: 1-50
```

## Date-Pair Generation

The Node.js API converts the recurring month/day inputs into ISO date pairs.

Example:

```json
[
  {
    "year": 2015,
    "startDate": "2015-03-01",
    "endDate": "2015-05-15"
  },
  {
    "year": 2016,
    "startDate": "2016-03-01",
    "endDate": "2016-05-15"
  },
  {
    "year": 2025,
    "startDate": "2025-03-01",
    "endDate": "2025-05-15"
  }
]
```

Always use ISO `yyyy-MM-dd` strings between Node.js and QuestDB. Do not build
locale-dependent values such as `March-01-2015`.

## QuestDB Query

Execute this query once for each generated date pair:

```sql
WITH price_rows AS (
  SELECT
    ts,
    coalesce(adj_close, close) AS close
  FROM equity_ohlcv_daily
  WHERE symbol = $1
    AND provider = $2
    AND ts >= to_timestamp($3, 'yyyy-MM-dd')
    AND ts < dateadd(
      'd',
      1,
      to_timestamp($4, 'yyyy-MM-dd')
    )
    AND coalesce(adj_close, close) > 0
),
summary AS (
  SELECT
    min(ts) AS actual_start_date,
    max(ts) AS actual_end_date,

    arg_min(close, ts) AS start_close,
    arg_max(close, ts) AS end_close,

    min(close) AS lowest_close,
    arg_min(ts, close) AS lowest_close_date,

    max(close) AS highest_close,
    arg_max(ts, close) AS highest_close_date,

    count() AS trading_days
  FROM price_rows
)
SELECT
  actual_start_date,
  actual_end_date,
  start_close,
  end_close,

  100.0 * (
    end_close - start_close
  ) / start_close AS performance_pct,

  lowest_close,
  lowest_close_date,
  100.0 * (
    lowest_close - start_close
  ) / start_close AS max_drawdown_pct,

  highest_close,
  highest_close_date,
  100.0 * (
    highest_close - start_close
  ) / start_close AS max_profit_potential_pct,

  trading_days
FROM summary;
```

Parameters:

```text
$1 = normalized symbol
$2 = normalized provider
$3 = requested inclusive start date
$4 = requested inclusive end date
```

Example:

```text
$1 = AAPL
$2 = yfinance
$3 = 2015-03-01
$4 = 2015-05-15
```

Use real bound parameters through the QuestDB PGWire client. Never interpolate
user-provided values into SQL.

## Date Boundary Behavior

The requested dates may be weekends or exchange holidays. The query therefore
uses a range instead of matching exact dates:

```text
requested start <= ts <= requested end
```

The end boundary is implemented as a half-open interval:

```text
ts >= requested start
ts < requested end + 1 day
```

Within that range:

- `actual_start_date` is the first available trading date.
- `actual_end_date` is the last available trading date.
- `start_close` belongs to `actual_start_date`.
- `end_close` belongs to `actual_end_date`.

For example, if March 1 is a Saturday, `actual_start_date` will normally be
Monday, March 3.

## Metric Definitions

All percentage values are percentage points. A value of `5.25` means `+5.25%`.

### Performance Percentage

```text
100 * (endClose - startClose) / startClose
```

This is the adjusted-close return from the first trading day through the last
trading day in the requested range.

### Maximum Drawdown Percentage

For this MVP:

```text
100 * (lowestClose - startClose) / startClose
```

This value is zero or negative because the starting close is included in the
range.

Despite the API name, this is specifically the maximum downside from the
starting price. It is not the classical maximum drawdown from an intermediate
peak to a later trough.

### Maximum Profit Potential Percentage

```text
100 * (highestClose - startClose) / startClose
```

This value is zero or positive because the starting close is included in the
range. It measures the largest adjusted-close gain available relative to the
starting price, regardless of where the window eventually ends.

## Node.js Query Execution

One query per year is acceptable for the MVP. For a 2015-2025 request, the API
executes 11 small aggregate queries.

Do not execute an unbounded number of queries simultaneously. Use a small
concurrency limit, recommended as four:

```text
maximum active QuestDB queries per request: 4
maximum inclusive year range: 50
```

The API should:

1. Generate the date pairs in ascending year order.
2. Execute the parameterized queries with limited concurrency.
3. Attach the requested year and requested dates to each database result.
4. Convert QuestDB numeric values into JSON numbers.
5. Convert timestamps into ISO strings.
6. Preserve ascending year order in the final response.
7. Return a no-data result for a missing year instead of failing the entire
   request.

## API Response

```json
{
  "symbol": "AAPL",
  "provider": "yfinance",
  "date1": {
    "month": 3,
    "day": 1
  },
  "date2": {
    "month": 5,
    "day": 15
  },
  "startYear": 2015,
  "endYear": 2025,
  "results": [
    {
      "year": 2015,
      "requestedStartDate": "2015-03-01",
      "requestedEndDate": "2015-05-15",
      "actualStartDate": "2015-03-02T00:00:00.000000Z",
      "actualEndDate": "2015-05-15T00:00:00.000000Z",
      "startClose": 32.12,
      "endClose": 32.19,
      "performancePct": 0.22,
      "lowestClose": 30.27,
      "lowestCloseDate": "2015-03-11T00:00:00.000000Z",
      "maxDrawdownPct": -5.76,
      "highestClose": 34.86,
      "highestCloseDate": "2015-04-28T00:00:00.000000Z",
      "maxProfitPotentialPct": 8.53,
      "tradingDays": 54,
      "status": "ok"
    }
  ]
}
```

When no matching bars exist:

```json
{
  "year": 2015,
  "requestedStartDate": "2015-03-01",
  "requestedEndDate": "2015-05-15",
  "actualStartDate": null,
  "actualEndDate": null,
  "startClose": null,
  "endClose": null,
  "performancePct": null,
  "lowestClose": null,
  "lowestCloseDate": null,
  "maxDrawdownPct": null,
  "highestClose": null,
  "highestCloseDate": null,
  "maxProfitPotentialPct": null,
  "tradingDays": 0,
  "status": "no_data"
}
```

## UI Results

Display one table row per year.

Recommended columns:

```text
Year
Requested dates
Actual dates
Start close
End close
Performance %
Lowest close
Lowest close date
Max drawdown %
Highest close
Highest close date
Max profit potential %
Trading days
```

Formatting:

- Show prices with two to four decimal places as appropriate.
- Show percentages with two decimal places.
- Prefix positive percentages with `+`.
- Display negative percentages in the existing negative-value color.
- Display positive percentages in the existing positive-value color.
- Show `No data` instead of an empty row when `status = "no_data"`.
- Keep requested and actual dates visible so weekend and holiday adjustments
  are understandable.

## Error Handling

Return a request-level validation error when:

- The symbol or provider is empty.
- Either month/day value is invalid.
- `date1` is not earlier than `date2`.
- `startYear` is after `endYear`.
- The requested range exceeds 50 years.
- A year is before 1970 or after the current year.

Return a server error when:

- QuestDB cannot be reached.
- QuestDB rejects the query.
- A database response cannot be normalized safely.

A year with no matching rows is not a request error. It is a successful
per-year result with `status = "no_data"`.

## Testing

### Unit Tests

- Generates an inclusive date-pair list from 2015 through 2025.
- Pads month and day values in ISO dates.
- Rejects `date1 >= date2`.
- Rejects reversed year ranges.
- Rejects ranges longer than 50 years.
- Rejects February 29 for the MVP.
- Normalizes symbols and providers.
- Calculates the expected query parameters for every year.
- Preserves result ordering when queries finish out of order.
- Normalizes a no-data QuestDB row.

### API Tests

- Accepts a valid request and returns one result per requested year.
- Uses bound query parameters.
- Limits concurrent QuestDB queries.
- Returns adjusted-close-based metrics.
- Returns per-year `no_data` results without failing the request.
- Rejects invalid inputs before querying QuestDB.

### UI Tests

- Renders the default inputs.
- Submits normalized input to the API.
- Displays loading and error states.
- Displays one row per year.
- Displays requested and actual dates.
- Formats positive, negative, and null percentages correctly.
- Displays `No data` for missing years.

## Future Iterations

Possible follow-up features:

- Classical peak-to-trough maximum drawdown.
- Best chronological buy-to-later-sell return.
- Date windows that cross calendar years.
- Multiple symbols in one request.
- Aggregate statistics across the returned years.
- Win rate and loss rate.
- Average and median return.
- CSV export.
- Charting yearly performance, downside, and upside.
- Combining all years into one QuestDB query if request volume makes the
  per-year approach too slow.
- Caching repeated requests.

## Acceptance Criteria

- `/twedge` is available as a protected app route.
- The form accepts symbol, provider, two month/day values, and a year range.
- The API builds one valid date pair per inclusive year.
- The API uses limited concurrency and parameterized QuestDB queries.
- Price calculations use `coalesce(adj_close, close)`.
- Weekend and holiday boundaries resolve to actual trading dates.
- The response contains performance, downside-from-start, and
  upside-from-start percentages for each year.
- Missing years are represented as `no_data`.
- The UI renders all yearly results in ascending year order.
