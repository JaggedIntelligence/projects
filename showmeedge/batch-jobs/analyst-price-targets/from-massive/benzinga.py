#!/usr/bin/env python3
"""Collect Benzinga analyst ratings from Massive into restartable JSONL artifacts."""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from dataclasses import asdict, is_dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Tuple


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
DEFAULT_UNIVERSE = "sp500_current"
DEFAULT_UNIVERSE_DIR = REPO_ROOT / "services" / "market-api" / "app" / "data"
DEFAULT_RUNS_DIR = SCRIPT_DIR / "runs"
DEFAULT_PAGE_SIZE = 50_000
DEFAULT_RETRY_ATTEMPTS = 3
DEFAULT_RETRY_DELAY_SECONDS = 2.0
DEFAULT_REQUEST_DELAY_SECONDS = 0.25
API_KEY_ENV = "MASSIVE_API_KEY"
SOURCE_NAME = "massive-benzinga-analyst-ratings"


class CollectionError(RuntimeError):
    """Base error for a collection run."""


class SymbolFetchError(CollectionError):
    """Raised after a symbol cannot be fetched successfully."""

    def __init__(self, ticker: str, attempts: int, cause: BaseException):
        super().__init__(f"Failed to fetch {ticker} after {attempts} attempt(s): {cause}")
        self.ticker = ticker
        self.attempts = attempts
        self.cause = cause


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: Optional[datetime] = None) -> str:
    timestamp = value or utc_now()
    return timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def create_run_id(value: Optional[datetime] = None) -> str:
    timestamp = (value or utc_now()).astimezone(timezone.utc)
    return timestamp.strftime("%Y%m%dT%H%M%SZ")


def normalize_ticker(value: Any) -> str:
    ticker = str(value or "").strip().upper()
    if not ticker:
        raise ValueError("ticker cannot be empty")
    return ticker


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def page_size(value: str) -> int:
    parsed = positive_int(value)
    if parsed > 50_000:
        raise argparse.ArgumentTypeError("must be at most 50000")
    return parsed


def non_negative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return parsed


def load_symbol_universe(universe: str, universe_dir: Path = DEFAULT_UNIVERSE_DIR) -> List[Dict[str, Any]]:
    csv_path = universe_dir / f"{universe}.csv"
    if not csv_path.is_file():
        raise CollectionError(f"Symbol universe not found: {csv_path}")

    records: List[Dict[str, Any]] = []
    seen = set()
    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        for row_number, row in enumerate(csv.DictReader(csv_file), start=2):
            raw_symbol = row.get("symbol") or row.get("Symbol") or ""
            if not raw_symbol.strip():
                continue
            ticker = normalize_ticker(raw_symbol)
            if ticker in seen:
                raise CollectionError(f"Duplicate ticker {ticker} in {csv_path}:{row_number}")
            seen.add(ticker)
            records.append(
                {
                    "ticker": ticker,
                    "name": (row.get("name") or row.get("Security") or ticker).strip(),
                    "universe": universe,
                }
            )
    return records


def select_symbols(
    records: Sequence[Mapping[str, Any]],
    requested_tickers: Optional[Sequence[str]] = None,
    max_symbols: Optional[int] = None,
) -> List[Dict[str, Any]]:
    selected = [dict(record) for record in records]
    if requested_tickers:
        requested = [normalize_ticker(ticker) for ticker in requested_tickers]
        record_map = {normalize_ticker(record["ticker"]): dict(record) for record in records}
        missing = [ticker for ticker in requested if ticker not in record_map]
        if missing:
            raise CollectionError(f"Ticker(s) not found in universe: {', '.join(missing)}")
        selected = [record_map[ticker] for ticker in dict.fromkeys(requested)]
    if max_symbols is not None:
        selected = selected[:max_symbols]
    if not selected:
        raise CollectionError("No symbols selected")
    return selected


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8") as output:
        json.dump(value, output, indent=2, sort_keys=True, default=json_default)
        output.write("\n")
    os.replace(str(temporary), str(path))


def write_jsonl_atomic(path: Path, records: Iterable[Mapping[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8") as output:
        for record in records:
            output.write(json.dumps(record, sort_keys=True, default=json_default))
            output.write("\n")
    os.replace(str(temporary), str(path))


def append_json_line(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(value, sort_keys=True, default=json_default))
        output.write("\n")


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                value = json.loads(stripped)
            except json.JSONDecodeError as error:
                raise CollectionError(f"Invalid JSONL at {path}:{line_number}: {error}") from error
            if not isinstance(value, dict):
                raise CollectionError(f"Expected a JSON object at {path}:{line_number}")
            records.append(value)
    return records


def json_default(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def rating_to_dict(rating: Any) -> Dict[str, Any]:
    if isinstance(rating, Mapping):
        return dict(rating)
    if is_dataclass(rating):
        return asdict(rating)
    if hasattr(rating, "__dict__"):
        return {key: value for key, value in vars(rating).items() if not key.startswith("_")}
    raise CollectionError(f"Unsupported Massive rating value: {type(rating).__name__}")


def safe_ticker_filename(ticker: str) -> str:
    return re.sub(r"[^A-Z0-9._-]", "_", normalize_ticker(ticker))


def status_code_from_error(error: BaseException) -> Optional[int]:
    for candidate in (
        getattr(error, "status", None),
        getattr(error, "status_code", None),
        getattr(getattr(error, "response", None), "status", None),
        getattr(getattr(error, "response", None), "status_code", None),
    ):
        try:
            if candidate is not None:
                return int(candidate)
        except (TypeError, ValueError):
            continue
    return None


def is_retryable_error(error: BaseException) -> bool:
    if isinstance(error, CollectionError):
        return False
    status_code = status_code_from_error(error)
    if status_code is not None:
        return status_code == 429 or status_code >= 500
    normalized_message = str(error).lower()
    if any(
        marker in normalized_message
        for marker in (
            "api key",
            "not authorized",
            "unauthorized",
            "forbidden",
            "not entitled",
            "entitlement",
            "upgrade your plan",
        )
    ):
        return False
    return True


def redact_error(error: BaseException, api_key: str) -> str:
    message = str(error)
    return message.replace(api_key, "[REDACTED]") if api_key else message


def build_query(args: argparse.Namespace, ticker: str) -> Dict[str, Any]:
    query: Dict[str, Any] = {
        "ticker": normalize_ticker(ticker),
        "limit": args.page_size,
        "sort": "last_updated.asc",
    }
    if args.start is not None:
        query["date_gte"] = args.start.isoformat()
    if args.end is not None:
        query["date_lte"] = args.end.isoformat()
    return query


def fetch_symbol_with_retry(
    client: Any,
    ticker: str,
    destination: Path,
    args: argparse.Namespace,
    run_id: str,
    api_key: str,
    event_log: Path,
    sleep_fn: Callable[[float], None] = time.sleep,
    random_fn: Callable[[], float] = random.random,
) -> Tuple[int, int]:
    query = build_query(args, ticker)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.pending")
    last_error: Optional[BaseException] = None

    for attempt in range(1, args.retry_attempts + 1):
        record_count = 0
        started_at = iso_utc()
        try:
            with temporary.open("w", encoding="utf-8") as output:
                for rating in client.list_benzinga_ratings(**query):
                    record = rating_to_dict(rating)
                    response_ticker = record.get("ticker")
                    if response_ticker and normalize_ticker(response_ticker) != normalize_ticker(ticker):
                        raise CollectionError(
                            f"Massive returned ticker {response_ticker!r} while fetching {ticker}"
                        )
                    wrapped = dict(record)
                    wrapped["_ingest"] = {
                        "source": SOURCE_NAME,
                        "requested_ticker": normalize_ticker(ticker),
                        "fetched_at": iso_utc(),
                        "run_id": run_id,
                    }
                    output.write(json.dumps(wrapped, sort_keys=True, default=json_default))
                    output.write("\n")
                    record_count += 1
            os.replace(str(temporary), str(destination))
            append_json_line(
                event_log,
                {
                    "event": "symbol_fetch_succeeded",
                    "ticker": ticker,
                    "attempt": attempt,
                    "records": record_count,
                    "started_at": started_at,
                    "finished_at": iso_utc(),
                },
            )
            return record_count, attempt
        except BaseException as error:
            if isinstance(error, (KeyboardInterrupt, SystemExit)):
                raise
            last_error = error
            retryable = is_retryable_error(error)
            append_json_line(
                event_log,
                {
                    "event": "symbol_fetch_attempt_failed",
                    "ticker": ticker,
                    "attempt": attempt,
                    "retryable": retryable,
                    "status_code": status_code_from_error(error),
                    "error_type": type(error).__name__,
                    "error": redact_error(error, api_key),
                    "finished_at": iso_utc(),
                },
            )
            if not retryable or attempt >= args.retry_attempts:
                break
            delay = args.retry_delay_seconds * (2 ** (attempt - 1))
            delay += args.retry_delay_seconds * 0.25 * random_fn()
            sleep_fn(delay)

    assert last_error is not None
    raise SymbolFetchError(ticker, attempt, last_error)


def checkpoint_path(run_dir: Path, ticker: str) -> Path:
    return run_dir / "checkpoints" / f"{safe_ticker_filename(ticker)}.json"


def row_path(run_dir: Path, ticker: str) -> Path:
    return run_dir / "symbols" / f"{safe_ticker_filename(ticker)}.jsonl"


def load_checkpoint(run_dir: Path, ticker: str) -> Optional[Dict[str, Any]]:
    path = checkpoint_path(run_dir, ticker)
    if not path.is_file():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CollectionError(f"Invalid checkpoint {path}: {error}") from error
    if value.get("status") not in {"succeeded", "no_data"}:
        return None
    if not row_path(run_dir, ticker).is_file():
        return None
    return value


def combine_rows(run_dir: Path, manifest: Sequence[Mapping[str, Any]]) -> int:
    destination = run_dir / "rows.jsonl"
    temporary = run_dir / ".rows.jsonl.tmp"
    total = 0
    with temporary.open("w", encoding="utf-8") as output:
        for record in manifest:
            ticker = normalize_ticker(record["ticker"])
            if load_checkpoint(run_dir, ticker) is None:
                continue
            source_path = row_path(run_dir, ticker)
            with source_path.open(encoding="utf-8") as source:
                for line in source:
                    if line.strip():
                        output.write(line)
                        total += 1
    os.replace(str(temporary), str(destination))
    return total


def prepare_run(args: argparse.Namespace) -> Tuple[Path, str, List[Dict[str, Any]], bool]:
    if args.resume_run is not None:
        run_dir = args.resume_run.resolve()
        manifest_path = run_dir / "manifest.jsonl"
        config_path = run_dir / "run-config.json"
        if not manifest_path.is_file():
            raise CollectionError(f"Cannot resume: manifest not found at {manifest_path}")
        if not config_path.is_file():
            raise CollectionError(f"Cannot resume: run configuration not found at {config_path}")
        manifest = read_jsonl(manifest_path)
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
            args.start = date.fromisoformat(config["start"]) if config.get("start") else None
            args.end = date.fromisoformat(config["end"]) if config.get("end") else None
            args.page_size = int(config["page_size"])
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise CollectionError(f"Invalid run configuration {config_path}: {error}") from error
        run_id = str(config.get("run_id") or (manifest[0].get("run_id") if manifest else run_dir.name))
        return run_dir, run_id, manifest, True

    run_id = args.run_id or create_run_id()
    run_dir = (args.output_root / run_id).resolve()
    manifest_path = run_dir / "manifest.jsonl"
    if manifest_path.exists():
        raise CollectionError(f"Run already exists; use --resume-run {run_dir}")
    universe_records = load_symbol_universe(args.universe, args.universe_dir)
    manifest = select_symbols(universe_records, args.ticker, args.max_symbols)
    manifest = [dict(record, position=index, run_id=run_id) for index, record in enumerate(manifest, start=1)]
    run_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl_atomic(manifest_path, manifest)
    write_json_atomic(
        run_dir / "run-config.json",
        {
            "run_id": run_id,
            "source": SOURCE_NAME,
            "universe": args.universe,
            "start": args.start.isoformat() if args.start else None,
            "end": args.end.isoformat() if args.end else None,
            "page_size": args.page_size,
            "sort": "last_updated.asc",
            "created_at": iso_utc(),
        },
    )
    return run_dir, run_id, manifest, False


def run_collection(
    args: argparse.Namespace,
    client: Any,
    api_key: str,
    sleep_fn: Callable[[float], None] = time.sleep,
    random_fn: Callable[[], float] = random.random,
) -> Dict[str, Any]:
    run_dir, run_id, manifest, resumed = prepare_run(args)
    event_log = run_dir / "events.jsonl"
    invocation_started_at = iso_utc()
    failures: List[Dict[str, Any]] = []
    already_complete = 0
    attempted = 0
    attempts_total = 0

    append_json_line(
        event_log,
        {
            "event": "collection_started",
            "run_id": run_id,
            "resumed": resumed,
            "symbols": len(manifest),
            "started_at": invocation_started_at,
        },
    )

    for index, manifest_record in enumerate(manifest, start=1):
        ticker = normalize_ticker(manifest_record["ticker"])
        existing = load_checkpoint(run_dir, ticker)
        if existing is not None:
            already_complete += 1
            print(f"[{index}/{len(manifest)}] {ticker}: already complete ({existing.get('records', 0)} records)")
            continue

        attempted += 1
        print(f"[{index}/{len(manifest)}] {ticker}: fetching")
        started_at = iso_utc()
        try:
            record_count, attempts = fetch_symbol_with_retry(
                client=client,
                ticker=ticker,
                destination=row_path(run_dir, ticker),
                args=args,
                run_id=run_id,
                api_key=api_key,
                event_log=event_log,
                sleep_fn=sleep_fn,
                random_fn=random_fn,
            )
            attempts_total += attempts
            checkpoint = {
                "ticker": ticker,
                "status": "succeeded" if record_count else "no_data",
                "records": record_count,
                "attempts": attempts,
                "started_at": started_at,
                "finished_at": iso_utc(),
            }
            write_json_atomic(checkpoint_path(run_dir, ticker), checkpoint)
            print(f"[{index}/{len(manifest)}] {ticker}: {record_count} records")
        except SymbolFetchError as error:
            attempts_total += error.attempts
            failure = {
                "ticker": ticker,
                "attempts": error.attempts,
                "status_code": status_code_from_error(error.cause),
                "error_type": type(error.cause).__name__,
                "error": redact_error(error.cause, api_key),
                "failed_at": iso_utc(),
            }
            failures.append(failure)
            print(f"[{index}/{len(manifest)}] {ticker}: FAILED", file=sys.stderr)

        if args.request_delay_seconds and index < len(manifest):
            sleep_fn(args.request_delay_seconds)

    rows_written = combine_rows(run_dir, manifest)
    checkpoints = [load_checkpoint(run_dir, normalize_ticker(record["ticker"])) for record in manifest]
    complete_checkpoints = [checkpoint for checkpoint in checkpoints if checkpoint is not None]
    succeeded = sum(checkpoint["status"] == "succeeded" for checkpoint in complete_checkpoints)
    no_data = sum(checkpoint["status"] == "no_data" for checkpoint in complete_checkpoints)
    failed_tickers = {failure["ticker"] for failure in failures}
    pending = [
        normalize_ticker(record["ticker"])
        for record, checkpoint in zip(manifest, checkpoints)
        if checkpoint is None and normalize_ticker(record["ticker"]) not in failed_tickers
    ]
    summary = {
        "event": "massive_benzinga_collection_complete",
        "run_id": run_id,
        "run_dir": str(run_dir),
        "source": SOURCE_NAME,
        "universe": manifest[0].get("universe") if manifest else None,
        "start": args.start.isoformat() if args.start else None,
        "end": args.end.isoformat() if args.end else None,
        "page_size": args.page_size,
        "resumed": resumed,
        "symbols_total": len(manifest),
        "symbols_already_complete": already_complete,
        "symbols_attempted": attempted,
        "symbols_succeeded": succeeded,
        "symbols_no_data": no_data,
        "symbols_failed": len(failures),
        "symbols_pending": len(pending),
        "attempts_this_invocation": attempts_total,
        "records_written": rows_written,
        "complete": len(complete_checkpoints) == len(manifest),
        "started_at": invocation_started_at,
        "finished_at": iso_utc(),
    }
    write_jsonl_atomic(run_dir / "failed-symbols.jsonl", failures)
    write_jsonl_atomic(
        run_dir / "no-data-symbols.jsonl",
        [checkpoint for checkpoint in complete_checkpoints if checkpoint["status"] == "no_data"],
    )
    write_json_atomic(run_dir / "summary.json", summary)
    append_json_line(event_log, summary)
    return summary


def create_massive_client(api_key: str) -> Any:
    try:
        from massive import RESTClient
    except ImportError as error:
        raise CollectionError(
            "The Massive SDK is not installed. Run this collector through "
            "batch-jobs/analyst-price-targets/from-massive/run.sh so uv synchronizes the locked environment."
        ) from error
    return RESTClient(api_key=api_key)


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect Massive Benzinga analyst ratings into restartable JSONL run artifacts."
    )
    parser.add_argument("--universe", default=DEFAULT_UNIVERSE, help="CSV name in the market-api data directory.")
    parser.add_argument("--universe-dir", type=Path, default=DEFAULT_UNIVERSE_DIR)
    parser.add_argument("--ticker", action="append", help="Collect one universe ticker; repeat for multiple tickers.")
    parser.add_argument("--max-symbols", type=positive_int, help="Limit symbols for a smoke test.")
    parser.add_argument("--start", type=date.fromisoformat, help="Inclusive rating event start date (YYYY-MM-DD).")
    parser.add_argument("--end", type=date.fromisoformat, help="Inclusive rating event end date (YYYY-MM-DD).")
    parser.add_argument("--page-size", type=page_size, default=DEFAULT_PAGE_SIZE)
    parser.add_argument("--retry-attempts", type=positive_int, default=DEFAULT_RETRY_ATTEMPTS)
    parser.add_argument("--retry-delay-seconds", type=non_negative_float, default=DEFAULT_RETRY_DELAY_SECONDS)
    parser.add_argument("--request-delay-seconds", type=non_negative_float, default=DEFAULT_REQUEST_DELAY_SECONDS)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_RUNS_DIR)
    parser.add_argument("--run-id", help="Optional new run identifier. Default: current UTC timestamp.")
    parser.add_argument("--resume-run", type=Path, help="Resume an existing run directory.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Accepted for clarity; this first slice always writes artifacts only and never writes a database.",
    )
    args = parser.parse_args(argv)
    if args.start and args.end and args.start > args.end:
        parser.error("--start must be before or equal to --end")
    if args.resume_run and (args.ticker or args.max_symbols or args.run_id or args.start or args.end):
        parser.error(
            "--resume-run cannot be combined with --ticker, --max-symbols, --run-id, --start, or --end"
        )
    return args


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    api_key = os.environ.get(API_KEY_ENV, "").strip()
    if not api_key:
        print(f"Missing {API_KEY_ENV}. Export the rotated Massive API key before running.", file=sys.stderr)
        return 2

    try:
        client = create_massive_client(api_key)
        summary = run_collection(args, client, api_key)
    except CollectionError as error:
        print(f"ERROR: {redact_error(error, api_key)}", file=sys.stderr)
        return 1

    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
