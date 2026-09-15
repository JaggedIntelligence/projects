# extract youtube video meta data info


## What it does today

`news-analysis-youtube.py` currently:

 extract youtube video meta data info.

## Files

- `news-analysis-youtube.py` — 
- `run.sh` — runs the script through `uv` using this folder's locked environment.
- `pyproject.toml` — declares Python and the direct `edgartools` dependency.
- `uv.lock` — pins the full dependency graph for reproducible installs.

## Requirements

- `uv` 0.11.30
- Python 3.12, managed by `uv`
-  

The project pins yt-dlp 2026.8.19

## Run

From this folder:

```bash
./run.sh
```

Or from another directory:

```bash
path/to/bloomberg-youtubes/run.sh
```

`run.sh` resolves its own directory, uses `uv run --locked`, and exits immediately if `uv` is unavailable. Any arguments passed to `run.sh` are forwarded to `news-analysis-youtube.py`

