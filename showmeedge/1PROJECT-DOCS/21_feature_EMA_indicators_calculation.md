# Feature: Daily EMA and Close-Change Indicators

Date: 2026-09-12

## Goal

Extend the QuestDB `equity_ohlcv_daily` table with reusable exponential moving-average indicators for daily price and volume data, plus the daily percentage change in raw closing price.

The implemented indicators are:

| Column | Source value | Period |
| --- | --- | ---: |
| `ema10` | Adjusted close, falling back to close | 10 trading observations |
| `ema20` | Adjusted close, falling back to close | 20 trading observations |
| `ema50` | Adjusted close, falling back to close | 50 trading observations |
| `ema200` | Adjusted close, falling back to close | 200 trading observations |
| `volema10` | Volume | 10 trading observations |
| `volema20` | Volume | 20 trading observations |
| `close_change_pct` | Raw close versus the previous trading observation | 1 trading observation |

This feature also provides:

- A QuestDB-specific base schema and migration file.
- A repeatable migration command for existing and new installations.
- A standalone indicator-calculation batch job.
- Automatic EMA calculation after a successful end-of-day OHLCV refresh.
- An optional full recalculation mode.

## Current Status

The feature is implemented.

All seven indicator columns have been added to the local QuestDB table. Both migrations were applied and verified as rerunnable against QuestDB `9.3.5`.

The initial full historical calculation was intentionally not started during implementation verification. At the time the migration was applied, `equity_ohlcv_daily` contained approximately 13.56 million rows. The standalone batch command described below should be used when the full calculation is ready to run.

## Database Ownership

`equity_ohlcv_daily` is a QuestDB table. It is not owned by PostgreSQL or Drizzle.

The project now keeps the database responsibilities separate:

```text
PostgreSQL application schema
  -> db/init.sql
  -> drizzle/
  -> drizzle.config.ts

QuestDB market-data schema
  -> db/questdb/init.sql
  -> db/questdb/migrations/
  -> services/market-api/app/repositories/questdb_daily_bars.py
```

Although QuestDB supports PostgreSQL Wire Protocol connections, it is not PostgreSQL. The existing Drizzle configuration points to the PostgreSQL application schema, so the QuestDB migration is deliberately not stored in `drizzle/`.

## Updated QuestDB Table

The logical table definition is now:

```sql
CREATE TABLE IF NOT EXISTS equity_ohlcv_daily (
  ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  provider_symbol SYMBOL CAPACITY 1024,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  adj_close DOUBLE,
  volume LONG,
  close_change_pct DOUBLE,
  ema10 DOUBLE,
  ema20 DOUBLE,
  ema50 DOUBLE,
  ema200 DOUBLE,
  volema10 DOUBLE,
  volema20 DOUBLE,
  currency SYMBOL CAPACITY 8,
  ingested_at TIMESTAMP
) TIMESTAMP(ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(ts, symbol, provider);
```

All seven indicator columns are nullable `DOUBLE` values.

They are nullable because:

- The schema migration adds empty columns to existing historical rows.
- Daily OHLCV ingestion does not calculate indicators inline.
- The separate daily indicator job calculates values after ingestion.
- The first row in each symbol/provider series has no previous close, so `close_change_pct` remains null.
- A missing source price or volume may leave an indicator empty.

Volume is stored as `LONG`, but its EMA is stored as `DOUBLE` because exponential smoothing normally produces fractional results.

## EMA Definition

QuestDB's native period-based EMA window function is used:

```sql
avg(value, 'period', N) OVER (
  PARTITION BY symbol, provider
  ORDER BY ts
)
```

The smoothing factor for a period `N` is:

```text
alpha = 2 / (N + 1)
```

Each subsequent value is calculated as:

```text
EMA(current) = alpha * current_value + (1 - alpha) * EMA(previous)
```

QuestDB initializes a series from its first non-null value. Therefore, an `ema200` value can exist before a symbol has 200 rows. The period controls the smoothing factor; it is not a rule requiring the first 199 results to be null.

The periods count ordered trading observations. Weekends and market holidays do not create synthetic rows and do not count as EMA periods.

## Daily Close-Change Definition

`close_change_pct` uses raw `close` values:

```text
((current_close / previous_close) - 1) * 100
```

QuestDB obtains `previous_close` with:

```sql
lag(close) OVER (
  PARTITION BY symbol, provider
  ORDER BY ts
)
```

The stored value is expressed in percentage points: `5.0` means a positive five-percent change. The first row in each symbol/provider series remains null. A row also remains null when its current close is missing or its previous close is missing or zero.

This column intentionally uses raw `close`, not `adj_close`. Corporate actions such as splits can therefore appear as large raw close changes. A separate adjusted-close return column can be added later if needed.

## Price Selection

Price EMAs use:

```sql
coalesce(adj_close, close)
```

`adj_close` is preferred because it incorporates provider adjustments for events such as splits and dividends. `close` is the defensive fallback for a row where adjusted close is unavailable.

This choice is consistent with the project's existing seasonality calculations, which also prefer adjusted close.

## Series Isolation

Every window calculation is partitioned by:

```text
symbol + provider
```

This prevents:

- One symbol's history from affecting another symbol.
- Values supplied by different providers from being mixed.

Rows are ordered by `ts` inside each series.

The identity also matches the table's deduplication key:

```sql
DEDUP UPSERT KEYS(ts, symbol, provider)
```

## Migration Design

### Base Schema

File:

```text
db/questdb/init.sql
```

This file contains the complete current table definition, including all six EMA columns and `close_change_pct`. A new machine can create the correct table directly without first creating an older version of the schema.

### Existing-Database Migration

File:

```text
db/questdb/migrations/0001_add_equity_ohlcv_daily_emas.sql
```

The migration contains one idempotent statement per column:

```sql
ALTER TABLE equity_ohlcv_daily ADD COLUMN IF NOT EXISTS ema10 DOUBLE;
```

Separate statements are used for each column because QuestDB does not apply a multi-column `ADD COLUMN` operation atomically.

The raw close-change column is added by:

```text
db/questdb/migrations/0002_add_equity_ohlcv_daily_close_change_pct.sql
```

### Migration Execution

The following command starts the required infrastructure, waits for QuestDB, applies the base schema, and then applies migration files in filename order:

```bash
pnpm run questdb:migrate
```

The existing initialization commands also apply the QuestDB schema:

```bash
pnpm run db:init
pnpm run db:reset
```

The migration helper uses the `psql` client in the project's PostgreSQL container to connect to QuestDB over PGWire. This avoids requiring a separate host-level PostgreSQL client installation.

The migration flow is intentionally small and does not maintain a separate migration-history table. Before executing each additive migration statement, the helper checks `table_columns` and skips columns that already exist. The SQL files also retain `IF NOT EXISTS` so their intent remains explicit.

### Runtime Schema Safety

The market API still protects itself at startup.

Its startup sequence:

1. Creates `equity_ohlcv_daily` when the table does not exist.
2. Reads the current table columns through QuestDB's `table_columns` function.
3. Adds only indicator columns that are genuinely missing.

The explicit column inspection is needed because the QuestDB `psycopg` path can report a no-op `ALTER TABLE ... IF NOT EXISTS` as an unsupported no-op operation for a WAL table.

## Calculation Architecture

The main implementation is:

```text
services/market-api/app/jobs/update_daily_emas.py
```

The operator-facing wrapper is:

```text
batch-jobs/equity-daily-indicators/update-emas.sh
```

High-level flow:

```text
Operator or EOD wrapper
  -> update-emas.sh
    -> starts QuestDB and market-api
    -> waits for QuestDB health
    -> runs app.jobs.update_daily_emas
      -> verifies/migrates the table schema
      -> resolves provider and optional symbols
      -> counts candidate rows
      -> calculates all six EMA windows and previous raw close
      -> appends complete replacement rows
      -> QuestDB WAL applies the rows
      -> DEDUP replaces rows with matching keys
```

## Why the Job Uses Insert and Deduplication

The initial design considered an SQL operation shaped like:

```sql
UPDATE target
SET ema10 = calculated.ema10
FROM calculated
WHERE target keys = calculated keys;
```

QuestDB `9.3.5` rejects joined `UPDATE` statements for WAL tables. The production table must remain WAL-enabled because deduplication depends on WAL.

The implemented solution follows QuestDB's append-oriented model:

1. Select every original source column.
2. Calculate the six EMA columns and `close_change_pct`.
3. Insert a complete new version of each selected row into the same table.
4. Preserve the original `ts`, `symbol`, and `provider` values.
5. Allow `DEDUP UPSERT KEYS(ts, symbol, provider)` to replace the older version.

QuestDB uses last-write-wins behavior for matching deduplication keys. Rerunning the calculation is therefore idempotent at the logical-row level.

The replacement insert preserves:

- OHLC prices.
- Adjusted close.
- Volume.
- Provider symbol.
- Currency.
- Original ingestion timestamp.
- The same designated timestamp and deduplication identity.

## Empty-Only Calculation

The default job updates rows where at least one eligible indicator is null:

```text
ema10
ema20
ema50
ema200
volema10
volema20
close_change_pct
```

When an indicator is missing, the job writes all seven indicator columns for that row. A missing `close_change_pct` is eligible only when the row has a current close and a nonzero previous close. This prevents the legitimate null on the first row of every series from being rewritten on every run.

A critical correctness rule is that the null-row filter is applied after the EMA window calculations.

Correct logical order:

```text
Read the complete selected symbol/provider history
  -> calculate cumulative EMA windows and lag(close)
    -> retain rows with at least one missing eligible indicator
      -> insert replacement rows
```

Filtering to null rows before running the window functions would be incorrect. An EMA for a new row depends on all earlier observations in that symbol/provider series, including rows whose EMA columns are already populated.

## Full Recalculation

The optional `--rebuild-all` flag recalculates every selected row, even when all seven stored values are already populated.

Example:

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh \
  --symbols AAPL \
  --rebuild-all
```

This is useful after:

- Correcting old source prices or volume.
- Changing the EMA definition.
- Repairing inconsistent indicator values.
- Receiving retroactive adjusted-close changes from the provider.

Without `--rebuild-all`, a historical source-price correction does not automatically invalidate already-populated future EMA rows unless those rows are refreshed and become null again.

## Standalone Operator Commands

### All yfinance Symbols

This processes every `yfinance` symbol in `equity_ohlcv_daily`:

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh
```

Use this command for the initial historical population. Because the table contains millions of rows, it should be run during a suitable maintenance window while QuestDB disk and WAL activity can be monitored.

### One Universe

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh \
  --universe sp500_current
```

### Selected Symbols

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh \
  --symbols AAPL MSFT SPY
```

### Small Smoke Test

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh \
  --universe sp500_current \
  --max-symbols 5
```

### Rebuild the Market API Image First

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh \
  --rebuild \
  --universe sp500_current
```

`--rebuild` is handled by the shell wrapper. The other arguments are passed to the Python job.

## Python Job Options

The Python module supports:

```text
--provider NAME
--symbols SYMBOL [SYMBOL ...]
--universe NAME
--max-symbols N
--rebuild-all
```

Default behavior:

```text
provider: yfinance
symbols: every matching table symbol
update mode: rows with at least one null EMA column
```

The job prints a JSON summary:

```json
{
  "event": "daily_ema_update_complete",
  "provider": "yfinance",
  "symbols": ["AAPL"],
  "rebuild_all": false,
  "candidate_rows": 7241,
  "remaining_missing_rows": 0
}
```

QuestDB applies WAL transactions asynchronously. Immediately after a large submission, `remaining_missing_rows` can temporarily reflect rows whose replacement versions are committed to WAL but have not yet been merged into table storage.

## End-of-Day Integration

The existing EOD wrapper now invokes the daily indicator job after a successful price refresh:

```text
batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh
```

Updated flow:

```text
Start services and check health
  -> refresh recent Yahoo daily bars
  -> copy ingestion reports
  -> verify recent OHLCV coverage
  -> stop if ingestion failed
  -> calculate missing price EMA, volume EMA, and close-change indicators
  -> stop if EMA calculation failed
  -> report successful EOD completion
```

The EOD wrapper passes its selected universe and optional `--max-symbols` limit to the indicator job. This keeps smoke tests small and prevents a limited EOD run from unexpectedly starting an all-symbol indicator calculation.

The EMA stage is not run when OHLCV ingestion reports a hard failure.

## EOD Logs

Each EOD run now includes:

```text
update.log
ema-update.log
verification.log
failed-symbols.json
no-data-symbols.json
run-summary.json
```

`ema-update.log` contains the indicator job's JSON summary and any QuestDB error returned during calculation.

## Interaction With OHLCV Upserts

The daily ingestion statement inserts only the original OHLCV and metadata columns. It does not supply EMA values.

When a recent row is refreshed with the same deduplication key, its replacement version therefore has null indicator columns. The EOD indicator step runs afterward and writes a second complete replacement containing the recalculated indicators.

This ordering is intentional:

```text
provider refresh
  -> source row becomes authoritative and indicator columns are empty
  -> daily indicator job reads the refreshed history
  -> indicator-enriched row becomes authoritative
```

## Main Files

| File | Responsibility |
| --- | --- |
| `db/questdb/init.sql` | Complete QuestDB base definition for `equity_ohlcv_daily`. |
| `db/questdb/migrations/0001_add_equity_ohlcv_daily_emas.sql` | Idempotently adds the six EMA columns to an existing table. |
| `db/questdb/migrations/0002_add_equity_ohlcv_daily_close_change_pct.sql` | Idempotently adds the daily raw close-change column. |
| `scripts/db-init.sh` | Waits for QuestDB and applies its base schema and ordered migrations. |
| `package.json` | Exposes `pnpm run questdb:migrate`. |
| `services/market-api/app/repositories/questdb_daily_bars.py` | Runtime table definition and missing-column startup migration. |
| `services/market-api/app/jobs/update_daily_emas.py` | Builds and executes the price/volume EMA and close-change calculations. |
| `batch-jobs/equity-daily-indicators/update-emas.sh` | Standalone Docker-aware operator wrapper. |
| `batch-jobs/equity-daily-indicators/README.md` | Short command reference for the batch job. |
| `batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh` | Runs the daily indicator job after successful EOD ingestion. |
| `services/market-api/tests/test_daily_emas.py` | Focused schema and generated-SQL tests. |

No Next.js API response model or chart UI was changed. The indicators are stored in QuestDB and are available to SQL queries, but exposing them through typed API responses or chart overlays is a separate future feature.

## Verification Performed

The implementation was verified with:

- Shell syntax checks for the migration and batch wrappers.
- Python compilation checks.
- Focused unit tests for all seven indicator columns and generated SQL.
- Applying `pnpm run questdb:migrate` to the running local QuestDB.
- Querying `SHOW COLUMNS FROM equity_ohlcv_daily` and confirming all seven indicator columns exist.
- Rebuilding and restarting the market API.
- Checking the market API QuestDB health endpoint.
- An isolated QuestDB WAL-table integration test.

The integration test used three rows and verified calculated values including:

```text
third-row ema10    = 52.56198347107437
third-row volema10 = 1512.3966942148759
```

The isolated test also confirmed that inserting calculated replacement rows into a WAL table and allowing deduplication to replace the earlier rows works correctly.

A second isolated WAL-table test verified the raw daily close-change cases:

```text
first row                           -> NULL
100 to 105                         -> 5.0
105 to 0                           -> -100.0
previous close 0, current close 10 -> NULL
```

The complete market API unit-test run produced 23 passing tests and one unrelated existing seasonality endpoint failure under the freshly resolved FastAPI version. The focused EMA tests passed.

## Operational Considerations

### Initial Historical Run

The first all-history calculation is the largest operation because every existing row has empty indicator columns. It will:

- Scan the selected history for all six window calculations.
- Write replacement versions for all selected rows.
- Produce WAL traffic.
- Merge out-of-order historical rows into monthly partitions.
- Use deduplication to replace the old logical rows.

Run it during a period when higher database I/O is acceptable.

### Normal EOD Runs

After the initial population, normal EOD runs should have far fewer candidate rows. Recent OHLCV rows refreshed by the provider become the normal indicator workload.

The calculation still reads complete history for each selected symbol because that history is needed for an exact cumulative EMA. It writes only rows selected by the empty-column filter.

### Repeated Runs

Repeated runs are logically safe:

- Schema migration statements are idempotent.
- Runtime migration adds only missing columns.
- The calculation preserves row identity.
- QuestDB deduplication replaces matching rows instead of retaining logical duplicates.

### Provider Adjustments

Adjusted-close history can change retroactively after corporate actions or provider corrections. Empty-only mode does not discover every downstream stale EMA automatically. Use `--rebuild-all` for the affected symbols when historical adjusted prices have materially changed.

## Known Limitations

- The first historical run can be resource-intensive.
- WAL application is asynchronous, so immediate post-insert counts may briefly lag.
- The default job calculates exact cumulative EMAs by scanning full selected histories rather than persisting a separate per-symbol EMA seed.
- No scheduler was added. The job is invoked by the existing EOD wrapper or manually.
- No API or UI fields were added for displaying these indicators.
- There is no automatic corporate-action invalidation mechanism for already-populated future EMA rows.
- A migration-history table is not currently maintained; migrations must remain safely rerunnable.

## Possible Future Improvements

- Add an explicit scheduler for periodic or after-market execution.
- Add date-aware invalidation when old adjusted-close data changes.
- Persist per-symbol EMA state to reduce full-history reads for incremental updates.
- Add WAL-apply progress waiting and richer run metrics.
- Split very large initial calculations into controlled symbol batches.
- Expose selected indicator columns through the market-data API.
- Add price and volume EMA overlays to the NightVision chart.
- Add comparisons such as `close > ema200` or `volema10 > volema20` to screeners and backtests.

## References

- QuestDB EMA window functions: https://questdb.com/docs/query/functions/window-functions/reference/
- QuestDB `lag()` window function: https://questdb.com/docs/query/functions/window-functions/reference/#lag
- QuestDB `ALTER TABLE ADD COLUMN`: https://questdb.com/docs/query/sql/alter-table-add-column/
- QuestDB `INSERT`: https://questdb.com/docs/query/sql/insert/
- QuestDB deduplication: https://questdb.com/docs/concepts/deduplication/
- QuestDB WAL: https://questdb.com/docs/concepts/write-ahead-log/
