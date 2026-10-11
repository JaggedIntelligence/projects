#!/usr/bin/env python3
"""Collect recent Bloomberg YouTube video metadata without downloading media."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import tempfile
from collections.abc import Iterator
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, TextIO

import yt_dlp


CHANNEL_VIDEOS_URL = (
    "https://www.youtube.com/channel/UCIALMKvObZNtJ6AmdCLP7Lg/videos"
)
DEFAULT_LOOKBACK_DAYS = 10
CHANNEL_BATCH_SIZE = 50
JOB_DIR = Path(__file__).resolve().parent
DEFAULT_METADATA_DIR = JOB_DIR / "metadata"
DEFAULT_INDEX_FILE = JOB_DIR / "bloomberg_videos.jsonl"
DEFAULT_STATE_FILE = JOB_DIR / "bloomberg_scan_state.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Save metadata for Bloomberg videos published recently."
    )
    parser.add_argument(
        "--channel-url",
        default=CHANNEL_VIDEOS_URL,
        help="YouTube /videos URL to scan (default: Bloomberg Television).",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=DEFAULT_LOOKBACK_DAYS,
        help="Rolling publication window in days (default: 10).",
    )
    parser.add_argument(
        "--metadata-dir",
        type=Path,
        default=DEFAULT_METADATA_DIR,
        help="Directory for full per-video metadata JSON files.",
    )
    parser.add_argument(
        "--index-file",
        type=Path,
        default=DEFAULT_INDEX_FILE,
        help="Append-only JSON Lines file of processed videos.",
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=DEFAULT_STATE_FILE,
        help="JSON file containing the last successful scan time.",
    )
    args = parser.parse_args()
    if args.lookback_days < 1:
        parser.error("--lookback-days must be at least 1")
    return args


def load_index(index_handle: TextIO) -> dict[str, dict[str, Any]]:
    """Load and validate the append-only index while its lock is held."""
    records: dict[str, dict[str, Any]] = {}
    index_handle.seek(0)
    for line_number, raw_line in enumerate(index_handle, start=1):
        if not raw_line.strip():
            continue
        try:
            record = json.loads(raw_line)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Invalid JSON in index at line {line_number}: {exc}"
            ) from exc
        if not isinstance(record, dict):
            raise ValueError(f"Index line {line_number} is not a JSON object")
        video_id = record.get("video_id")
        if not isinstance(video_id, str) or not video_id:
            raise ValueError(
                f"Index line {line_number} has no valid 'video_id'"
            )
        records[video_id] = record
    return records


def append_index_record(index_handle: TextIO, record: dict[str, str]) -> None:
    """Durably append one successfully stored video to the index."""
    index_handle.seek(0, os.SEEK_END)
    index_handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    index_handle.flush()
    os.fsync(index_handle.fileno())


def published_at(info: dict[str, Any]) -> datetime | None:
    """Return the best available publication time as an aware UTC datetime."""
    timestamp = info.get("timestamp")
    if isinstance(timestamp, (int, float)):
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    upload_date = info.get("upload_date")
    if isinstance(upload_date, str):
        try:
            return datetime.strptime(upload_date, "%Y%m%d").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            return None
    return None


def is_recent(
    publication_time: datetime,
    cutoff: datetime,
    has_exact_timestamp: bool,
    strict_cutoff: bool = False,
) -> bool:
    # upload_date has only day precision. Include the entire boundary day rather
    # than risk omitting a video that is actually inside the rolling window.
    if has_exact_timestamp:
        if strict_cutoff:
            return publication_time > cutoff
        return publication_time >= cutoff
    return publication_time.date() >= cutoff.date()


def video_url(entry: dict[str, Any]) -> str:
    url = entry.get("webpage_url") or entry.get("url")
    if isinstance(url, str) and url.startswith(("https://", "http://")):
        return url
    video_id = entry.get("id") or url
    if not isinstance(video_id, str) or not video_id:
        raise ValueError("Channel entry has no video ID or URL")
    return f"https://www.youtube.com/watch?v={video_id}"


def metadata_path(
    metadata_dir: Path, publication_time: datetime, video_id: str
) -> Path:
    return metadata_dir / f"{publication_time.date().isoformat()}-{video_id}.json"


def select_metadata(
    info: dict[str, Any], publication_time: datetime
) -> dict[str, Any]:
    """Select the full metadata fields retained for downstream analysis."""
    return {
        "id": info.get("id"),
        "title": info.get("title"),
        "uploader": info.get("uploader"),
        "channel_url": info.get("channel_url"),
        "upload_date": info.get("upload_date"),
        "published_at": publication_time.isoformat().replace("+00:00", "Z"),
        "duration_seconds": info.get("duration"),
        "view_count": info.get("view_count"),
        "like_count": info.get("like_count"),
        "description": info.get("description"),
        "webpage_url": info.get("webpage_url"),
        "chapters": info.get("chapters") or [],
    }


def write_json_atomically(path: Path, value: dict[str, Any]) -> None:
    """Write JSON completely before replacing any existing metadata file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_name = temporary_file.name
            json.dump(value, temporary_file, indent=2, ensure_ascii=False)
            temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_name, path)
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)


def load_last_successful_scan(state_file: Path) -> datetime | None:
    if not state_file.exists():
        return None
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in state file: {exc}") from exc
    if not isinstance(state, dict):
        raise ValueError("State file is not a JSON object")
    raw_timestamp = state.get("last_successful_scan_at")
    if not isinstance(raw_timestamp, str) or not raw_timestamp:
        raise ValueError("State file has no valid 'last_successful_scan_at'")
    try:
        parsed = datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(
            "State file has an invalid 'last_successful_scan_at'"
        ) from exc
    if parsed.tzinfo is None:
        raise ValueError("State timestamp must include a timezone")
    return parsed.astimezone(timezone.utc)


def stored_metadata_exists(metadata_dir: Path, index_record: dict[str, Any]) -> bool:
    video_id = index_record.get("video_id")
    published = index_record.get("published_at")
    if not isinstance(video_id, str) or not isinstance(published, str):
        return False
    try:
        publication_date = date.fromisoformat(published[:10])
    except ValueError:
        return False
    return (metadata_dir / f"{publication_date.isoformat()}-{video_id}.json").is_file()


def index_publication_time(index_record: dict[str, Any]) -> datetime | None:
    published = index_record.get("published_at")
    if not isinstance(published, str):
        return None
    try:
        parsed = datetime.fromisoformat(published.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def enumerate_channel(channel_url: str) -> Iterator[dict[str, Any]]:
    """Enumerate newest-first entries in bounded yt-dlp playlist batches."""
    start = 1
    while True:
        options = {
            "extract_flat": "in_playlist",
            "lazy_playlist": True,
            "playliststart": start,
            "playlistend": start + CHANNEL_BATCH_SIZE - 1,
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            channel = ydl.extract_info(channel_url, download=False)
        if not channel:
            raise RuntimeError("yt-dlp returned no channel information")
        entries = channel.get("entries")
        if entries is None:
            raise RuntimeError("yt-dlp returned no video entries for the channel")

        raw_entries = list(entries)
        batch = [entry for entry in raw_entries if entry is not None]
        if not batch:
            return
        yield from batch
        if len(raw_entries) < CHANNEL_BATCH_SIZE:
            return
        start += CHANNEL_BATCH_SIZE


def extract_video(url: str) -> dict[str, Any]:
    options = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
    if not info:
        raise RuntimeError("yt-dlp returned no video metadata")
    return info


def run(args: argparse.Namespace) -> int:
    scan_started_at = datetime.now(timezone.utc)
    rolling_cutoff = scan_started_at - timedelta(days=args.lookback_days)
    args.metadata_dir.mkdir(parents=True, exist_ok=True)
    args.index_file.parent.mkdir(parents=True, exist_ok=True)

    with args.index_file.open("a+", encoding="utf-8") as index_handle:
        try:
            fcntl.flock(index_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another Bloomberg metadata scan is already running.", file=sys.stderr)
            return 1

        last_successful_scan = load_last_successful_scan(args.state_file)
        if last_successful_scan and last_successful_scan > scan_started_at:
            raise ValueError("State timestamp is later than the current time")
        cutoff = max(rolling_cutoff, last_successful_scan or rolling_cutoff)
        strict_cutoff = bool(
            last_successful_scan and last_successful_scan >= rolling_cutoff
        )
        processed = load_index(index_handle)
        print(
            f"Scanning {args.channel_url} for videos published since "
            f"{cutoff.isoformat().replace('+00:00', 'Z')}"
        )

        added = 0
        skipped = 0
        failures: list[str] = []
        seen: set[str] = set()
        entries = enumerate_channel(args.channel_url)

        while True:
            try:
                entry = next(entries)
            except StopIteration:
                break
            except Exception as exc:
                print(f"Channel enumeration failed: {exc}", file=sys.stderr)
                return 1

            entry_id = entry.get("id")
            if isinstance(entry_id, str) and entry_id in seen:
                continue
            if isinstance(entry_id, str):
                seen.add(entry_id)

            entry_publication = published_at(entry)
            entry_has_timestamp = isinstance(entry.get("timestamp"), (int, float))
            if entry_publication and not is_recent(
                entry_publication,
                cutoff,
                entry_has_timestamp,
                strict_cutoff,
            ):
                # YouTube's /videos tab is ordered newest first.
                break

            existing = processed.get(entry_id) if isinstance(entry_id, str) else None
            if entry_publication is None and existing:
                indexed_publication = index_publication_time(existing)
                if indexed_publication and not is_recent(
                    indexed_publication,
                    cutoff,
                    has_exact_timestamp=True,
                    strict_cutoff=strict_cutoff,
                ):
                    break
            if existing and stored_metadata_exists(args.metadata_dir, existing):
                skipped += 1
                continue

            try:
                url = video_url(entry)
                info = extract_video(url)
                video_id = info.get("id")
                title = info.get("title")
                publication_time = published_at(info)
                if not isinstance(video_id, str) or not video_id:
                    raise ValueError("metadata has no video ID")
                if not isinstance(title, str) or not title:
                    raise ValueError(f"video {video_id} has no title")
                if publication_time is None:
                    raise ValueError(f"video {video_id} has no publication date")
                if not is_recent(
                    publication_time,
                    cutoff,
                    isinstance(info.get("timestamp"), (int, float)),
                    strict_cutoff,
                ):
                    break

                output_path = metadata_path(
                    args.metadata_dir, publication_time, video_id
                )
                write_json_atomically(
                    output_path, select_metadata(info, publication_time)
                )

                if video_id not in processed:
                    index_record = {
                        "video_id": video_id,
                        "title": title,
                        "published_at": publication_time.isoformat().replace(
                            "+00:00", "Z"
                        ),
                    }
                    append_index_record(index_handle, index_record)
                    processed[video_id] = index_record
                    added += 1
                    print(f"Added {video_id}: {title}")
                else:
                    print(f"Restored missing metadata for {video_id}: {title}")
            except Exception as exc:
                failed_id = entry_id if isinstance(entry_id, str) else "unknown"
                failures.append(failed_id)
                print(f"Failed to process {failed_id}: {exc}", file=sys.stderr)

        print(
            f"Scan complete: {added} added, {skipped} already processed, "
            f"{len(failures)} failed."
        )
        if failures:
            print("Scan state was not advanced because processing failed.")
            return 1

        write_json_atomically(
            args.state_file,
            {
                "last_successful_scan_at": scan_started_at.isoformat().replace(
                    "+00:00", "Z"
                )
            },
        )
        saved_timestamp = scan_started_at.isoformat().replace("+00:00", "Z")
        print(f"Advanced scan state to {saved_timestamp}")
        return 0


def main() -> int:
    try:
        return run(parse_args())
    except (OSError, ValueError) as exc:
        print(f"Fatal error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
