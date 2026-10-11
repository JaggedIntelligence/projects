from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from time import sleep
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.jobs.backfill_daily import (
    backfill_batch,
    batches,
    build_run_summary,
    non_negative_float,
    positive_int,
    resolve_symbols,
    wait_for_coverage,
    write_failed_symbols_file,
    write_no_data_symbols_file,
    write_run_summary_file,
)
from app.providers.symbols import load_symbol_universe
from app.providers.yfinance_provider import YFinanceProvider

DEFAULT_UNIVERSE = "sp500_current"
DEFAULT_LOOKBACK_DAYS = 10
DEFAULT_MARKET_TIMEZONE = "America/New_York"


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

    total_fetched = 0
    total_inserted = 0
    no_data_symbols: list[str] = []
    failed_symbols: list[str] = []

    for batch_index, batch in enumerate(batches(symbols, args.batch_size), start=1):
        result = backfill_batch(provider, batch, args, batch_index=batch_index)
        total_fetched += result.fetched_bars
        total_inserted += result.inserted_bars
        no_data_symbols.extend(result.no_data_symbols)
        failed_symbols.extend(result.failed_symbols)

        if args.sleep_seconds > 0:
            sleep(args.sleep_seconds)

    no_data_symbols = list(dict.fromkeys(no_data_symbols))
    failed_symbols = list(dict.fromkeys(failed_symbols))
    coverage = wait_for_coverage(symbols, args.provider)

    write_failed_symbols_file(args.failed_symbols_file, failed_symbols, args)
    write_no_data_symbols_file(args.no_data_symbols_file, no_data_symbols, args)

    summary = build_run_summary(
        args=args,
        symbols=symbols,
        symbols_to_process=symbols,
        skipped_symbols=[],
        fetched_bars=total_fetched,
        inserted_bars=total_inserted,
        no_data_symbols=no_data_symbols,
        failed_symbols=failed_symbols,
        coverage=coverage,
    )
    summary["event"] = "daily_recent_update_complete"
    summary["lookback_days"] = args.lookback_days
    summary["timezone"] = args.timezone

    write_run_summary_file(args.run_summary_file, summary)
    print(json.dumps(summary, indent=2))

    return 1 if failed_symbols else 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh recent daily OHLCV bars into QuestDB.")
    parser.add_argument("--symbols", nargs="+", help="Canonical app symbols to refresh.")
    parser.add_argument("--universe", default=DEFAULT_UNIVERSE, help="CSV universe name from app/data.")
    parser.add_argument("--lookback-days", type=positive_int, default=DEFAULT_LOOKBACK_DAYS)
    parser.add_argument("--start", type=date.fromisoformat, help="Optional inclusive start date. Overrides --lookback-days.")
    parser.add_argument("--end", type=date.fromisoformat, help="Optional inclusive end date. Default: today in --timezone.")
    parser.add_argument("--timezone", default=DEFAULT_MARKET_TIMEZONE)
    parser.add_argument("--provider", choices=["yfinance"], default="yfinance")
    parser.add_argument("--batch-size", type=positive_int, default=10)
    parser.add_argument("--max-symbols", type=positive_int, help="Limit the resolved symbol list for smoke tests.")
    parser.add_argument("--retry-attempts", type=positive_int, default=3)
    parser.add_argument("--retry-sleep-seconds", type=non_negative_float, default=5.0)
    parser.add_argument("--sleep-seconds", type=non_negative_float, default=1.0, help="Pause between batches.")
    parser.add_argument("--failed-symbols-file", help="Optional JSON file path for failed symbols.")
    parser.add_argument("--no-data-symbols-file", help="Optional JSON file path for symbols with no bars in the requested range.")
    parser.add_argument("--run-summary-file", help="Optional JSON file path for a machine-readable run summary.")

    args = parser.parse_args(argv)
    if args.end is None:
        args.end = today_in_timezone(args.timezone, parser)
    if args.start is None:
        args.start = args.end - timedelta(days=args.lookback_days)
    if args.start > args.end:
        parser.error("--start must be less than or equal to --end")
    return args


def today_in_timezone(timezone_name: str, parser: argparse.ArgumentParser) -> date:
    try:
        timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        parser.error(f"Unknown timezone: {timezone_name}")

    return datetime.now(timezone).date()


if __name__ == "__main__":
    raise SystemExit(main())
