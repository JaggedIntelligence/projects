# EDGAR Tools Financials Starter

This folder contains a small Python starter job for retrieving company financial statements from the SEC through [`edgartools`](https://github.com/dgunning/edgartools).

## What it does today

`financials.py` currently:

1. Registers a hard-coded contact email as the SEC request identity.
2. Loads financial data for Microsoft (`MSFT`).
3. Builds the company's balance sheet and income statement.
4. Prints the income statement to standard output.

The balance sheet is fetched and assigned to `bs`, but it is not printed or otherwise used yet. The company ticker and SEC identity are also fixed in the source; no command-line options are currently implemented.

## Files

- `financials.py` — the EDGAR financial-statement example.
- `run.sh` — runs the script through `uv` using this folder's locked environment.
- `pyproject.toml` — declares Python and the direct `edgartools` dependency.
- `uv.lock` — pins the full dependency graph for reproducible installs.

## Requirements

- `uv` 0.11.30
- Python 3.12, managed by `uv`
- Internet access to retrieve SEC filing data

The project pins `edgartools` 5.45.1.

## Run

From this folder:

```bash
./run.sh
```

Or from another directory:

```bash
path/to/edgartools/run.sh
```

`run.sh` resolves its own directory, uses `uv run --locked`, and exits immediately if `uv` is unavailable. Any arguments passed to `run.sh` are forwarded to `financials.py`, although the Python script does not consume arguments yet.

## Current starter-template notes

- The SEC identity email is committed directly in `financials.py`. Before reusing or sharing this starter, replace it with the operator's real contact identity and consider reading it from configuration.
- `from edgar import *` is convenient for exploration but can be replaced with explicit imports as the job grows.
- There is no persistence, structured output, retry orchestration, logging, or automated test coverage in this folder yet.
- The package name and description in `pyproject.toml` still refer to a Benzinga analyst-ratings collector, so that metadata has not yet been renamed for this EDGAR example.
