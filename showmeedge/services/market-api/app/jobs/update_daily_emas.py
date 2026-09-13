from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from app.jobs.backfill_daily import positive_int, resolve_symbols
from app.questdb import questdb_connection, sql_literal
from app.repositories.questdb_daily_bars import migrate_equity_ohlcv_daily_table

EMA_EXPRESSIONS = {
    "ema10": "avg(coalesce(adj_close, close), 'period', 10)",
    "ema20": "avg(coalesce(adj_close, close), 'period', 20)",
    "ema50": "avg(coalesce(adj_close, close), 'period', 50)",
    "ema200": "avg(coalesce(adj_close, close), 'period', 200)",
    "volema10": "avg(volume, 'period', 10)",
    "volema20": "avg(volume, 'period', 20)",
}


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    symbols = selected_symbols(args)
    migrate_equity_ohlcv_daily_table()

    scope_sql = build_scope_sql(args.provider, symbols)
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(build_count_sql(scope_sql, only_missing=not args.rebuild_all))
            candidate_rows = int(cursor.fetchone()[0] or 0)

            if candidate_rows:
                cursor.execute(build_insert_sql(scope_sql, only_missing=not args.rebuild_all))

            cursor.execute(build_count_sql(scope_sql, only_missing=True))
            remaining_missing_rows = int(cursor.fetchone()[0] or 0)

    print(
        json.dumps(
            {
                "event": "daily_ema_update_complete",
                "provider": args.provider,
                "symbols": symbols,
                "rebuild_all": args.rebuild_all,
                "candidate_rows": candidate_rows,
                "remaining_missing_rows": remaining_missing_rows,
            },
            indent=2,
        )
    )
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate price and volume EMA columns on QuestDB daily OHLCV rows."
    )
    parser.add_argument("--provider", default="yfinance", help="Provider partition to update. Default: yfinance")
    parser.add_argument("--symbols", nargs="+", help="Optional symbols to update. Default: every symbol for the provider.")
    parser.add_argument("--universe", help="Optional CSV universe name from app/data, for example sp500_current.")
    parser.add_argument("--max-symbols", type=positive_int, help="Limit the selected symbols for a smoke test.")
    parser.add_argument(
        "--rebuild-all",
        action="store_true",
        help="Recalculate every selected row instead of updating only rows with an empty EMA column.",
    )
    return parser.parse_args(argv)


def selected_symbols(args: argparse.Namespace) -> list[str] | None:
    if args.symbols is None and args.universe is None:
        return None

    symbols = resolve_symbols(args.symbols, args.universe)
    if args.max_symbols is not None:
        symbols = symbols[: args.max_symbols]
    if not symbols:
        raise SystemExit("No symbols requested")
    return symbols


def build_scope_sql(provider: str, symbols: list[str] | None) -> str:
    clauses = [f"provider = {sql_literal(provider.strip().lower())}"]
    if symbols:
        symbol_values = ", ".join(sql_literal(symbol) for symbol in symbols)
        clauses.append(f"symbol IN ({symbol_values})")
    return " AND ".join(clauses)


def build_missing_sql(alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    return " OR ".join(f"{prefix}{column} IS NULL" for column in EMA_EXPRESSIONS)


def build_count_sql(scope_sql: str, *, only_missing: bool) -> str:
    missing_filter = f" AND ({build_missing_sql('target')})" if only_missing else ""
    return f"""
        SELECT count()
        FROM equity_ohlcv_daily target
        WHERE {scope_sql}{missing_filter}
    """


def build_insert_sql(scope_sql: str, *, only_missing: bool) -> str:
    calculated_columns = ",\n            ".join(
        f"{expression} OVER (PARTITION BY symbol, provider ORDER BY ts) AS calculated_{column}"
        for column, expression in EMA_EXPRESSIONS.items()
    )
    current_columns = ",\n            ".join(f"{column} AS current_{column}" for column in EMA_EXPRESSIONS)
    output_ema_columns = ",\n          ".join(f"calculated_{column}" for column in EMA_EXPRESSIONS)
    missing_filter = ""
    if only_missing:
        missing_filter = "\n        WHERE " + " OR ".join(
            f"current_{column} IS NULL" for column in EMA_EXPRESSIONS
        )

    return f"""
        WITH calculated AS (
          SELECT
            ts,
            symbol,
            provider,
            provider_symbol,
            open,
            high,
            low,
            close,
            adj_close,
            volume,
            currency,
            ingested_at,
            {current_columns},
            {calculated_columns}
          FROM equity_ohlcv_daily
          WHERE {scope_sql}
        )
        INSERT INTO equity_ohlcv_daily
          (ts, symbol, provider, provider_symbol, open, high, low, close, adj_close, volume,
           ema10, ema20, ema50, ema200, volema10, volema20, currency, ingested_at)
        SELECT
          ts, symbol, provider, provider_symbol, open, high, low, close, adj_close, volume,
          {output_ema_columns},
          currency, ingested_at
        FROM calculated{missing_filter}
    """


if __name__ == "__main__":
    raise SystemExit(main())
