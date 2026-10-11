from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import yfinance as yf


OUTPUT_COLUMNS = [
    "symbol",
    "earnings_datetime",
    "eps_estimate",
    "reported_eps",
    "surprise_pct",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch historical Yahoo Finance earnings dates via yfinance.",
    )
    parser.add_argument(
        "symbols",
        nargs="*",
        default=["AAPL"],
        help="Ticker symbols to fetch. Defaults to AAPL.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum rows to fetch per symbol, paged in Yahoo chunks of 100.",
    )
    parser.add_argument(
        "--start",
        type=date.fromisoformat,
        help="Optional inclusive YYYY-MM-DD start date filter.",
    )
    parser.add_argument(
        "--end",
        type=date.fromisoformat,
        help="Optional inclusive YYYY-MM-DD end date filter.",
    )
    parser.add_argument(
        "--csv",
        action="store_true",
        help="Print CSV instead of a table.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Write JSON records to this path.",
    )
    return parser.parse_args()


def fetch_earnings_dates(symbol: str, limit: int) -> pd.DataFrame:
    ticker = yf.Ticker(symbol)
    frames: list[pd.DataFrame] = []
    offset = 0
    remaining = limit

    while remaining > 0:
        request_limit = min(remaining, 100)
        earnings = ticker.get_earnings_dates(limit=request_limit, offset=offset)
        if earnings is None or earnings.empty:
            break

        frames.append(earnings)
        fetched_count = len(earnings)
        if fetched_count < request_limit:
            break

        offset += fetched_count
        remaining -= fetched_count

    if not frames:
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    earnings = pd.concat(frames)
    if earnings is None or earnings.empty:
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    rows = earnings.reset_index()
    rows = rows.rename(
        columns={
            "Earnings Date": "earnings_datetime",
            "EPS Estimate": "eps_estimate",
            "Reported EPS": "reported_eps",
            "Surprise(%)": "surprise_pct",
        }
    )
    rows.insert(0, "symbol", symbol.upper())
    return rows[OUTPUT_COLUMNS]


def apply_date_filters(
    rows: pd.DataFrame,
    start: date | None,
    end: date | None,
) -> pd.DataFrame:
    if rows.empty or (start is None and end is None):
        return rows

    earnings_dates = pd.to_datetime(rows["earnings_datetime"], utc=True).dt.date
    if start is not None:
        rows = rows[earnings_dates >= start]
        earnings_dates = earnings_dates[earnings_dates >= start]
    if end is not None:
        rows = rows[earnings_dates <= end]
    return rows


def write_json(rows: pd.DataFrame, path: Path) -> None:
    serializable_rows = rows.copy()
    serializable_rows["earnings_datetime"] = serializable_rows["earnings_datetime"].map(
        lambda value: value.isoformat() if pd.notna(value) else None
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    serializable_rows.to_json(path, orient="records", indent=2)


def main() -> int:
    args = parse_args()
    frames: list[pd.DataFrame] = []

    for symbol in args.symbols:
        try:
            frames.append(fetch_earnings_dates(symbol, args.limit))
        except Exception as exc:
            print(f"{symbol}: failed to fetch earnings dates: {exc}", file=sys.stderr)

    if not frames:
        print("No earnings data returned.")
        return 1

    rows = pd.concat(frames, ignore_index=True)
    rows = apply_date_filters(rows, args.start, args.end)
    if rows.empty:
        print("No earnings rows matched the requested symbols/date filters.")
        return 0

    rows = rows.sort_values(
        by=["symbol", "earnings_datetime"],
        ascending=[True, False],
    )

    if args.csv:
        rows.to_csv(sys.stdout, index=False)
    elif args.json_output is not None:
        write_json(rows, args.json_output)
        print(f"Wrote {len(rows)} earnings rows to {args.json_output}")
    else:
        print(rows.to_string(index=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
