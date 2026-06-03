# Feature: Yahoo Earnings Calendar Ingestion

## Goal

Extract exact earnings calendar table values from Yahoo Finance calendar pages for a requested week/day URL, for example:

```text
https://finance.yahoo.com/calendar/earnings?from=2010-05-30&to=2010-06-05&day=2010-06-02
```

This is intended as a batch ingestion workflow, not a web UI feature.

## Key Finding

A simple server-side HTML fetch with Python `requests` / Beautiful Soup or Node `fetch` / Cheerio is not reliable for this page.

Yahoo Finance now serves a heavy JavaScript-rendered app shell. The static HTML can contain unrelated/default table content, current/failsafe data, or missing row-level date information. In testing, the non-browser scraper returned rows that looked valid but were not the exact historical table for the requested URL.

The headless browser approach worked better. Playwright + Chromium rendered the page, executed Yahoo's JavaScript, and exposed the actual table values shown for:

```text
May 30, 2010 - Jun 5, 2010
Earnings On Wed, Jun 2
```

## Current Prototype

Prototype file:

```text
scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs
```

Run:

```bash
node scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs
```

JSON output:

```bash
node scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs --format json
```

Custom date:

```bash
node scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs \
  --from 2010-05-30 \
  --to 2010-06-05 \
  --day 2010-06-02 \
  --format json
```

## Validated Output Shape

The script currently returns:

```json
{
  "url": "https://finance.yahoo.com/calendar/earnings?from=2010-05-30&to=2010-06-05&day=2010-06-02",
  "requested": {
    "from": "2010-05-30",
    "to": "2010-06-05",
    "day": "2010-06-02"
  },
  "title": "Company Earnings Calendar - Yahoo Finance",
  "rangeLabel": "May 30, 2010 - Jun 5, 2010",
  "selectedDayLabel": "Earnings On Wed, Jun 2",
  "rowCount": 11,
  "rows": []
}
```

Each `rows` item has:

```json
{
  "symbol": "CPRT",
  "companyName": "Copart, Inc.",
  "eventName": null,
  "earningsCallTime": "TAS",
  "epsEstimate": 0.03,
  "reportedEps": 0.03,
  "surprisePercent": 7.18,
  "marketCap": "31.83B"
}
```

## Validated June 2, 2010 Rows

| Symbol | Company | Event | Call Time | EPS Est. | Reported EPS | Surprise % | Market Cap |
|---|---|---|---|---:|---:|---:|---:|
| CPRT | Copart, Inc. | - | TAS | 0.03 | 0.03 | 7.18 | 31.83B |
| RBC | RBC Bearings Incorporated | - | TAS | 0.33 | 0.37 | 10.68 | 18.07B |
| DSGX | The Descartes Systems Group Inc. | - | TAS | 0.07 | 0.08 | 20.75 | 6.23B |
| LIVN | LivaNova PLC | - | TAS | 0.33 | 0.4 | 21.21 | 4.05B |
| GEF | Greif, Inc. | - | TAS | 0.8 | 0.86 | 7.17 | 3.59B |
| UNFI | United Natural Foods, Inc. | - | TAS | 0.42 | 0.45 | 7.36 | 3.06B |
| ABM | ABM Industries Incorporated | - | TAS | 0.26 | 0.23 | -10.68 | 2.31B |
| DAKT | Daktronics, Inc. | - | TAS | -0.1 | -0.12 | -24.13 | 944.71M |
| HOV | Hovnanian Enterprises, Inc. | - | TAS | -17.47 | -9 | 48.49 | 582M |
| CVGW | Calavo Growers, Inc. | - | TAS | 0.18 | 0.33 | 83.33 | 480.1M |
| SCVL | Shoe Carnival, Inc. | - | TAS | 0.24 | 0.24 | 1.12 | 477.95M |

## Proposed Design

Use a Node.js batch scraper with Playwright + headless Chromium.

High-level flow:

1. Accept `from`, `to`, and `day` as CLI args.
2. Build the Yahoo earnings calendar URL.
3. Launch Chromium in headless mode.
4. Navigate to the URL and wait for DOM content.
5. Wait until a table exists with headers `Symbol`, `EPS Estimate`, and `Reported EPS`.
6. Extract rendered table rows from the DOM.
7. Normalize numeric columns.
8. Return JSON for downstream ingestion.
9. Store raw HTML/screenshot on failure for debugging.

Current extraction fields:

```text
symbol
companyName
eventName
earningsCallTime
epsEstimate
reportedEps
surprisePercent
marketCap
```

## Why Headless Browser

Benefits:

- Executes Yahoo's client-side JavaScript.
- Extracts the actual table the user sees in the browser.
- Avoids trusting stale/failsafe server HTML.
- Allows network inspection if Yahoo changes how the table is populated.

Costs:

- Slower than direct HTTP scraping.
- Requires Chromium browser binaries and OS dependencies.
- Needs timeout, retry, and rate-limit handling.
- More operational complexity in Docker/Ubuntu.

For this feature, correctness is more important than raw speed, so Playwright is the better first production direction.

## Ubuntu Production Notes

Playwright + Chromium works on Ubuntu.

Install browser:

```bash
npx playwright install chromium
```

Install Ubuntu dependencies:

```bash
npx playwright install-deps chromium
```

Docker option:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.56.1-jammy
```

Production job should set:

```text
headless: true
viewport: 1280x720
reasonable timeout, for example 60s
retry attempts with backoff
sleep between Yahoo requests
```

## Failure Handling

On scrape failure, capture:

```text
requested URL
page title
body text preview
HTML snapshot
screenshot
network URLs matching query*.finance.yahoo.com
```

This is important because Yahoo may change selectors, return a consent page, return failsafe markup, or throttle requests.

## Next Implementation Steps

1. Keep `scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs` as the first prototype.
2. Add optional `--output path.json` so batch runs can write results to disk.
3. Add `--screenshot-on-error` and `--html-on-error` debug artifacts.
4. Add date-range iteration for multiple days.
5. Add pagination handling if Yahoo shows more rows than the first table page.
6. Add persistence later, likely through the market service ingestion path.
7. Consider converting `.mjs` to `.ts` after scraper behavior stabilizes.

## Open Questions

- Does Yahoo reliably render old historical dates across large date ranges?
- How often does Yahoo throttle headless browser sessions?
- Is the table complete for dates with more than one page of earnings?
- Should market cap be stored as display text only, or normalized into a numeric value plus unit?
- Should this remain a Node script, or become part of the Python market service once the extraction contract is stable?
