# Feature: Russell 3000 Symbol Scrape

## Goal

Create a small batch job that scrapes the current Russell 3000 symbol universe from ChartMill and writes local files that can be used by later ingestion jobs.

First phase scope:

- Scrape ChartMill Russell 3000 pages `p=0` through `p=4`.
- Extract the big symbol table from each page.
- Write the full scrape result as a JSON array.
- Write a simplified universe CSV compatible with the existing market-data CSV format.
- Do not insert into QuestDB yet.

QuestDB ingestion will be designed separately after the JSON and CSV files are stable.

## Source

Base source URL:

```text
https://www.chartmill.com/stock/markets/usa/index/russell-3000?p=0
```

The current page plan is fixed to five URLs:

```text
https://www.chartmill.com/stock/markets/usa/index/russell-3000?p=0
https://www.chartmill.com/stock/markets/usa/index/russell-3000?p=1
https://www.chartmill.com/stock/markets/usa/index/russell-3000?p=2
https://www.chartmill.com/stock/markets/usa/index/russell-3000?p=3
https://www.chartmill.com/stock/markets/usa/index/russell-3000?p=4
```

ChartMill renders the stock table with JavaScript and may show a security verification page to simple HTTP clients. Use Playwright rather than `curl` or static HTML fetching.

## Implemented Files

Main scraper:

```text
batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs
```

Generated JSON output:

```text
batch-jobs/russell3000-symbol-scrape/russell3000_list.json
```

Generated CSV output:

```text
batch-jobs/russell3000-symbol-scrape/russell3000_current.csv
```

## How To Run

From the project root:

```bash
node batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs
```

Default behavior:

- Scrapes pages `0,1,2,3,4`.
- Writes `russell3000_list.json` beside the script.
- Writes `russell3000_current.csv` beside the script.

Useful options:

```bash
node batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs \
  --pages 0 \
  --json-output /tmp/russell3000_list.json \
  --csv-output /tmp/russell3000_current.csv
```

CLI options:

```text
--json-output PATH      Write full Russell 3000 records as JSON.
--csv-output PATH       Write simplified symbol universe CSV.
--pages 0,1,2,3,4       Comma-separated ChartMill page indexes.
--timeout-ms NUMBER     Page timeout in milliseconds.
--retries NUMBER        Retry each page after table-load failures.
--delay-ms NUMBER       Delay between page requests in milliseconds.
--headful               Show the browser window instead of running headless.
--help                  Show help text.
```

`--output` is also accepted as a backwards-compatible alias for `--json-output`.

## Scraper Design

The scraper uses Playwright Chromium with a normal desktop user agent.

Important implementation decision:

```text
Use a fresh browser context for each ChartMill page.
```

Reason:

- Scraping page `p=0` and then reusing the same browser page for `p=1` can trigger ChartMill's security verification page.
- Individual page scrapes work more reliably.
- A fresh browser context per page keeps the scraper simple and avoids leaking page/session state between paginated requests.

The scraper also includes:

- A default retry count of `2` per page.
- A default delay of `1500 ms` between pages.
- Error messages that include the failing ChartMill URL and a short page title/body snippet when possible.
- Deduplication by `symbol`.
- Rank recalculation after dedupe.

## Table Targeting

The scraper should not use a broad selector such as:

```css
table
```

The current ChartMill page has one primary stock table, but a broad selector could silently scrape the wrong table if ChartMill adds another table above it.

Use the narrower selector:

```css
app-large-table-view table.cm-table
```

This matches the rendered ChartMill large table component:

```html
<app-large-table-view>
  <table approutedirective="" class="cm-table">
```

Do not depend on the `approutedirective` attribute unless required. It appears to be a framework/internal Angular attribute and is likely less meaningful than the component tag plus the stable `cm-table` class.

The scraper also validates the table header row before extracting data. This gives two safeguards:

- The CSS selector targets the intended ChartMill large table.
- Header validation fails fast if ChartMill changes the table shape.

## Source Table Columns

ChartMill table columns currently scraped:

```text
Symbol
Company
Market Cap
Weight
TA Rating
FA Rating
Div %
% Chg
3M %
1Y %
PE
Analysts
```

## JSON Output Design

The JSON file preserves the richer scrape result.

Example record:

```json
{
  "rank": 1,
  "symbol": "NVDA",
  "companyName": "NVIDIA CORP",
  "marketCap": "4.97T",
  "weight": "6.09%",
  "taRating": "9 / 10",
  "faRating": "9 / 10",
  "dividendYield": "0.46%",
  "changePercent": "3.54%",
  "3monthChange": "23.02%",
  "1yearChange": "47.69%",
  "peRatio": "36.38",
  "analystRating": "85.29"
}
```

Fields intentionally not included:

```text
page
profileUrl
sourceUrl
```

The keys `3monthChange` and `1yearChange` are valid JSON keys. In JavaScript they must be accessed with bracket notation:

```js
record["3monthChange"];
record["1yearChange"];
```

## CSV Output Design

The CSV file is the simplified Russell 3000 universe file.

CSV columns:

```text
symbol,provider_symbol,name,exchange,currency,sector,industry
```

Column mapping:

```text
symbol          = scraped symbol
provider_symbol = scraped symbol
name            = scraped company name
exchange        = blank
currency        = blank
sector          = blank
industry        = blank
```

Example:

```csv
symbol,provider_symbol,name,exchange,currency,sector,industry
NVDA,NVDA,NVIDIA CORP,,,,
GOOGL,GOOGL,ALPHABET INC-CL A,,,,
GOOG,GOOG,ALPHABET INC-CL C,,,,
AAPL,AAPL,APPLE INC,,,,
MSFT,MSFT,MICROSOFT CORP,,,,
```

This CSV shape intentionally matches the existing universe files used by market-data jobs, such as:

```text
services/market-api/app/data/sp500_current.csv
```

That makes `russell3000_current.csv` a natural future input for backfill, refresh, or QuestDB ingestion workflows.

## Verification

Verified on 2026-06-15:

```bash
node --check batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs
node batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs
```

Result:

```text
Wrote 2892 Russell 3000 records
JSON: batch-jobs/russell3000-symbol-scrape/russell3000_list.json
CSV: batch-jobs/russell3000-symbol-scrape/russell3000_current.csv
```

CSV row count:

```text
2893 lines total
2892 data rows plus 1 header row
```

Observed page row counts during testing:

```text
p=0  600 rows
p=1  600 rows
p=2  600 rows
p=3  600 rows
p=4  492 rows
```

Selector hardening verified on 2026-06-15:

```bash
node --check batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs
node batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs \
  --pages 0 \
  --json-output /private/tmp/russell3000-selector-check.json \
  --csv-output /private/tmp/russell3000-selector-check.csv
```

Result:

```text
The selector app-large-table-view table.cm-table matched the intended ChartMill table.
Header validation passed.
Page p=0 wrote 600 records.
```

Note:

The Russell 3000 name suggests approximately 3000 stocks, but ChartMill exposed 2892 rows across pages `p=0` through `p=4` during the 2026-06-15 verification run.

## Next Phase: QuestDB Ingest

Do not couple QuestDB ingest directly into the scraper yet.

Recommended next phase:

- Treat `russell3000_current.csv` as a source universe file.
- Decide whether the universe belongs in QuestDB, Postgres, or only filesystem artifacts.
- If QuestDB is used, create a small reference table for symbol universe snapshots.
- Include `universe_id`, probably `russell3000_current`.
- Include `snapshot_ts` so historical universe changes can be tracked.
- Add a wrapper under `batch-jobs/russell3000-symbol-scrape/bin/` only after the ingest contract is clear.

Possible future QuestDB table concept:

```sql
CREATE TABLE IF NOT EXISTS equity_universe_members (
  snapshot_ts TIMESTAMP,
  universe_id SYMBOL CAPACITY 256,
  symbol SYMBOL CAPACITY 8192,
  provider_symbol SYMBOL CAPACITY 8192,
  name STRING,
  exchange SYMBOL CAPACITY 256,
  currency SYMBOL CAPACITY 16,
  sector SYMBOL CAPACITY 1024,
  industry SYMBOL CAPACITY 2048,
  source SYMBOL CAPACITY 256,
  run_id SYMBOL CAPACITY 256
) TIMESTAMP(snapshot_ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(snapshot_ts, universe_id, symbol);
```

Open decision:

```text
Should the current universe be stored as a dated snapshot every scrape, or should the default policy skip insert when the same universe_id + symbol already exists?
```
