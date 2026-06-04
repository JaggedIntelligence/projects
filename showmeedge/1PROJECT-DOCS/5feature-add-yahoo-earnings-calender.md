# Feature Plan: Yahoo Earnings Calendar Batch Job

## Goal

Ingest Yahoo Finance earnings calendar data into QuestDB as a small, restartable batch workflow.

This is not a web UI feature. It is a production batch job with two modes:

- Historical backfill: ingest many years of earnings calendar rows.
- End-of-day refresh: refresh a recent and upcoming window after market close.

The workflow should stay simple. Earnings calendar volume is low: roughly `5000 symbols * 30 years * 4 quarters = 600,000 rows`. That is small for QuestDB and small enough that we do not need heavy queueing, symbol-level retry, or high-throughput ingestion clients.

## Current Finding

Yahoo Finance earnings calendar pages are JavaScript-rendered. Direct HTML fetches are not reliable for this page because Yahoo may return an app shell, default/failsafe content, or markup that does not match the rendered historical date.

Playwright + Chromium is the correct scraper foundation for now because it renders the same page state the browser user sees.

Validated page families:

```text
https://finance.yahoo.com/calendar/earnings?from=2026-04-05&to=2026-04-11&day=2026-04-07
https://finance.yahoo.com/calendar/earnings?from=2026-04-19&to=2026-04-25
```

## Key Design Decision

Split the system into two distinct jobs:

```text
generate-manifest.mjs
  discovers which dates have earnings and generates final paginated Yahoo URLs

ingest-manifest.mjs
  reads those URLs, scrapes earnings table rows, inserts into QuestDB, retries by date
```

This keeps URL discovery and data ingestion separate.

The current prototype names map to the production names like this:

```text
scripts/yahoo-earnings-calendar/driver-code.mjs
  -> batch-jobs/yahoo-earnings-calendar/generate-manifest.mjs

scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs
  -> batch-jobs/yahoo-earnings-calendar/ingest-manifest.mjs
```

## Proposed Folder Structure

Move this workflow out of `scripts/` and into a root-level batch job folder:

```text
batch-jobs/
  yahoo-earnings-calendar/
    README.md

    generate-manifest.mjs
    ingest-manifest.mjs

    lib/
      dates.mjs
      yahoo-calendar-carousel.mjs
      yahoo-earnings-table.mjs
      questdb.mjs
      retry.mjs
      run-log.mjs

    sql/
      yahoo_earnings_calendar.sql

    bin/
      backfill-range.sh
      refresh-eod.sh

    runs/
      .gitkeep
```

`runs/` should be gitignored except for `.gitkeep`.

Example run folder:

```text
batch-jobs/yahoo-earnings-calendar/runs/20260603-170000/
  manifest.jsonl
  ingest.log.jsonl
  failed-dates.jsonl
  summary.json
```

## Manifest Generator

`generate-manifest.mjs` owns date discovery and final Yahoo URL generation.

Responsibilities:

- Accept `--from YYYY-MM-DD` and `--to YYYY-MM-DD`.
- Convert the requested range into strict Sunday-to-Saturday weekly ranges.
- Open each weekly Yahoo earnings calendar page.
- Find the earnings date carousel:

```text
data-testid="carousel-container"
data-testid="calendar-event-pill"
```

- Extract only dates with earnings.
- Extract the earnings count for each date.
- Generate paginated URLs for each date using `offset=0,100,200...` and `size=100`.
- Write one JSONL manifest record per earnings date.

Example manifest row:

```json
{"date":"2026-04-23","from":"2026-04-19","to":"2026-04-25","expectedCount":149,"urls":["https://finance.yahoo.com/calendar/earnings?from=2026-04-19&to=2026-04-25&day=2026-04-23&offset=0&size=100","https://finance.yahoo.com/calendar/earnings?from=2026-04-19&to=2026-04-25&day=2026-04-23&offset=100&size=100"]}
```

The manifest is grouped by date because retry is date-based.

## Ingest Worker

`ingest-manifest.mjs` owns table scraping and QuestDB insertion.

Responsibilities:

- Accept `--manifest path/to/manifest.jsonl`.
- Read one date manifest record at a time.
- For that date, scrape every URL in `urls`.
- Combine all rows for the date.
- Validate row count against `expectedCount` when present.
- Insert rows into QuestDB.
- Retry the whole date if any URL, parse, validation, or DB insert step fails.
- Write JSONL operational logs.
- Write failed date records after max attempts.

Important: there should be no symbol-level retry. If one date fails, retry the whole date.

This is intentionally conservative because the unit of Yahoo calendar discovery is date, and QuestDB dedup/upsert makes date reruns safe.

## Scraped Row Shape

Each earnings row should normalize to:

```json
{
  "date": "2026-04-23",
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "eventName": "Q2 2026 Earnings Announcement",
  "earningsCallTime": "AMC",
  "epsEstimate": 1.62,
  "reportedEps": null,
  "surprisePercent": null,
  "marketCap": "3.10T",
  "sourceUrl": "https://finance.yahoo.com/calendar/earnings?from=2026-04-19&to=2026-04-25&day=2026-04-23&offset=0&size=100"
}
```

Current extraction fields from the prototype:

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

Keep `marketCap` as display text for now. We can normalize it later if needed.

## QuestDB Table

Use a single QuestDB data table for the actual earnings calendar records:

```sql
CREATE TABLE IF NOT EXISTS yahoo_earnings_calendar (
  earnings_ts TIMESTAMP,
  symbol SYMBOL,
  company_name STRING,
  event_name STRING,
  earnings_call_time SYMBOL,
  eps_estimate DOUBLE,
  reported_eps DOUBLE,
  surprise_percent DOUBLE,
  market_cap STRING,
  source_url STRING,
  scraped_at TIMESTAMP,
  run_id SYMBOL
) TIMESTAMP(earnings_ts)
PARTITION BY MONTH
WAL
DEDUP UPSERT KEYS(earnings_ts, symbol);
```

Use `earnings_ts` as midnight UTC for the earnings date.

Logical uniqueness is:

```text
earnings_ts + symbol
```

That makes repeated runs safe. If a date partially inserts and then fails, retrying the whole date should converge to the same final state.

## QuestDB Ingestion Method

Use Node.js PGWire via the existing `postgres` npm package.

Connection:

```text
postgres://admin:quest@localhost:8812/qdb
```

Default env var:

```text
QUESTDB_URL=postgres://admin:quest@localhost:8812/qdb
```

Reasoning:

- The data volume is low.
- The repo already uses the `postgres` package.
- PGWire is simple for table creation, health checks, inserts, and verification.
- We do not need QuestDB ILP ingestion for roughly 600k historical rows plus a small daily refresh.

Use PGWire for:

- `CREATE TABLE IF NOT EXISTS`
- `SELECT 1` health check
- date-level batch inserts
- optional post-insert verification

Do not add `@questdb/nodejs-client` unless this workflow later becomes much larger or more frequent.

## Operational Logs

Use JSONL run files instead of a QuestDB ingest-attempts table for now.

Reasoning:

- Ingest attempts are operational metadata, not market data.
- JSONL is easier to inspect, archive, delete, and attach to a failed run.
- The job volume is low.
- A DB attempts table can be added later if we need dashboards or queryable operational history.

Example success log line:

```json
{"event":"date_success","runId":"20260603-170000","date":"2026-04-23","attempt":1,"expectedCount":149,"actualCount":149,"insertedRows":149}
```

Example failure log line:

```json
{"event":"date_failed","runId":"20260603-170000","date":"2026-04-23","attempt":3,"error":"Timed out waiting for earnings table","urls":["https://finance.yahoo.com/calendar/earnings?from=2026-04-19&to=2026-04-25&day=2026-04-23&offset=0&size=100"]}
```

Example summary:

```json
{
  "runId": "20260603-170000",
  "datesTotal": 20,
  "datesSucceeded": 19,
  "datesFailed": 1,
  "rowsScraped": 842,
  "rowsInserted": 842
}
```

## Retry Model

Retry unit:

```text
date
```

Not:

```text
symbol
URL page
table row
```

Recommended defaults:

```text
max attempts: 3
backoff: 10s, 30s, 90s
small delay between Yahoo page requests
```

A date fails when:

- Any URL for the date fails to load.
- The earnings table cannot be found.
- The table shape is invalid.
- Combined rows do not match `expectedCount`.
- QuestDB insert fails.

After max attempts, write a record to:

```text
failed-dates.jsonl
```

Failed records should include:

```text
runId
date
from
to
expectedCount
urls
attempts
lastError
```

This makes retrying failed dates straightforward: feed `failed-dates.jsonl` back into the ingest job or regenerate a manifest for those dates.

## Historical Backfill

Wrapper:

```text
batch-jobs/yahoo-earnings-calendar/bin/backfill-range.sh
```

Example:

```bash
bash batch-jobs/yahoo-earnings-calendar/bin/backfill-range.sh \
  --from 1995-01-01 \
  --to 2026-06-03
```

Wrapper responsibilities:

- Resolve repo root.
- Load `.env` if present.
- Create run folder.
- Start/check QuestDB if desired.
- Run manifest generation.
- Run manifest ingestion.
- Capture stdout/stderr to run logs.
- Write summary.

## End-Of-Day Refresh

Wrapper:

```text
batch-jobs/yahoo-earnings-calendar/bin/refresh-eod.sh
```

Recommended refresh window:

```text
today - 14 days through today + 45 days
```

Why:

- The past 14 days catches late reported EPS, surprise percent, and row revisions.
- The future 45 days keeps upcoming scheduled earnings fresh.
- QuestDB dedup/upsert makes reruns safe.

Example internal flow:

```bash
node batch-jobs/yahoo-earnings-calendar/generate-manifest.mjs \
  --from "$REFRESH_FROM" \
  --to "$REFRESH_TO" \
  --output "$RUN_DIR/manifest.jsonl"

node batch-jobs/yahoo-earnings-calendar/ingest-manifest.mjs \
  --manifest "$RUN_DIR/manifest.jsonl" \
  --max-attempts 3 \
  --log "$RUN_DIR/ingest.log.jsonl" \
  --failed "$RUN_DIR/failed-dates.jsonl" \
  --summary "$RUN_DIR/summary.json"
```

## Scheduling

Prefer cron or launchd calling the shell wrapper, not cron calling Node directly.

Reasoning:

- The shell wrapper can set environment, repo root, and log paths.
- It can prevent overlapping runs with a lock file.
- It can check QuestDB health before starting.
- It keeps the cron line simple.

Example cron:

```cron
0 17 * * 1-5 /Users/sreddy/projects/showmeedge/batch-jobs/yahoo-earnings-calendar/bin/refresh-eod.sh
```

This runs at 5:00 PM local machine time on weekdays. If running on a server with a different timezone, set the schedule explicitly for the desired post-market time.

## Failure Debug Artifacts

On scrape failures, optionally capture:

```text
requested URL
page title
body text preview
HTML snapshot
screenshot
network URLs matching finance.yahoo.com
```

Store these under the run folder, for example:

```text
runs/20260603-170000/debug/2026-04-23-attempt-2/
```

This helps diagnose Yahoo selector changes, consent pages, throttling, or partial rendering.

## Implementation Phases

### Phase 1: Move And Rename

- Create `batch-jobs/yahoo-earnings-calendar/`.
- Move the current prototypes into the new folder.
- Rename:
  - `driver-code.mjs` -> `generate-manifest.mjs`
  - `yahoo-earnings-calendar-backfill.mjs` -> `ingest-manifest.mjs`
- Add `runs/.gitkeep`.
- Add `.gitignore` rule for run outputs.

### Phase 2: Manifest Contract

- Make `generate-manifest.mjs` write date-grouped JSONL.
- Keep Playwright carousel extraction.
- Include expected count and all pagination URLs per date.
- Add basic tests or dry-run examples for date range splitting.

### Phase 3: Ingest Contract

- Make `ingest-manifest.mjs` read manifest JSONL.
- Scrape every URL for each date.
- Combine and validate rows.
- Add date-level retry.
- Write `ingest.log.jsonl`, `failed-dates.jsonl`, and `summary.json`.

### Phase 4: QuestDB Persistence

- Add SQL table file.
- Add `lib/questdb.mjs` using the existing `postgres` package.
- Ensure table exists before ingest.
- Insert rows via PGWire.
- Verify idempotent reruns.

### Phase 5: EOD Refresh Wrapper

- Add `bin/refresh-eod.sh`.
- Use `today - 14 days` through `today + 45 days`.
- Add lock file protection.
- Add run folder creation and log capture.
- Document cron/launchd usage.

## Open Questions

- Should the refresh window be `-14/+45`, or should future refresh be longer during earnings season?
- Should `market_cap` remain display text forever, or later become numeric value plus unit?
- Should we capture raw row JSON per run for audit/debug, or is QuestDB plus logs enough?
- Should failed dates be retried automatically in the next EOD run, or only by explicit operator command?
- Should this remain a standalone Node batch job long term, or eventually be exposed through the FastAPI market service for operational control?

## Current Recommendation

Keep it boring:

```text
batch-jobs/yahoo-earnings-calendar
  -> Playwright for Yahoo rendering
  -> JSONL manifest grouped by date
  -> date-level retry
  -> QuestDB PGWire inserts through postgres npm package
  -> JSONL operational logs
  -> shell wrappers for backfill and EOD refresh
```

This is enough structure for production without making a small quarterly-data workflow feel like a distributed data platform.
