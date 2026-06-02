# Feature: End-of-Day Daily Price Refresh

Date: 2026-06-02

This document records the MVP design and implementation for a restartable end-of-day daily-price refresh into QuestDB.

The goal is to refresh recent daily bars for the current S&P 500 universe without rerunning the full historical backfill.

## Why This Feature Exists

The historical backfill is for large date ranges. The EOD refresh is for keeping recent data current.

Daily market data can arrive late or change after the first provider response:

- yfinance may publish the current trading day after market close.
- Some symbols may update later than others.
- Recent adjusted-close values can be corrected.
- A failed or partial prior run should self-heal on the next run.

Therefore the EOD job refreshes a recent window and relies on QuestDB upsert/dedup to avoid duplicate logical rows.

## Core Design

Use a two-layer design:

```text
scripts/update-sp500-eod-safe.sh
  -> starts/checks Docker Compose services
  -> validates universe size
  -> creates timestamped logs
  -> invokes Python EOD refresh CLI
  -> copies JSON reports
  -> verifies recent QuestDB coverage

services/market-api/app/jobs/update_daily_recent.py
  -> resolves symbols
  -> computes recent date window
  -> fetches yfinance batches
  -> retries failed batches
  -> retries no-data symbols one by one
  -> writes bars to QuestDB
  -> writes failed-symbol JSON
  -> writes no-data-symbol JSON
  -> writes run-summary JSON
```

The EOD job intentionally does **not** use `--skip-existing`.

Reason:

```text
Recent rows should be refreshed even when they already exist.
QuestDB DEDUP UPSERT KEYS(ts, symbol, provider) makes this safe.
```

## Files Added

### Python EOD CLI

File:

```text
services/market-api/app/jobs/update_daily_recent.py
```

Default behavior:

```text
universe: sp500_current
lookback-days: 10
timezone: America/New_York
batch-size: 10
retry-attempts: 3
retry-sleep-seconds: 5
sleep-seconds: 1
```

Important behavior:

- `--end` defaults to today in `America/New_York`.
- `--start` defaults to `end - lookback_days`.
- `--start` can be passed explicitly for repair windows.
- The end date is inclusive.
- Existing rows are refreshed, not skipped.
- Real failures are written to `failed_symbols`.
- No-data results are written to `no_data_symbols`.
- The final summary event is `daily_recent_update_complete`.

### Safe Wrapper Script

File:

```text
scripts/update-sp500-eod-safe.sh
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
- Run `python -m app.jobs.update_daily_recent` inside `market-api`.
- Copy failed-symbol, no-data-symbol, and run-summary files from the container to host logs.
- Run post-update QuestDB verification.
- Exit nonzero only if Python reports hard failures.

## Operator Commands

### Smoke Test

Use this for a small, fast run:

```bash
bash scripts/update-sp500-eod-safe.sh \
  --max-symbols 5 \
  --lookback-days 2 \
  --batch-size 1 \
  --sleep-seconds 0
```

If Python code changed and the container image needs a rebuild:

```bash
bash scripts/update-sp500-eod-safe.sh \
  --rebuild \
  --max-symbols 5 \
  --lookback-days 2
```

### Normal Manual EOD Run

Run after the market has had time to settle:

```bash
bash scripts/update-sp500-eod-safe.sh
```

Equivalent Python job called inside the wrapper:

```bash
python -m app.jobs.update_daily_recent \
  --universe sp500_current \
  --lookback-days 10 \
  --timezone America/New_York \
  --batch-size 10 \
  --retry-attempts 3 \
  --retry-sleep-seconds 5 \
  --sleep-seconds 1 \
  --failed-symbols-file /tmp/showmeedge-sp500-eod-<run-id>-failed.json \
  --no-data-symbols-file /tmp/showmeedge-sp500-eod-<run-id>-no-data.json \
  --run-summary-file /tmp/showmeedge-sp500-eod-<run-id>-summary.json
```

### Explicit Repair Window

For a controlled recent repair:

```bash
bash scripts/update-sp500-eod-safe.sh \
  --start 2026-05-20 \
  --end 2026-06-02
```

## Script Options

`scripts/update-sp500-eod-safe.sh` supports:

```text
--universe NAME
--lookback-days N
--start YYYY-MM-DD
--end YYYY-MM-DD
--timezone NAME
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
lookback-days: 10
end: today in America/New_York
timezone: America/New_York
batch-size: 10
retry-attempts: 3
retry-sleep-seconds: 5
sleep-seconds: 1
min-symbols: 450
log-root: scripts/LOG/showmeedge-sp500-eod
```

## Logs And Artifacts

Each run creates:

```text
scripts/LOG/showmeedge-sp500-eod/YYYYMMDD-HHMMSS/
```

Files:

```text
update.log
verification.log
failed-symbols.json
no-data-symbols.json
run-summary.json
```

`update.log` contains JSON progress events.

`verification.log` includes:

```text
total_yfinance_rows
distinct_yfinance_symbols
requested_symbols
latest_requested_ts
requested_symbols_with_latest_ts
requested_symbols_missing_latest_ts
```

`failed-symbols.json` includes only symbols that still failed after retries.

`no-data-symbols.json` includes symbols that returned no bars for the requested refresh window.

`run-summary.json` is the machine-readable final summary.

## Scheduling Guidance

Start with manual runs.

Recommended future schedule:

```text
6:30 PM America/New_York minimum
8:00 PM America/New_York safer
```

Do not run exactly at market close. yfinance daily bars are not always complete immediately after 4:00 PM New York time.

## Important Caveats

This is an MVP yfinance refresh.

Good for:

- Keeping the MVP UI current.
- Filling late-arriving daily bars.
- Repairing recent missing rows.

Not sufficient for:

- Production trading decisions.
- Licensed/research-grade market data.
- Historical constituent-aware index research.
