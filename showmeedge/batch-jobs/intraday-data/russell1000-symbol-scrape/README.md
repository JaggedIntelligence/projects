# Russell 1000 Symbol Scraper

This batch job downloads the Russell 1000 constituents table from Wikipedia and writes the table values to a CSV file.

Source page:

- <https://en.wikipedia.org/wiki/Russell_1000_Index>
- HTML table selector: `table#constituents`

## Requirements

- Node.js
- Project dependencies installed from the repository root (`pnpm install`)

The scraper uses Node's built-in `fetch` and the project's `jsdom` dependency. It does not require Playwright or a browser.

## Running the scraper

From the repository root:

```bash
node batch-jobs/intraday-data/russell1000-symbol-scrape/russell1000-symbol-scrape.mjs
```

From this scraper's directory:

```bash
node russell1000-symbol-scrape.mjs
```

The default output is:

```text
russell1000_current.csv
```

Each run overwrites the existing CSV so that the file represents the current snapshot from Wikipedia.

## CSV columns

| Column | Description |
| --- | --- |
| `company` | Company name |
| `symbol` | Stock ticker symbol |
| `gics_sector` | GICS sector |
| `gics_sub_industry` | GICS sub-industry; may be blank in the source table |

Example:

```csv
company,symbol,gics_sector,gics_sub_industry
3M,MMM,Industrials,Industrial Conglomerates
A. O. Smith,AOS,Industrials,Building Products
```

## Options

Write to a different CSV path:

```bash
node russell1000-symbol-scrape.mjs --csv-output /tmp/russell1000.csv
```

`--output` is an alias for `--csv-output`.

Scrape a different page with the same table structure:

```bash
node russell1000-symbol-scrape.mjs --url https://example.com/page
```

Show command help:

```bash
node russell1000-symbol-scrape.mjs --help
```

## Validation

The job stops with an error instead of writing misleading data when:

- the page cannot be downloaded;
- `table#constituents` is missing;
- the expected four table headers have changed;
- a data row has an unexpected number of cells;
- a company, symbol, or sector is missing; or
- a ticker symbol appears more than once.

Blank GICS sub-industry values are allowed because they occur in the Wikipedia source table.
