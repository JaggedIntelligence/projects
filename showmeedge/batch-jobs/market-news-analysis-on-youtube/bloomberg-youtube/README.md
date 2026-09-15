# Bloomberg YouTube metadata collector

Collects metadata for videos published on Bloomberg Television's `/videos` tab
during the last 10 days. It uses `yt-dlp` without downloading video or audio.

## Output

- `bloomberg_videos.jsonl` is an append-only processing index. Each line contains
  `video_id`, `title`, and `published_at`.
- `bloomberg_scan_state.json` records the start time of the last completely
  successful scan.
- `metadata/YYYY-MM-DD-video_id.json` contains the full retained metadata for one
  video, including its description, chapters, duration, views, and likes.

Existing video IDs are not appended to the index again. If an indexed video's
metadata file is missing, the collector recreates that file without adding a
duplicate index record.

The initial run scans the rolling 10-day window. A subsequent run starts after
`last_successful_scan_at`, subject to the same 10-day maximum lookback. If one
video fails, the collector continues with the remaining videos and exits nonzero
at the end. Because failed videos are not indexed and the state is not advanced,
they are retried on the next run while they remain inside the 10-day window.

The state file is replaced atomically only after complete channel enumeration and
successful processing. The saved value is the scan's start time, preventing a
video published during a running scan from being missed by the next run.

## Requirements

- `uv` 0.11.30
- Python 3.12, managed by `uv`
- `yt-dlp` 2026.8.19, pinned in `uv.lock`

## Run

From this directory:

```bash
./run.sh
```

The script resolves all default output paths relative to its own directory, so
it can also be invoked from another working directory.

Optional arguments are forwarded to the Python program:

```bash
./run.sh --lookback-days 10
./run.sh --state-file /path/to/bloomberg_scan_state.json
./run.sh --help
```

The default source is:

```text
https://www.youtube.com/channel/UCIALMKvObZNtJ6AmdCLP7Lg/videos
```
