from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from datetime import date
from time import sleep

from app.providers.symbols import load_symbol_universe, normalize_symbol
from app.providers.yfinance_provider import YFinanceProvider
from app.repositories.questdb_daily_bars import fetch_daily_coverage, insert_daily_bars

DEFAULT_START = date(2010, 1, 1)
DEFAULT_SYMBOLS = ["AAPL", "MSFT", "SPY"]


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
    failed_symbols: list[str] = []

    for batch in batches(symbols, args.batch_size):
        try:
            bars = provider.fetch_daily_bars(batch, start=args.start, end=args.end)
        except Exception as exc:
            failed_symbols.extend(batch)
            print(json.dumps({"event": "batch_failed", "symbols": batch, "error": str(exc)}))
            continue

        total_fetched += len(bars)
        inserted = insert_daily_bars(bars)
        total_inserted += inserted
        print(json.dumps({"event": "batch_inserted", "symbols": batch, "fetched_bars": len(bars), "inserted_bars": inserted}))

    coverage = wait_for_coverage(symbols, args.provider)
    print(
        json.dumps(
            {
                "event": "backfill_complete",
                "provider": args.provider,
                "symbols": symbols,
                "start": args.start.isoformat(),
                "end": args.end.isoformat() if args.end else None,
                "fetched_bars": total_fetched,
                "inserted_bars": total_inserted,
                "failed_symbols": failed_symbols,
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


def wait_for_coverage(symbols: list[str], provider: str, attempts: int = 10, delay_seconds: float = 0.25) -> list[dict[str, object]]:
    coverage = []
    for _ in range(attempts):
        coverage = [fetch_daily_coverage(symbol, provider=provider) for symbol in symbols]
        if all(item.row_count > 0 for item in coverage):
            break
        sleep(delay_seconds)

    return [item.model_dump(mode="json") for item in coverage]


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
