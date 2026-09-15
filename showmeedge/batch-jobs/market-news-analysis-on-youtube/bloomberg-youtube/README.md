# Bloomberg YouTube metadata collector

Collects metadata for videos published on Bloomberg Television's `/videos` tab
during the last 10 days. It uses `yt-dlp` without downloading video or audio.

## Output

- `bloomberg_videos.jsonl` is an append-only processing index. Each line contains
  `video_id`, `title`, and `published_at`.
- `metadata/YYYY-MM-DD-video_id.json` contains the full retained metadata for one
  video, including its description, chapters, duration, views, and likes.

Existing video IDs are not appended to the index again. If an indexed video's
metadata file is missing, the collector recreates that file without adding a
duplicate index record.

Every run uses the same rolling 10-day window. If one video fails, the collector
continues with the remaining videos and exits nonzero at the end. Because failed
videos are not indexed, they are retried on the next run while they remain inside
the 10-day window.

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
./run.sh --help
```

Full path run: 
batch-jobs/market-news-analysis-on-youtube/bloomberg-youtube/run.sh

The default source is:

```text
https://www.youtube.com/channel/UCIALMKvObZNtJ6AmdCLP7Lg/videos
```
