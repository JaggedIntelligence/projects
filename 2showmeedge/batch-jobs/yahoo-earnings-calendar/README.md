# Yahoo Earnings Calendar Batch Job

This batch job ingests Yahoo Finance earnings calendar data in two steps:

1. `generate-manifest.mjs` discovers dates with earnings and writes final paginated Yahoo URLs.
2. `ingest-manifest.mjs` reads the manifest, scrapes each date, retries failures by date, and writes run artifacts.

The ingester writes validated rows to QuestDB by default and also writes JSONL run artifacts for inspection and retry.

## Generate Manifest

```bash
node batch-jobs/yahoo-earnings-calendar/generate-manifest.mjs \
  --from 2026-04-19 \
  --to 2026-04-25 \
  --output batch-jobs/yahoo-earnings-calendar/runs/sample/manifest.jsonl
```

## Ingest Manifest

```bash
node batch-jobs/yahoo-earnings-calendar/ingest-manifest.mjs \
  --manifest batch-jobs/yahoo-earnings-calendar/runs/sample/manifest.jsonl \
  --rows batch-jobs/yahoo-earnings-calendar/runs/sample/rows.jsonl
```

Outputs default beside the manifest:

- `ingest.log.jsonl`
- `failed-dates.jsonl`
- `summary.json`

By default, ingestion writes to QuestDB through PGWire:

```text
QUESTDB_URL=postgres://admin:quest@127.0.0.1:8812/qdb
```

Use `--dry-run` to scrape and write JSONL artifacts without inserting QuestDB.

## Backfill Wrapper

```bash
bash batch-jobs/yahoo-earnings-calendar/bin/backfill-range.sh \
  --from 2026-04-05 \
  --to 2026-04-11
```

The wrapper creates a timestamped run directory, starts QuestDB unless `--no-start-questdb` is passed, generates a manifest, ingests it, and writes logs under `runs/`.

## EOD Refresh Wrapper

```bash
bash batch-jobs/yahoo-earnings-calendar/bin/refresh-eod.sh
```

Default refresh window:

```text
today - 14 days through today + 45 days
```

Useful smoke-test form:

```bash
bash batch-jobs/yahoo-earnings-calendar/bin/refresh-eod.sh --dry-run --no-start-questdb
```
