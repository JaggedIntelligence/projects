# Massive Benzinga Analyst Ratings Collector

This first implementation slice downloads Massive's Benzinga analyst-rating events into restartable JSONL artifacts. It does not connect to QuestDB or any other database.

## Security setup

Rotate any API key that was previously stored in source code. Export the replacement only through the environment:

```bash
export MASSIVE_API_KEY="replace-with-the-rotated-key"
```

The collector never writes the key to run artifacts. Do not put the key on the command line because shell history and process listings can expose it.

## Runtime setup with uv

This job is an isolated uv project. It requires uv `0.11.30`, uses a uv-managed CPython 3.12 runtime, and installs the exact dependency versions in `uv.lock`. It does not use Apple Python, a cloud server's system Python, or globally installed packages.

Install the pinned uv release on macOS or Linux:

```bash
curl -LsSf https://astral.sh/uv/0.11.30/install.sh | sh
```

Start a new shell if the installer updates `PATH`, then verify and synchronize the locked environment:

```bash
uv --version

uv sync \
  --project batch-jobs/analyst-price-targets/from-massive \
  --locked
```

uv automatically downloads its managed Python 3.12 build when it is not already installed. The environment is created under this job's `.venv/` directory, which is ignored by Git.

## Smoke test

Start with two symbols and a bounded date range:

```bash
bash batch-jobs/analyst-price-targets/from-massive/run.sh \
  --ticker AMD \
  --ticker AAPL \
  --start 2026-07-01 \
  --end 2026-07-21 \
  --dry-run
```

The default universe is `services/market-api/app/data/sp500_current.csv`. The collector uses its canonical `symbol` column, such as `BRK.B`, rather than its Yahoo-specific `provider_symbol` column.

Other useful forms:

```bash
# First 20 symbols from the universe
bash batch-jobs/analyst-price-targets/from-massive/run.sh --max-symbols 20

# Full available history for the current S&P 500 universe
bash batch-jobs/analyst-price-targets/from-massive/run.sh
```

`run.sh` always uses `uv run --locked`. It refuses an outdated lockfile and uses only a uv-managed Python interpreter.

`limit` is a Massive page size. The collector defaults to the endpoint maximum of 50,000 and the SDK follows `next_url` pagination automatically.

## Run artifacts

Each new invocation creates `runs/<UTC-run-id>/` containing:

- `manifest.jsonl`: selected symbols in processing order.
- `run-config.json`: immutable API query settings reused by resumed invocations.
- `symbols/<TICKER>.jsonl`: complete records for each successfully fetched symbol.
- `rows.jsonl`: combined records from all completed symbol files.
- `checkpoints/<TICKER>.json`: atomic completion checkpoints.
- `events.jsonl`: attempt and run events.
- `failed-symbols.jsonl`: symbols that failed in the latest invocation.
- `no-data-symbols.jsonl`: completed symbols for which Massive returned no rows.
- `summary.json`: machine-readable totals and completion status.

Each row contains the Massive rating fields plus an `_ingest` object with source, requested ticker, fetch time, and run ID.

If a run is interrupted or finishes with failures, resume it without re-fetching completed symbols:

```bash
bash batch-jobs/analyst-price-targets/from-massive/run.sh \
  --resume-run batch-jobs/analyst-price-targets/from-massive/runs/<run-id>
```

The collector retries HTTP 429, HTTP 5xx, and transport/SDK failures with exponential backoff and jitter. Recognized authentication and entitlement failures stop without retrying.

## Tests

The tests use Python's standard library and do not call Massive:

```bash
uv run \
  --project batch-jobs/analyst-price-targets/from-massive \
  --locked \
  python -m unittest discover \
  -s batch-jobs/analyst-price-targets/from-massive/tests \
  -p 'test_*.py'
```

## Cloud server setup

The server only needs `curl`, CA certificates, network access for the first synchronization, and the `MASSIVE_API_KEY` secret. A typical deployment is:

```bash
curl -LsSf https://astral.sh/uv/0.11.30/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

cd /path/to/showmeedge
uv sync --project batch-jobs/analyst-price-targets/from-massive --locked

export MASSIVE_API_KEY="read-this-from-your-server-secret-manager"
bash batch-jobs/analyst-price-targets/from-massive/run.sh --max-symbols 20
```

For cron or systemd, provide an absolute repository path, an explicit `PATH` containing the uv binary, and inject `MASSIVE_API_KEY` through the server's secret-management mechanism.
