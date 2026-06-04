# Feature: Failure-Safe S&P 500 Backfill

Date: 2026-06-02

This document records the design and implementation for a restartable S&P 500 daily-price backfill into QuestDB.

The goal is to make a full-universe yfinance backfill safe to run, safe to interrupt, and easy to restart.

## Why This Feature Exists

Backfilling the full current S&P 500 universe is different from loading a few symbols.

Expected scale:

```text
~500 companies
~503 tickers because some companies have multiple share classes
~4,100 daily bars per symbol from 2010-01-01 to 2026
~2 million rows
```

QuestDB can handle this size. The fragile part is the provider side:

- yfinance can timeout.
- One batch can fail while previous batches succeeded.
- Some symbols can return no data.
- Network requests can fail mid-run.
- The run may be interrupted by terminal, Docker, or local machine issues.

Therefore, the backfill must be restartable by design.

## Core Design

Use a two-layer design:

```text
batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh
  -> starts/checks Docker Compose services
  -> validates universe size
  -> creates timestamped logs
  -> invokes Python backfill CLI
  -> copies JSON reports
  -> verifies QuestDB row counts

services/market-api/app/jobs/backfill_daily.py
  -> resolves symbols
  -> skips completed symbols
  -> fetches yfinance batches
  -> retries failed batches
  -> retries missing symbols one by one
  -> writes bars to QuestDB
  -> writes failed-symbol JSON
  -> writes no-data-symbol JSON
  -> writes run-summary JSON

services/market-api/app/providers/yfinance_provider.py
  -> normalizes yfinance DataFrame shapes
  -> handles single-symbol and multi-symbol yfinance column layouts
  -> tolerates tiny OHLC provider drift
  -> skips materially invalid OHLC rows
```

Shell is used only as the operator wrapper. Python owns the data workflow because it has access to provider code, symbol mapping, models, and QuestDB repositories.

## QuestDB Restart Safety

The `equity_ohlcv_daily` table uses dedup/upsert keys:

```sql
DEDUP UPSERT KEYS(ts, symbol, provider)
```

This is what makes reruns safe.

If the same symbol/date/provider is inserted again, QuestDB dedup/upsert avoids creating duplicate logical rows. That means the recovery procedure can be simple:

```text
Rerun the same command.
```

If a symbol is already complete, the Python job can skip it. If it is incomplete or uncertain, it can be fetched again and written again.

## Files Added Or Updated

### Safe Wrapper Script

File:

```text
batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh
```

Responsibilities:

- Validate script arguments.
- Validate Docker Compose access.
- Optionally rebuild `market-api`.
- Start `questdb` and `market-api`.
- Wait for FastAPI `/health`.
- Wait for FastAPI `/questdb/health`.
- Count symbols in the selected universe.
- Refuse full-run mode when the universe is too small.
- Create a timestamped host log directory.
- Run `python -m app.jobs.backfill_daily` inside `market-api`.
- Copy failed-symbol, no-data-symbol, and run-summary files from the container to host logs.
- Run post-backfill QuestDB verification.
- Exit nonzero if Python backfill exits nonzero.

### Hardened Python Backfill CLI

File:

```text
services/market-api/app/jobs/backfill_daily.py
```

Added flags:

```text
--skip-existing
--coverage-stale-days
--retry-attempts
--retry-sleep-seconds
--sleep-seconds
--failed-symbols-file
--no-data-symbols-file
--run-summary-file
--max-symbols
```

Important behavior:

- `--skip-existing` checks QuestDB coverage before fetching a symbol.
- Completed symbols are skipped and logged as `symbol_skipped_existing`.
- When `--end` is provided, `--skip-existing` requires stored coverage to include the requested start/end window.
- Failed batches retry.
- If a batch still fails, each symbol is retried individually.
- Symbols that return no bars are reported separately as `no_data_symbols`.
- Symbols that fail because of exceptions after retries are reported as `failed_symbols`.
- Failed symbols, no-data symbols, and the final run summary are written to JSON.
- Final coverage is printed in the `backfill_complete` event.

### Documentation

File:

```text
scripts/README.md
```

The scripts README now includes the safe backfill command and smoke-test command.

### yfinance Provider Hardening

Files:

```text
services/market-api/app/providers/yfinance_provider.py
services/market-api/app/models.py
services/market-api/tests/test_yfinance_provider.py
```

The first full-universe run exposed two real provider-side issues:

- yfinance can return `MultiIndex` columns with the ticker on different column levels, including during single-symbol retries.
- Yahoo data can contain tiny high/low range inconsistencies from provider precision or floating-point drift.

Changes made:

- `_frame_for_symbol` now searches all `MultiIndex` column levels for the provider ticker.
- Single-symbol frames with one remaining ticker level are flattened before row parsing.
- `_bars_from_frame` normalizes tiny OHLC drift by expanding `high` or `low` only within a small relative tolerance.
- Materially invalid OHLC rows are skipped instead of inserted.
- `DailyOhlcvBar` includes a matching small OHLC tolerance as a model-level safety net.
- Provider tests cover the single-symbol `MultiIndex` shape and tiny OHLC drift case.

## Operator Commands

### Smoke Test With First N Symbols

The repo now has the full current S&P 500 ticker universe in `sp500_current.csv`.

Use this for smoke testing:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --max-symbols 20
```

If you changed Python dependencies or code inside `services/market-api`, rebuild too:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --rebuild --max-symbols 20
```

### Full S&P 500 Run

For the full current S&P 500 universe:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --rebuild
```

Equivalent Python job called inside the wrapper:

```bash
python -m app.jobs.backfill_daily \
  --universe sp500_current \
  --start 2010-01-01 \
  --batch-size 10 \
  --skip-existing \
  --retry-attempts 3 \
  --retry-sleep-seconds 5 \
  --sleep-seconds 1 \
  --failed-symbols-file /tmp/showmeedge-sp500-backfill-<run-id>-failed.json \
  --no-data-symbols-file /tmp/showmeedge-sp500-backfill-<run-id>-no-data.json \
  --run-summary-file /tmp/showmeedge-sp500-backfill-<run-id>-summary.json
```

The JSON report paths above are container-local. The safe wrapper copies them into the host run folder under `batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/<run-id>/`.

### Bounded Historical Run

The safe wrapper also supports an inclusive end date:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh \
  --start 2015-01-01 \
  --end 2020-12-31
```

Equivalent Python behavior:

```bash
python -m app.jobs.backfill_daily \
  --universe sp500_current \
  --start 2015-01-01 \
  --end 2020-12-31
```

The user-facing `--end` date is inclusive. The yfinance provider receives an exclusive end internally by adding one day.

## Script Options

`batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh` supports:

```text
--universe NAME
--start YYYY-MM-DD
--end YYYY-MM-DD
--batch-size N
--max-symbols N
--min-symbols N
--allow-small-universe
--retry-attempts N
--retry-sleep-seconds N
--sleep-seconds N
--log-root PATH
--rebuild
--help
```

Defaults:

```text
universe: sp500_current
start: 2010-01-01
end: latest available from provider
batch-size: 10
retry-attempts: 3
retry-sleep-seconds: 5
sleep-seconds: 1
min-symbols: 450
log-root: batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill
```

## Small Universe Protection

The safe wrapper intentionally refuses a full run when the universe has fewer than `450` symbols.

Reason:

```text
The selected universe may accidentally be a tiny development CSV.
Running the "full" script against only a few symbols could create a false sense that the full S&P 500 was loaded.
```

To intentionally run against a small seed universe:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --allow-small-universe
```

For smoke tests:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --allow-small-universe --max-symbols 20
```

## Failure And Restart Plan

### If The Run Fails In The Middle

Rerun the same command:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --rebuild
```

The wrapper invokes Python with `--skip-existing`.

That means:

- For open-ended runs, symbols with recent coverage are skipped.
- For bounded runs with `--end`, symbols are skipped only when stored coverage includes the requested date range.
- Incomplete or missing symbols are processed.
- Reinserted rows are protected by QuestDB dedup/upsert keys.

### If Some Symbols Fail

The script writes true retry/provider/job failures to:

```text
<log-dir>/failed-symbols.json
```

Example shape:

```json
{
  "provider": "yfinance",
  "universe": "sp500_current",
  "start": "2010-01-01",
  "end": null,
  "failed_symbols": ["XYZ", "ABC"]
}
```

Then rerun those symbols manually:

```bash
docker compose -f scripts/docker-compose.yml exec -T market-api \
  python -m app.jobs.backfill_daily \
  --symbols XYZ ABC \
  --start 2010-01-01 \
  --batch-size 1 \
  --retry-attempts 3
```

If `failed_symbols` is empty, the Python job exits successfully.

### If A Batch Fails

Python behavior:

1. Retry the whole batch up to `--retry-attempts`.
2. If the batch remains failed, retry each symbol individually.
3. If a symbol still fails because of exceptions, include it in `failed_symbols`.

### If A Symbol Returns No Bars

The Python job treats this as `no_data_symbols`, not a hard failure, after individual retry confirms no bars were returned.

This can happen for:

- Bad provider symbol mapping.
- Recent S&P additions with short history.
- Bounded historical windows before a company traded publicly.
- Tickers yfinance does not support.
- Temporary provider issues.

The symbol appears in:

```text
<log-dir>/no-data-symbols.json
```

Example shape:

```json
{
  "provider": "yfinance",
  "universe": "sp500_current",
  "start": "1997-01-01",
  "end": "2009-12-31",
  "no_data_symbols": ["ABBV", "ABNB"]
}
```

This distinction matters for bounded historical runs. A current S&P 500 symbol that IPO'd after the requested range is not a failed ingest; it simply has no bars for that range.

### If The Terminal Is Closed Or Machine Sleeps

Rerun:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh
```

Already-complete symbols should be skipped.

## Logs And Artifacts

Each run creates a timestamped host directory under the repo:

```text
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/YYYYMMDD-HHMMSS/
```

Files:

```text
backfill.log
verification.log
failed-symbols.json
no-data-symbols.json
run-summary.json
```

`backfill.log` contains JSON progress events such as:

```json
{"event": "symbol_skipped_existing", "symbol": "AAPL"}
{"event": "batch_inserted", "symbols": ["AAPL", "MSFT"], "fetched_bars": 8256, "no_data_symbols": []}
{"event": "batch_failed_attempt", "attempt": 1, "symbols": ["XYZ"]}
{"event": "backfill_complete", "failed_symbols": [], "no_data_symbols": []}
```

`verification.log` includes total yfinance rows and distinct yfinance symbol count.

`failed-symbols.json` includes only symbols that still failed after retries.

`no-data-symbols.json` includes symbols that returned no bars for the requested date window.

`run-summary.json` is the machine-readable final summary with requested symbols, processed symbols, skipped symbols, counts, failed symbols, no-data symbols, and coverage.

The Python job writes its report JSON files inside the `market-api` container first. The shell wrapper then copies those files into the host-side `batch-jobs/yahoo-daily-bars-data/LOG/...` run directory so the result is kept for future reference.

## Verification Queries

QuestDB row count:

```sql
select count()
from equity_ohlcv_daily
where provider = 'yfinance';
```

Distinct symbol count:

```sql
select count_distinct(symbol)
from equity_ohlcv_daily
where provider = 'yfinance';
```

Per-symbol row count:

```sql
select symbol, count()
from equity_ohlcv_daily
where provider = 'yfinance'
order by symbol;
```

Coverage for one symbol:

```sql
select min(ts), max(ts), count()
from equity_ohlcv_daily
where symbol = 'AAPL'
  and provider = 'yfinance';
```

FastAPI verification:

```text
GET /market-data/bars?symbol=AAPL&timeframe=1d&provider=yfinance&seed_if_empty=false
```

Expected source:

```text
questdb_yfinance_daily
```

## Completed Smoke Tests

### Earlier Skip-Existing Smoke Test

An earlier smoke test was run when `sp500_current.csv` was still a 15-symbol starter CSV.

Result:

```text
market-api image rebuilt
questdb and market-api started
health checks passed
AAPL skipped because existing coverage was complete
MSFT skipped because existing coverage was complete
failed-symbol report written with no failures
QuestDB verification passed
```

### Log-Location Smoke Test

After changing host logs from `/tmp` to `batch-jobs/yahoo-daily-bars-data/LOG`, this command was run:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh \
  --rebuild \
  --max-symbols 1 \
  --batch-size 1 \
  --sleep-seconds 0 \
  --retry-sleep-seconds 0
```

Result:

```text
market-api image rebuilt
questdb and market-api started
health checks passed
universe sp500_current contained 503 symbols
logs written under batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/<run-id>/
failed-symbol report copied to batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/<run-id>/failed-symbols.json
QuestDB verification ran
```

This run exited nonzero because yfinance returned no bars for `MMM` during that attempt. That is acceptable for this smoke test because it validated the failure path:

```text
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-122314/backfill.log
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-122314/failed-symbols.json
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-122314/verification.log
```

The failed-symbol file contained:

```json
{
  "provider": "yfinance",
  "universe": "sp500_current",
  "start": "2010-01-01",
  "end": null,
  "failed_symbols": ["MMM"]
}
```

## Completed Full Universe Run

After the provider hardening changes, the full safe wrapper was run successfully:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh
```

Run directory:

```text
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-123841/
```

Result:

```text
csv_symbols=503
db_yfinance_symbols=504
csv_symbols_missing_from_db=[]
extra_yfinance_symbols_not_in_csv=["SPY"]
total_yfinance_rows=1959296
failed_symbols=[]
```

The extra symbol is expected because `SPY` was loaded earlier during seed/smoke testing and is not part of `sp500_current.csv`.

Run artifacts:

```text
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-123841/backfill.log
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-123841/verification.log
batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-backfill/20260602-123841/failed-symbols.json
```

Additional verification confirmed:

```text
All 503 CSV symbols exist in QuestDB.
No failed symbols were reported.
The only yfinance symbol outside the CSV was SPY.
```

## Full Universe CSV Refresh

The full current S&P 500 CSV has been refreshed from the Wikipedia constituents table.

Current status:

```text
services/market-api/app/data/sp500_current.csv contains 503 symbols.
```

Before a full production-like run:

1. Validate the CSV still looks current.
2. Run the smoke test with `--max-symbols 20`.
3. Run the full wrapper without `--allow-small-universe`.

## Important Data Caveats

This workflow loads current S&P 500 constituents back to 2010.

Good for:

- Current-symbol charting.
- UI validation.
- MVP market-data workflows.

Not sufficient for:

- Research-grade S&P 500 backtests.
- Historical constituent-aware index strategies.

Reason:

```text
Using today's S&P 500 symbols back to 2010 creates survivorship bias.
```

For research-grade backtesting, add historical S&P 500 membership with effective dates.

Also, yfinance remains MVP-only. It is useful for development but should be replaceable by a licensed market-data provider later.
