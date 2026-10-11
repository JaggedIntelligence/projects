from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from app.providers.symbols import load_symbol_universe, normalize_symbol
from app.repositories.questdb_seasonality import (
    LOOKBACK_ALL,
    SeasonalityBuildResult,
    fetch_symbols_with_daily_bars,
    rebuild_symbol_seasonality,
)

DEFAULT_SYMBOLS = ["AMD"]


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    symbols = resolve_symbols(args)
    if args.max_symbols is not None:
        symbols = symbols[: args.max_symbols]

    if not symbols:
        raise SystemExit("No symbols requested")

    if args.lookback_years != LOOKBACK_ALL:
        raise SystemExit("Only ALL lookback is supported for the MVP")

    results: list[SeasonalityBuildResult] = []
    failed_symbols: list[dict[str, str]] = []

    for symbol in symbols:
        try:
            result = rebuild_symbol_seasonality(symbol, provider=args.provider, lookback_years=args.lookback_years)
        except Exception as exc:
            failed_symbols.append({"symbol": symbol, "error": str(exc)})
            print(json.dumps({"event": "seasonality_symbol_failed", "symbol": symbol, "error": str(exc)}))
            continue

        results.append(result)
        print(
            json.dumps(
                {
                    "event": "seasonality_symbol_rebuilt",
                    "symbol": result.symbol,
                    "provider": result.provider,
                    "lookback_years": result.lookback_years,
                    "source_bars": result.source_bars,
                    "daily_return_rows": result.daily_return_rows,
                    "month_seasonality_rows": result.month_seasonality_rows,
                    "trading_day_seasonality_rows": result.trading_day_seasonality_rows,
                    "month_outcome_rows": result.month_outcome_rows,
                    "as_of_ts": result.as_of_ts.isoformat() if result.as_of_ts else None,
                }
            )
        )

    summary = build_run_summary(args, symbols, results, failed_symbols)
    write_run_summary_file(args.run_summary_file, summary)
    print(json.dumps(summary, indent=2))

    return 1 if failed_symbols else 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rebuild stock seasonality cache tables in QuestDB.")
    parser.add_argument("--symbol", action="append", help="Canonical app symbol to rebuild. Can be passed multiple times.")
    parser.add_argument("--symbols", nargs="+", help="Canonical app symbols to rebuild.")
    parser.add_argument("--symbols-file", help="Text file with one symbol per line.")
    parser.add_argument("--universe", help="Optional CSV universe name from app/data, for example sp500_current.")
    parser.add_argument("--all-symbols", action="store_true", help="Rebuild every symbol currently present in equity_ohlcv_daily for the provider.")
    parser.add_argument("--provider", default="yfinance")
    parser.add_argument("--lookback-years", default=LOOKBACK_ALL)
    parser.add_argument("--max-symbols", type=positive_int, help="Limit resolved symbols for smoke tests.")
    parser.add_argument("--run-summary-file", help="Optional JSON file path for a machine-readable run summary.")
    args = parser.parse_args(argv)

    args.provider = args.provider.strip().lower()
    args.lookback_years = args.lookback_years.strip().upper()
    return args


def resolve_symbols(args: argparse.Namespace) -> list[str]:
    symbols: list[str] = []

    if args.all_symbols:
        symbols.extend(fetch_symbols_with_daily_bars(provider=args.provider))

    if args.universe:
        symbols.extend(entry.symbol for entry in load_symbol_universe(args.universe))

    if args.symbol:
        symbols.extend(args.symbol)

    if args.symbols:
        symbols.extend(args.symbols)

    if args.symbols_file:
        symbols.extend(read_symbols_file(args.symbols_file))

    if not symbols:
        symbols.extend(DEFAULT_SYMBOLS)

    return list(dict.fromkeys(normalize_symbol(symbol) for symbol in symbols if symbol.strip()))


def read_symbols_file(path: str) -> list[str]:
    input_path = Path(path)
    return [
        line.strip()
        for line in input_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def build_run_summary(
    args: argparse.Namespace,
    symbols: list[str],
    results: list[SeasonalityBuildResult],
    failed_symbols: list[dict[str, str]],
) -> dict[str, object]:
    return {
        "event": "stock_seasonality_rebuild_complete",
        "provider": args.provider,
        "lookback_years": args.lookback_years,
        "requested_symbols": symbols,
        "processed_symbols": [result.symbol for result in results],
        "failed_symbols": failed_symbols,
        "total_source_bars": sum(result.source_bars for result in results),
        "total_daily_return_rows": sum(result.daily_return_rows for result in results),
        "total_month_seasonality_rows": sum(result.month_seasonality_rows for result in results),
        "total_trading_day_seasonality_rows": sum(result.trading_day_seasonality_rows for result in results),
        "total_month_outcome_rows": sum(result.month_outcome_rows for result in results),
        "run_summary_file": args.run_summary_file,
    }


def write_run_summary_file(path: str | None, summary: dict[str, object]) -> None:
    if not path:
        return

    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"event": "run_summary_file_written", "path": str(output_path)}))


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
