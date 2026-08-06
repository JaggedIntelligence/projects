# Yahoo finance Options data Scraping


## What it does today

`yfinoptions.py` currently:

Yahoo finance Options data Scraping

## Files

- `yfinoptions.py` — the EDGAR financial-statement example.
- `run.sh` — runs the script through `uv` using this folder's locked environment.
- `pyproject.toml` — declares Python and the direct `edgartools` dependency.
- `uv.lock` — pins the full dependency graph for reproducible installs.

## Requirements

- `uv` 0.11.30
- Python 3.12, managed by `uv`
- Internet access to retrieve SEC filing data


## Run

From this folder:

```bash
./run.sh
```

Or from another directory:

```bash
path/to/edgartools/run.sh
```

`run.sh` resolves its own directory, uses `uv run --locked`, and exits immediately if `uv` is unavailable. Any arguments passed to `run.sh` are forwarded to `yfinoptions.py`, although the Python script does not consume arguments yet.

