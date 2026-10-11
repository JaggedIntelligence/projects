# Feature: IPO Table Scrape

Date: 2026-06-25

## Goal

Create a small batch job that scrapes IPO symbol table data from StockAnalysis and writes a normalized CSV file for downstream workflows.

First phase scope:

- Scrape the StockAnalysis IPO table for a selected year and page.
- Target the table with the HTML selector `table#main-table`.
- Extract visible table rows into CSV.
- Normalize dates to ISO format.
- Normalize prices and percentage returns to plain numeric values.
- Append data rows when the CSV already exists, so multiple page runs can write to the same file.
- Do not insert into QuestDB yet.

QuestDB ingestion or downstream market-data ingestion can be designed separately after the CSV output is stable.

## Source

Default source URL:

```text
https://stockanalysis.com/ipos/2026/?page=1
```

The scraper builds URLs with this pattern:

```text
https://stockanalysis.com/ipos/{year}/?page={page}
```

Example page runs:

```text
https://stockanalysis.com/ipos/2026/?page=1
https://stockanalysis.com/ipos/2026/?page=2
https://stockanalysis.com/ipos/2026/?page=3
```

The StockAnalysis IPO page currently includes the target table in the server-rendered HTML. Because of that, this scraper uses `fetch()` plus `jsdom` instead of Playwright.

## Implemented Files

Main scraper:

```text
batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs
```

Default generated CSV output:

```text
batch-jobs/ipo-symbols-scrape/ipo_symbols_2026.csv
```

## How To Run

From the project root:

```bash
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs
```

Default behavior:

- Scrapes `https://stockanalysis.com/ipos/2026/?page=1`.
- Writes `ipo_symbols_2026.csv` beside the script.
- Creates the CSV with a header if the file does not exist or is empty.
- Appends only data rows if the CSV already exists.

Run another page into the same CSV:

```bash
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --page 2
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --page 3
```

Run a different year:

```bash
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --year 2025
```

Use a specific output file:

```bash
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs \
  --year 2026 \
  --page 1 \
  --csv-output /tmp/ipo_symbols_2026.csv
```

CLI options:

```text
--csv-output PATH       Write normalized IPO table rows as CSV. Appends rows if the file exists.
--url URL               Scrape a specific StockAnalysis IPO page URL.
--year NUMBER           StockAnalysis IPO year to scrape.
--page NUMBER           StockAnalysis IPO page number to scrape.
--timeout-ms NUMBER     Fetch timeout in milliseconds.
--retries NUMBER        Retry after fetch failures.
--retry-delay-ms NUMBER Delay between retries in milliseconds.
--help                  Show help text.
```

`--output` is also accepted as an alias for `--csv-output`.

## Scraper Design

The scraper follows the structure of the Russell 3000 scraper where useful: named constants, CLI parsing, retry handling, header validation, CSV formatting, and a `main()` entry point.

Important implementation decision:

```text
Use static HTML fetching plus jsdom instead of Playwright.
```

Reason:

- The target IPO table is already present in the downloaded HTML.
- A browser is not required to wait for client-side table rendering.
- `jsdom` gives DOM-safe parsing without brittle regex extraction.
- The batch job stays faster and simpler than a browser-based scraper.

The scraper includes:

- A normal desktop user agent.
- A default fetch timeout of `60000 ms`.
- A default retry count of `2`.
- A default retry delay of `1500 ms`.
- Clear errors when the table is missing, headers change, dates fail to parse, or numeric fields fail to parse.

## Table Targeting

The scraper should not use a broad selector such as:

```css
table
```

The page contains other tables, including sidebar tables such as upcoming IPOs. A broad selector could silently scrape the wrong table.

Use the stable selector requested for this job:

```css
table#main-table
```

The target table currently appears as:

```html
<table id="main-table" class="symbol-table ...">
```

The scraper also validates the table header row before extracting data. This gives two safeguards:

- The CSS selector targets the intended StockAnalysis IPO table.
- Header validation fails fast if StockAnalysis changes the table shape.

## Source Table Columns

StockAnalysis IPO table columns currently scraped:

```text
IPO Date
Symbol
Company Name
IPO Price
Current
Return
```

## CSV Output Design

CSV columns:

```text
ipo_date,symbol,company_name,ipo_price,current,return
```

Column mapping:

```text
ipo_date     = IPO Date, normalized to YYYY-MM-DD
symbol       = Symbol, normalized to uppercase
company_name = Company Name
ipo_price    = IPO Price, numeric string without dollar sign or commas
current      = Current, numeric string without dollar sign or commas
return       = Return, numeric string without percent sign
```

Example source row:

```text
Jun 23, 2026 | GHXI | Gores Holdings XI, Inc. | $10.00 | $10.04 | 0.50%
```

Example CSV row:

```csv
2026-06-23,GHXI,"Gores Holdings XI, Inc.",10.00,10.04,0.50
```

Blank or dash numeric values are written as blank CSV fields.

## Append Behavior

The CSV writer is append-aware.

If the output file does not exist or is empty:

```text
write header row
write scraped data rows
```

If the output file already exists and has content:

```text
append scraped data rows only
```

This supports page-by-page runs into the same file:

```bash
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --page 1
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --page 2
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --page 3
```

The scraper does not currently deduplicate rows. Re-running the same page against the same CSV will append duplicate data. That behavior is intentional for this phase because the requested design is append-only for multi-page collection.

## Validation Rules

The scraper validates:

- `--year` must be an integer between `1900` and `2100`.
- `--page` must be a positive integer.
- `--timeout-ms` must be positive.
- `--retries` must be a non-negative integer.
- `--retry-delay-ms` must be a non-negative integer.
- The page must contain `table#main-table`.
- The table headers must match the expected IPO table headers.
- IPO dates must parse from `Mon DD, YYYY` to `YYYY-MM-DD`.
- Numeric fields must normalize to valid decimal strings after removing `$`, `%`, and commas.

## Verification

Verified on 2026-06-25:

```bash
node --check batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs --help
node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs
```

Live scrape result:

```text
Wrote 179 IPO records
CSV: /Users/sreddy/projects/showmeedge/batch-jobs/ipo-symbols-scrape/ipo_symbols_2026.csv
```

Append behavior was verified with a temporary CSV and saved StockAnalysis HTML:

```text
run 1: Wrote 179 IPO records
run 2: Appended 179 IPO records
lines=359
```

The 359 lines represent:

```text
1 header row + 179 first-run data rows + 179 appended data rows
```

## Future Enhancements

Possible next improvements:

- Add a `--pages 1,2,3` option to run multiple pages in one command.
- Add an optional dedupe mode keyed by `symbol` and `ipo_date`.
- Add JSON output if downstream workflows need the richer scrape result.
- Add ingestion into QuestDB or another market-data staging table.
