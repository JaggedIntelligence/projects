# Feature Plan: Industry Peers QuestDB Batch Job

## Goal

Ingest Yahoo Finance industry peer tickers into QuestDB as slow-changing reference data.

This is not a daily market-data refresh. Peer groups for a source ticker should change rarely, maybe once per year or less. A single successful insert can be useful for a long time.

Therefore the default behavior should be conservative:

- Load the current S&P 500 universe.
- Scrape Yahoo Finance peer groups for each source ticker.
- Insert peer rows into QuestDB only when that `source_ticker + program_id` does not already exist.
- Allow an explicit operator flag to insert a new snapshot when we intentionally want to refresh peer mappings.

## Key Decisions

### Source Universe

Use the same universe convention as the daily bars backfill:

```text
UNIVERSE="sp500_current"
```

This points to:

```text
services/market-api/app/data/sp500_current.csv
```

The CSV contains:

```text
symbol,provider_symbol,name,exchange,currency,sector,industry
```

For industry peers, the source ticker should come from `symbol`. If a future scraper needs Yahoo-specific symbols, it can use `provider_symbol`.

### Program ID

The shell wrapper should define the scraper/source identity as a variable:

```bash
PROGRAM_ID="yahoo-finance-compare-to"
```

This value is passed to Node as:

```bash
--program-id "$PROGRAM_ID"
```

The `program_id` is part of the existence check. This allows a future CNBC, Finviz, or custom peer source to coexist without blocking Yahoo peer inserts.

### Insert Policy

The shell wrapper should expose:

```bash
--record_insert_flag skip|newrecord
```

Default:

```bash
RECORD_INSERT_FLAG="skip"
```

Behavior:

- `skip`: if records already exist for `source_ticker + program_id`, do not scrape or insert that source ticker.
- `newrecord`: scrape and insert a new snapshot even when records already exist for `source_ticker + program_id`.

The skip check should be:

```sql
SELECT count()
FROM industry_peers
WHERE source_ticker = $1
  AND program_id = $2
```

Do not check only `source_ticker`, because another peer source may have records for the same ticker.

### Full Run Default

The default run should process all symbols in `sp500_current`.

A smoke-test limit is still useful:

```bash
--max-symbols 20
```

But no extra `--confirm-full-run` flag is required.

## Implementation Status

Status as of 2026-06-04:

- Batch wrapper implemented at `batch-jobs/industry-peers/bin/backfill-sp500-peers.sh`.
- Source ticker manifest generation implemented at `batch-jobs/industry-peers/generate-manifest.mjs`.
- Manifest ingestion and Yahoo peer scraping implemented at `batch-jobs/industry-peers/ingest-manifest.mjs`.
- QuestDB insert and skip check implemented in `batch-jobs/industry-peers/lib/questdb.mjs`.
- Source universe loading implemented in `batch-jobs/industry-peers/lib/symbols.mjs`.
- Run artifact helpers implemented in `batch-jobs/industry-peers/lib/run-log.mjs`.
- The older direct single-ticker CLI path was removed. One-ticker tests now use the same wrapper path with `--ticker`.

## QuestDB Table

The table lives at:

```text
batch-jobs/industry-peers/sql/industry_peers_table.sql
```

Current schema:

```sql
CREATE TABLE IF NOT EXISTS industry_peers (
  snapshot_ts TIMESTAMP,
  source_ticker SYMBOL CAPACITY 8192,
  peer_ticker SYMBOL CAPACITY 8192,
  rank INT,
  company_name STRING,
  industry SYMBOL CAPACITY 4096,
  program_id SYMBOL CAPACITY 256,
  run_id SYMBOL CAPACITY 256
) TIMESTAMP(snapshot_ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(snapshot_ts, source_ticker, peer_ticker);
```

Important implication:

```text
snapshot_ts is part of the dedup/upsert key.
```

So a new snapshot timestamp creates a new historical peer snapshot. This is correct for `newrecord`, but it means `skip` must use an explicit existence query by `source_ticker + program_id`.

## Implemented Folder Structure

Use a layout similar to `batch-jobs/yahoo-earnings-calendar`:

```text
batch-jobs/
  industry-peers/
    REAME.md

    generate-manifest.mjs
    ingest-manifest.mjs
    industry-peers.mjs

    bin/
      backfill-sp500-peers.sh

    lib/
      questdb.mjs
      run-log.mjs
      symbols.mjs

    sql/
      industry_peers_table.sql

    runs/
      .gitkeep
```

`runs/` should be gitignored except for `.gitkeep`.

Example run folder:

```text
batch-jobs/industry-peers/runs/20260604T180000Z/
  manifest.jsonl
  rows.jsonl
  ingest.log.jsonl
  failed-symbols.jsonl
  skipped-symbols.jsonl
  summary.json
  generate.log
  ingest.stdout.log
```

## Batch Wrapper

File:

```text
batch-jobs/industry-peers/bin/backfill-sp500-peers.sh
```

Default variables:

```bash
UNIVERSE="sp500_current"
PROGRAM_ID="yahoo-finance-compare-to"
RECORD_INSERT_FLAG="skip"
RUN_ROOT="$JOB_DIR/runs"
TIMEOUT_MS="60000"
MAX_ATTEMPTS="3"
REQUEST_DELAY_MS="0"
HEADFUL="false"
DRY_RUN="false"
START_QUESTDB="true"
MAX_SYMBOLS=""
MIN_SYMBOLS="450"
ALLOW_SMALL_UNIVERSE="false"
```

Responsibilities:

- Validate shell args.
- Load `.env` if present.
- Create a lock directory to prevent overlapping full runs.
- Start QuestDB unless `--no-start-questdb` or `--dry-run`.
- Validate that the universe CSV exists.
- Count symbols in the universe.
- Refuse unexpectedly small universes unless `--allow-small-universe` is passed.
- Create a timestamped run directory under `runs/`.
- Generate a source ticker manifest from `sp500_current.csv`.
- Ingest that manifest into QuestDB.
- Write stdout/stderr logs and JSON artifacts.
- Print final run directory.

Operator command:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh
```

Smoke test:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --ticker AAPL \
  --allow-small-universe \
  --dry-run
```

Small live insert:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --max-symbols 20
```

Force a new snapshot for all source tickers:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --record_insert_flag newrecord
```

Optional alias:

```bash
--record-insert-flag skip|newrecord
```

This can map to the same internal `RECORD_INSERT_FLAG` variable. The underscore form should exist because it is the requested operator flag.

## Manifest Generator

File:

```text
batch-jobs/industry-peers/generate-manifest.mjs
```

Responsibilities:

- Accept `--universe sp500_current`.
- Resolve `services/market-api/app/data/<universe>.csv`.
- Read source tickers from the CSV.
- Support `--ticker AAPL` through the same wrapper/manifest/ingest path for one-symbol debugging.
- Support `--max-symbols N` for smoke tests.
- Write one JSONL manifest row per source ticker.

Example manifest row:

```json
{
  "sourceTicker": "ZS",
  "providerSymbol": "ZS",
  "name": "Zscaler, Inc.",
  "sector": "Information Technology",
  "industry": "Systems Software",
  "universe": "sp500_current"
}
```

This file should not scrape Yahoo peer cards. It should only produce the driver manifest.

## Ingest Worker

File:

```text
batch-jobs/industry-peers/ingest-manifest.mjs
```

Responsibilities:

- Accept `--manifest PATH`.
- Accept `--program-id VALUE`.
- Accept `--record-insert-flag skip|newrecord`.
- Accept `--dry-run`.
- Accept retry controls:
  - `--max-attempts`
  - `--request-delay-ms`
  - `--timeout-ms`
- Read source ticker manifest rows.
- For each source ticker:
  - If `recordInsertFlag=skip`, check QuestDB for existing rows by `source_ticker + program_id`.
  - If rows exist, write a skipped record and move on.
  - Otherwise scrape Yahoo Finance peer cards.
  - Insert only the essential table columns into QuestDB.
  - Write scraped peer rows to `rows.jsonl`.
  - Write JSONL operational events to `ingest.log.jsonl`.
  - Write failed source tickers to `failed-symbols.jsonl`.

Retry should be source-ticker based:

```text
One source ticker fails -> retry that source ticker.
```

This is different from Yahoo earnings calendar, where retry is date-based.

## Scraped Row Shape

The scraper should collect only relationship/reference fields:

```json
{
  "sourceTicker": "ZS",
  "rank": 2,
  "peerTicker": "PANW",
  "companyName": "Palo Alto Networks, Inc.",
  "industry": "Software-Infrastructure"
}
```

QuestDB insert should use those same peer relationship fields plus run metadata:

```text
snapshot_ts
source_ticker
peer_ticker
rank
company_name
industry
program_id
run_id
```

Do not scrape, collect, write, or insert transient quote fields like `price`, `changePercent`, `marketCap`, `quoteUrl`, or `sourceUrl`.

Reason:

```text
This job stores peer relationships, not current quote state.
sourceUrl and quoteUrl can be derived from sourceTicker and peerTicker whenever needed.
```

## QuestDB Helper

File:

```text
batch-jobs/industry-peers/lib/questdb.mjs
```

Responsibilities:

- Create a PGWire client with default:

```text
postgres://admin:quest@127.0.0.1:8812/qdb
```

- Read and execute `sql/industry_peers_table.sql`.
- Ping QuestDB.
- Check existing peer rows:

```sql
SELECT count()
FROM industry_peers
WHERE source_ticker = $1
  AND program_id = $2
```

- Insert normalized industry peer rows.

Timestamp note:

Node `Date` binding can shift through local timezone when sent to QuestDB through the `postgres` client. Use an explicit UTC timestamp string with QuestDB `to_timestamp`:

```sql
to_timestamp($1, 'yyyy-MM-ddTHH:mm:ss.SSSUUUZ')
```

Example value:

```text
2026-06-04T18:00:00.000000Z
```

## Symbol Helper

File:

```text
batch-jobs/industry-peers/lib/symbols.mjs
```

Responsibilities:

- Resolve repo root relative paths.
- Read `services/market-api/app/data/<universe>.csv`.
- Parse CSV headers.
- Normalize symbols to uppercase.
- Preserve `provider_symbol`, `name`, `sector`, and `industry` for manifest context.
- Support `--ticker` filtering.
- Support `--max-symbols` truncation.

Use a small CSV parser or careful simple CSV parsing. The current S&P 500 file is simple, but using a parser is safer if names later contain commas.

## Run Log Helper

File:

```text
batch-jobs/industry-peers/lib/run-log.mjs
```

Responsibilities should mirror the earnings calendar helper:

- `createRunId()`
- `ensureParentDir(filePath)`
- `writeJsonFile(filePath, value)`
- `appendJsonLine(filePath, value)`
- `resetJsonlFile(filePath)`
- `readJsonlFile(filePath)`

## Summary Shape

`summary.json` should include:

```json
{
  "event": "industry_peers_ingest_complete",
  "runId": "20260604T180000Z",
  "universe": "sp500_current",
  "programId": "yahoo-finance-compare-to",
  "recordInsertFlag": "skip",
  "symbolsTotal": 503,
  "symbolsSucceeded": 490,
  "symbolsSkipped": 10,
  "symbolsFailed": 3,
  "rowsScraped": 4900,
  "rowsWritten": 4900,
  "rowsInserted": 4900,
  "dryRun": false,
  "startedAt": "2026-06-04T18:00:00.000Z",
  "finishedAt": "2026-06-04T18:20:00.000Z"
}
```

## Failure Behavior

The job should continue after a symbol failure.

For each failed source ticker, write:

```json
{
  "event": "source_ticker_failed",
  "runId": "20260604T180000Z",
  "sourceTicker": "ZS",
  "programId": "yahoo-finance-compare-to",
  "attempts": 3,
  "lastError": "..."
}
```

The final process should exit nonzero if any symbols fail.

This allows:

- usable partial output
- easy rerun
- shell visibility that the run needs review

## Verification Queries

After a run, useful QuestDB checks:

```sql
SELECT count(), count_distinct(source_ticker)
FROM industry_peers
WHERE program_id = 'yahoo-finance-compare-to';
```

Latest snapshot summary:

```sql
SELECT source_ticker, max(snapshot_ts), count()
FROM industry_peers
WHERE program_id = 'yahoo-finance-compare-to'
GROUP BY source_ticker
ORDER BY source_ticker;
```

One ticker:

```sql
SELECT source_ticker, peer_ticker, rank, company_name, industry, snapshot_ts
FROM industry_peers
WHERE source_ticker = 'ZS'
  AND program_id = 'yahoo-finance-compare-to'
ORDER BY rank;
```

## Implementation Phases

Phases 1 through 4 are implemented for the one-path wrapper/manifest/ingest workflow.

Completed verification:

- Syntax checks for the Node scripts and shell wrapper passed.
- Dry-run smoke test for `AAPL` passed.
- Live `--max-symbols 20` run passed and inserted 200 QuestDB rows.
- QuestDB verification for run `20260604T184610Z` returned 200 rows across 20 source tickers.

Remaining before a full production load:

- Run the default full S&P 500 command.
- Review the final full-run `failed-symbols.jsonl` and rerun if needed.
- Decide whether to schedule a yearly/manual refresh or leave this fully manual.

### Phase 1: Batch Skeleton

- Add `runs/.gitkeep`.
- Add `lib/run-log.mjs`.
- Add `lib/symbols.mjs`.
- Add manifest generation from `sp500_current.csv`.
- Add `bin/backfill-sp500-peers.sh`.

### Phase 2: QuestDB Ingest

- Extend `lib/questdb.mjs` with:
  - table ensure
  - existence check by `source_ticker + program_id`
  - normalized insert
- Add `ingest-manifest.mjs`.
- Implement `skip` and `newrecord` behavior.

### Phase 3: Reliability

- Add source-ticker retry.
- Add request delay.
- Add failed/skipped JSONL artifacts.
- Add run summary.
- Add wrapper lock directory.

### Phase 4: Verification And Smoke Run

- Run with:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --ticker AAPL \
  --allow-small-universe \
  --dry-run
```

- Run live with a small symbol count:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --max-symbols 20
```

- Verify QuestDB rows.
- Run full S&P 500 load when ready.

## Open Future Enhancements

- Add a yearly refresh automation if peer groups prove useful and stable.
- Add UI views that compare a source ticker against stored peer tickers.
- Add source confidence by comparing Yahoo against another peer source.
- Add a table or view for latest peer snapshot per `source_ticker + program_id`.
