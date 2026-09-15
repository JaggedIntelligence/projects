# Bloomberg YouTube Market Analysis — Metadata Collection Design

## 1. Purpose

This batch job collects metadata for recently published videos from the
Bloomberg Television YouTube channel. The collected descriptions, chapters,
titles, publication dates, and engagement metadata provide source material for
later market-news analysis.

The job uses `yt-dlp` to retrieve metadata only. It does not download video or
audio.

## 2. Source and scope

Channel ID:

```text
UCIALMKvObZNtJ6AmdCLP7Lg
```

Source URL:

```text
https://www.youtube.com/channel/UCIALMKvObZNtJ6AmdCLP7Lg/videos
```

Only the channel's `/videos` tab is in scope. The `/shorts` and `/streams` tabs
are not scanned.

Every execution uses a rolling 10-day publication window. This rule applies to
both the first execution and all subsequent executions. If the job does not run
for more than 10 days, videos that have aged out of this window are not
backfilled.

## 3. Functional requirements

The collector must:

1. Discover videos from the Bloomberg Television `/videos` tab, newest first.
2. Consider only videos published during the preceding 10 days.
3. Save a full metadata document for every newly discovered video.
4. Append a compact processing record containing the video ID, title, and
   publication time.
5. Never append the same video ID to the processing index more than once.
6. Skip videos already processed on earlier executions.
7. Continue processing other videos when an individual video fails.
8. Exit with a nonzero status if one or more eligible videos fail.
9. Leave failed videos out of the processing index so they are retried on the
   next execution, provided they are still within the 10-day window.
10. Never download video or audio content.

## 4. Project location and entry point

Implementation directory:

```text
batch-jobs/market-news-analysis-on-youtube/bloomberg-youtube/
```

Shell entry point:

```text
run.sh
```

Python entry point:

```text
news-analysis-youtube.py
```

`run.sh` resolves its own directory and executes the Python collector through
the project's locked `uv` environment. Command-line arguments passed to
`run.sh` are forwarded to the Python program.

## 5. Output model

### 5.1 Processing index

The append-only processing index is:

```text
bloomberg_videos.jsonl
```

Each line is an independent JSON object:

```json
{"video_id":"abc123","title":"Bloomberg Market Update","published_at":"2026-09-14T15:30:00Z"}
```

The video ID is the durable identity and deduplication key. JSON Lines is used
because it supports safe incremental appends and handles punctuation and Unicode
in titles without CSV escaping concerns.

The index is loaded at the start of every execution to build the set of already
processed video IDs. A malformed index is treated as a fatal error rather than
risking duplicate or inconsistent output.

### 5.2 Full metadata files

Full metadata is stored as one JSON document per video:

```text
metadata/YYYY-MM-DD-video_id.json
```

Example:

```text
metadata/2026-09-14-NuvaglYGWj4.json
```

The retained fields are:

- `id`
- `title`
- `uploader`
- `channel_url`
- `upload_date`
- `published_at`
- `duration_seconds`
- `view_count`
- `like_count`
- `description`
- `webpage_url`
- `chapters`

Metadata files are written atomically: the complete JSON is written and flushed
to a temporary file in the destination directory before replacing the final
path. This prevents an interrupted process from leaving a partially written
metadata document.

If an ID exists in the processing index but its metadata file is missing, the
job extracts and restores the metadata file without appending a duplicate index
record.

## 6. Processing flow

```text
Acquire exclusive index lock
          |
          v
Load processed video IDs
          |
          v
Enumerate /videos newest first in bounded batches
          |
          v
Stop after reaching a video older than 10 days
          |
          v
For each eligible, unprocessed video
          |
          +--> Extract full metadata with yt-dlp
          |
          +--> Validate ID, title, and publication date
          |
          +--> Atomically write the metadata JSON file
          |
          +--> Durably append the compact index record
          |
          v
Report counts and return success or failure
```

Channel entries are requested in bounded batches of 50. This avoids asking
`yt-dlp` to materialize the channel's complete history before the collector can
apply the 10-day boundary. Additional batches are requested only when the
boundary has not yet been reached.

Channel enumeration uses flat extraction for lightweight discovery. Full
metadata extraction is performed separately only when a video is new or when
an indexed video's metadata file must be restored.

## 7. Publication-date handling

The collector calculates the cutoff as the current UTC time minus 10 days.

For each video:

1. Use yt-dlp's numeric `timestamp` when available.
2. Convert the timestamp to an ISO 8601 UTC value for `published_at`.
3. Fall back to yt-dlp's `upload_date` when an exact timestamp is unavailable.

`upload_date` has only calendar-day precision. On the 10-day boundary, the
entire boundary date is conservatively included so a qualifying video is not
accidentally omitted.

The date portion of `published_at` supplies the `YYYY-MM-DD` component of the
metadata filename.

The design relies on the YouTube `/videos` tab being ordered newest first. Once
the collector encounters a video older than the cutoff, it stops enumerating
older entries.

## 8. Restart and failure behavior

An individual video is considered successfully processed only after:

1. Its metadata has been extracted and validated.
2. Its full metadata JSON file has been written successfully.
3. Its processing record has been appended and flushed to disk.

If an individual extraction fails, the collector:

- writes an error to standard error;
- continues with the remaining eligible videos;
- does not add the failed ID to the index; and
- returns a nonzero process status after the scan.

This makes retries automatic. On the next execution, successful IDs are skipped
and failed IDs are attempted again while they remain within the rolling 10-day
window.

A channel-enumeration failure is fatal because the job cannot prove that it has
discovered all eligible videos.

## 9. Concurrency

The process obtains a non-blocking exclusive lock on the index file. If another
collector instance already holds the lock, the new instance exits nonzero.

This prevents two scheduler invocations from simultaneously processing the same
video or interleaving index writes.

## 10. Command-line interface

Default execution:

```bash
./run.sh
```

Supported options include:

```text
--channel-url
--lookback-days
--metadata-dir
--index-file
```

Example:

```bash
./run.sh --lookback-days 10
```

Default output paths are resolved relative to the Python script's directory,
not the caller's current working directory.

## 11. Dependencies

The project uses:

- Python 3.12
- `uv` 0.11.30
- `yt-dlp` 2026.8.19

Versions are declared in `pyproject.toml` and pinned by `uv.lock` for
reproducible execution.

## 12. Operational characteristics

- No YouTube API key is required.
- No media files are downloaded.
- A first run can take longer because it resolves full metadata for every video
  in the 10-day window.
- Subsequent runs normally resolve only newly published videos.
- View and like counts represent their values at first successful collection;
  existing metadata is not refreshed on every run.
- Videos older than 10 days are retained in the index and metadata directory;
  this job does not delete historical output.

## 13. Out of scope

The following are not part of this collector:

- Downloading video, audio, captions, or thumbnails
- Scanning Bloomberg `/shorts` or `/streams`
- Refreshing engagement counts for previously processed videos
- Deleting or archiving old metadata
- Performing sentiment, topic, entity, or market-impact analysis
- Backfilling videos that are already outside the rolling 10-day window

Those capabilities can be implemented as separate downstream or maintenance
jobs without changing the processing index contract.
