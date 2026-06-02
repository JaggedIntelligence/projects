from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from collections.abc import Sequence
from datetime import date, timedelta
from pathlib import Path
from time import sleep

from app.models import DailyOhlcvBar
from app.providers.symbols import load_symbol_universe, normalize_symbol
from app.providers.yfinance_provider import YFinanceProvider
from app.repositories.questdb_daily_bars import fetch_daily_coverage, insert_daily_bars

DEFAULT_START = date(2010, 1, 1)
DEFAULT_SYMBOLS = ["AAPL", "MSFT", "SPY"]
DEFAULT_COVERAGE_STALE_DAYS = 7


@dataclass(frozen=True)
class BackfillAttemptResult:
    fetched_bars: int
    inserted_bars: int
    missing_symbols: list[str]


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    symbols = resolve_symbols(args.symbols, args.universe)
    if args.max_symbols is not None:
        symbols = symbols[: args.max_symbols]

    if not symbols:
        raise SystemExit("No symbols requested")

    if args.provider != "yfinance":
        raise SystemExit(f"Unsupported provider: {args.provider}")

    universe_symbols = load_symbol_universe(args.universe) if args.universe else []
    provider = YFinanceProvider(universe_symbols)
    symbols_to_process, skipped_symbols = filter_existing_symbols(symbols, args)

    total_fetched = 0
    total_inserted = 0
    failed_symbols: list[str] = []

    for batch_index, batch in enumerate(batches(symbols_to_process, args.batch_size), start=1):
        result = backfill_batch(provider, batch, args, batch_index=batch_index)
        total_fetched += result.fetched_bars
        total_inserted += result.inserted_bars
        failed_symbols.extend(result.missing_symbols)

        if args.sleep_seconds > 0:
            sleep(args.sleep_seconds)

    failed_symbols = list(dict.fromkeys(failed_symbols))
    coverage = wait_for_coverage(symbols, args.provider)
    write_failed_symbols_file(args.failed_symbols_file, failed_symbols, args)
    print(
        json.dumps(
            {
                "event": "backfill_complete",
                "provider": args.provider,
                "symbols": symbols,
                "processed_symbols": symbols_to_process,
                "skipped_symbols": skipped_symbols,
                "start": args.start.isoformat(),
                "end": args.end.isoformat() if args.end else None,
                "fetched_bars": total_fetched,
                "inserted_bars": total_inserted,
                "failed_symbols": failed_symbols,
                "failed_symbols_file": args.failed_symbols_file,
                "coverage": coverage,
            },
            indent=2,
        )
    )

    return 1 if failed_symbols else 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill daily OHLCV bars into QuestDB.")
    parser.add_argument("--symbols", nargs="+", help="Canonical app symbols to backfill.")
    parser.add_argument("--universe", help="Optional CSV universe name from app/data, for example sp500_current.")
    parser.add_argument("--start", type=date.fromisoformat, default=DEFAULT_START)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--provider", choices=["yfinance"], default="yfinance")
    parser.add_argument("--batch-size", type=positive_int, default=3)
    parser.add_argument("--max-symbols", type=positive_int, help="Limit the resolved symbol list for smoke tests.")
    parser.add_argument("--skip-existing", action="store_true", help="Skip symbols that already have recent coverage in QuestDB.")
    parser.add_argument("--coverage-stale-days", type=non_negative_int, default=DEFAULT_COVERAGE_STALE_DAYS)
    parser.add_argument("--retry-attempts", type=positive_int, default=1)
    parser.add_argument("--retry-sleep-seconds", type=non_negative_float, default=5.0)
    parser.add_argument("--sleep-seconds", type=non_negative_float, default=0.0, help="Pause between batches.")
    parser.add_argument(
        "--failed-symbols-file",
        help="Optional JSON file path for failed symbols inside the running environment. The safe shell wrapper copies this into scripts/LOG.",
    )
    return parser.parse_args(argv)


def resolve_symbols(symbols: list[str] | None, universe: str | None = None) -> list[str]:
    if universe:
        universe_entries = load_symbol_universe(universe)
        if symbols is None:
            return [entry.symbol for entry in universe_entries]

        allowed_symbols = {entry.symbol for entry in universe_entries}
        normalized_symbols = [normalize_symbol(symbol) for symbol in symbols]
        resolved = [symbol for symbol in normalized_symbols if symbol in allowed_symbols]
        missing = sorted(set(normalized_symbols) - allowed_symbols)
        if missing:
            print(json.dumps({"event": "symbols_skipped_not_in_universe", "symbols": missing}))
        return list(dict.fromkeys(resolved))

    symbols = symbols or DEFAULT_SYMBOLS
    return list(dict.fromkeys(normalize_symbol(symbol) for symbol in symbols if symbol.strip()))


def batches(symbols: list[str], batch_size: int) -> list[list[str]]:
    return [symbols[index : index + batch_size] for index in range(0, len(symbols), batch_size)]


def filter_existing_symbols(symbols: list[str], args: argparse.Namespace) -> tuple[list[str], list[str]]:
    if not args.skip_existing:
        return symbols, []

    symbols_to_process: list[str] = []
    skipped_symbols: list[str] = []
    for symbol in symbols:
        coverage = fetch_daily_coverage(symbol, provider=args.provider)
        if coverage_is_complete(coverage.start, coverage.end, coverage.row_count, args):
            skipped_symbols.append(symbol)
            print(json.dumps({"event": "symbol_skipped_existing", "symbol": symbol, "coverage": coverage.model_dump(mode="json")}))
        else:
            symbols_to_process.append(symbol)

    return symbols_to_process, skipped_symbols


def coverage_is_complete(coverage_start: date | None, coverage_end: date | None, row_count: int, args: argparse.Namespace) -> bool:
    if row_count <= 0 or coverage_end is None:
        return False

    if args.end is not None:
        return coverage_end >= args.end

    recent_enough_date = date.today() - timedelta(days=args.coverage_stale_days)
    return coverage_end >= recent_enough_date


def backfill_batch(provider: YFinanceProvider, symbols: list[str], args: argparse.Namespace, batch_index: int) -> BackfillAttemptResult:
    for attempt in range(1, args.retry_attempts + 1):
        try:
            result = fetch_and_insert(provider, symbols, args)
        except Exception as exc:
            print(
                json.dumps(
                    {
                        "event": "batch_failed_attempt",
                        "batch_index": batch_index,
                        "attempt": attempt,
                        "symbols": symbols,
                        "error": str(exc),
                    }
                )
            )
            sleep_before_retry(attempt, args)
            continue

        print(
            json.dumps(
                {
                    "event": "batch_inserted",
                    "batch_index": batch_index,
                    "attempt": attempt,
                    "symbols": symbols,
                    "fetched_bars": result.fetched_bars,
                    "inserted_bars": result.inserted_bars,
                    "missing_symbols": result.missing_symbols,
                }
            )
        )

        if not result.missing_symbols:
            return result

        individual_result = retry_individual_symbols(provider, result.missing_symbols, args)
        return BackfillAttemptResult(
            fetched_bars=result.fetched_bars + individual_result.fetched_bars,
            inserted_bars=result.inserted_bars + individual_result.inserted_bars,
            missing_symbols=individual_result.missing_symbols,
        )

    print(json.dumps({"event": "batch_retry_exhausted", "batch_index": batch_index, "symbols": symbols}))
    if len(symbols) == 1:
        return BackfillAttemptResult(fetched_bars=0, inserted_bars=0, missing_symbols=symbols)

    return retry_individual_symbols(provider, symbols, args)


def retry_individual_symbols(provider: YFinanceProvider, symbols: list[str], args: argparse.Namespace) -> BackfillAttemptResult:
    total_fetched = 0
    total_inserted = 0
    failed_symbols: list[str] = []

    for symbol in symbols:
        symbol_result = backfill_single_symbol(provider, symbol, args)
        total_fetched += symbol_result.fetched_bars
        total_inserted += symbol_result.inserted_bars
        failed_symbols.extend(symbol_result.missing_symbols)

    return BackfillAttemptResult(fetched_bars=total_fetched, inserted_bars=total_inserted, missing_symbols=failed_symbols)


def backfill_single_symbol(provider: YFinanceProvider, symbol: str, args: argparse.Namespace) -> BackfillAttemptResult:
    for attempt in range(1, args.retry_attempts + 1):
        try:
            result = fetch_and_insert(provider, [symbol], args)
        except Exception as exc:
            print(json.dumps({"event": "symbol_failed_attempt", "symbol": symbol, "attempt": attempt, "error": str(exc)}))
            sleep_before_retry(attempt, args)
            continue

        print(
            json.dumps(
                {
                    "event": "symbol_inserted",
                    "symbol": symbol,
                    "attempt": attempt,
                    "fetched_bars": result.fetched_bars,
                    "inserted_bars": result.inserted_bars,
                    "missing_symbols": result.missing_symbols,
                }
            )
        )
        return result

    return BackfillAttemptResult(fetched_bars=0, inserted_bars=0, missing_symbols=[symbol])


def fetch_and_insert(provider: YFinanceProvider, symbols: list[str], args: argparse.Namespace) -> BackfillAttemptResult:
    bars = provider.fetch_daily_bars(symbols, start=args.start, end=args.end)
    inserted = insert_daily_bars(bars)
    missing_symbols = symbols_without_bars(symbols, bars)
    return BackfillAttemptResult(fetched_bars=len(bars), inserted_bars=inserted, missing_symbols=missing_symbols)


def symbols_without_bars(symbols: list[str], bars: list[DailyOhlcvBar]) -> list[str]:
    symbols_with_bars = {bar.symbol for bar in bars}
    return [symbol for symbol in symbols if symbol not in symbols_with_bars]


def sleep_before_retry(attempt: int, args: argparse.Namespace) -> None:
    if attempt < args.retry_attempts and args.retry_sleep_seconds > 0:
        sleep(args.retry_sleep_seconds)


def wait_for_coverage(symbols: list[str], provider: str, attempts: int = 10, delay_seconds: float = 0.25) -> list[dict[str, object]]:
    coverage = []
    for _ in range(attempts):
        coverage = [fetch_daily_coverage(symbol, provider=provider) for symbol in symbols]
        if all(item.row_count > 0 for item in coverage):
            break
        sleep(delay_seconds)

    return [item.model_dump(mode="json") for item in coverage]


def write_failed_symbols_file(path: str | None, failed_symbols: list[str], args: argparse.Namespace) -> None:
    if not path:
        return

    payload = {
        "provider": args.provider,
        "universe": args.universe,
        "start": args.start.isoformat(),
        "end": args.end.isoformat() if args.end else None,
        "failed_symbols": failed_symbols,
    }
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"event": "failed_symbols_file_written", "path": str(output_path), "failed_symbols": failed_symbols}))


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def non_negative_int(value: str) -> int:
    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return parsed


def non_negative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
