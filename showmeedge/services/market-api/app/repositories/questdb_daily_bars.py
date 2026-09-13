from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from app.models import DailyOhlcvBar, MarketDataCoverage
from app.questdb import questdb_connection, sql_literal

EQUITY_OHLCV_DAILY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS equity_ohlcv_daily (
  ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  provider_symbol SYMBOL CAPACITY 1024,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  adj_close DOUBLE,
  volume LONG,
  close_change_pct DOUBLE,
  ema10 DOUBLE,
  ema20 DOUBLE,
  ema50 DOUBLE,
  ema200 DOUBLE,
  volema10 DOUBLE,
  volema20 DOUBLE,
  currency SYMBOL CAPACITY 8,
  ingested_at TIMESTAMP
) TIMESTAMP(ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(ts, symbol, provider)
"""

EQUITY_OHLCV_DAILY_MIGRATION_SQL = {
    "close_change_pct": "ALTER TABLE equity_ohlcv_daily ADD COLUMN close_change_pct DOUBLE",
    "ema10": "ALTER TABLE equity_ohlcv_daily ADD COLUMN ema10 DOUBLE",
    "ema20": "ALTER TABLE equity_ohlcv_daily ADD COLUMN ema20 DOUBLE",
    "ema50": "ALTER TABLE equity_ohlcv_daily ADD COLUMN ema50 DOUBLE",
    "ema200": "ALTER TABLE equity_ohlcv_daily ADD COLUMN ema200 DOUBLE",
    "volema10": "ALTER TABLE equity_ohlcv_daily ADD COLUMN volema10 DOUBLE",
    "volema20": "ALTER TABLE equity_ohlcv_daily ADD COLUMN volema20 DOUBLE",
}


def ensure_equity_ohlcv_daily_table() -> None:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(EQUITY_OHLCV_DAILY_TABLE_SQL)


def migrate_equity_ohlcv_daily_table() -> None:
    ensure_equity_ohlcv_daily_table()
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT \"column\" FROM table_columns('equity_ohlcv_daily')")
            existing_columns = {str(row[0]) for row in cursor.fetchall()}
            for column, statement in EQUITY_OHLCV_DAILY_MIGRATION_SQL.items():
                if column not in existing_columns:
                    cursor.execute(statement)


def insert_daily_bars(bars: list[DailyOhlcvBar]) -> int:
    ensure_equity_ohlcv_daily_table()
    if not bars:
        return 0

    ingested_at = datetime.now(timezone.utc)
    rows = [
        (
            _normalize_symbol(bar.symbol),
            _normalize_provider(bar.provider),
            _normalize_provider_symbol(bar.provider_symbol or bar.symbol),
            datetime.combine(bar.time, time.min, tzinfo=timezone.utc),
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.adj_close,
            bar.volume,
            bar.currency.upper(),
            ingested_at,
        )
        for bar in bars
    ]

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO equity_ohlcv_daily
                  (symbol, provider, provider_symbol, ts, open, high, low, close, adj_close, volume, currency, ingested_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )

    return len(rows)


def fetch_daily_bars(
    symbol: str,
    provider: str = "yfinance",
    start: date | None = None,
    end: date | None = None,
    limit: int | None = None,
) -> list[DailyOhlcvBar]:
    ensure_equity_ohlcv_daily_table()

    clauses = _symbol_provider_clauses(symbol, provider)
    if start is not None:
        clauses.append(f"ts >= {_questdb_date_expr(start)}")
    if end is not None:
        clauses.append(f"ts < {_questdb_date_expr(end + timedelta(days=1))}")

    limit_sql = ""
    if limit is not None:
        if limit <= 0:
            raise ValueError("limit must be greater than 0")
        limit_sql = f" LIMIT {int(limit)}"

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT ts, symbol, provider, provider_symbol, open, high, low, close, adj_close, volume, currency
                FROM equity_ohlcv_daily
                WHERE {" AND ".join(clauses)}
                ORDER BY ts ASC
                {limit_sql}
                """
            )
            rows = cursor.fetchall()

    return [
        DailyOhlcvBar(
            time=_to_date(row[0]),
            symbol=str(row[1]),
            provider=str(row[2]),
            provider_symbol=str(row[3]) if row[3] is not None else None,
            open=float(row[4]),
            high=float(row[5]),
            low=float(row[6]),
            close=float(row[7]),
            adj_close=float(row[8]) if row[8] is not None else None,
            volume=int(row[9]),
            currency=str(row[10] or "USD"),
        )
        for row in rows
    ]


def fetch_daily_coverage(symbol: str, provider: str = "yfinance") -> MarketDataCoverage:
    ensure_equity_ohlcv_daily_table()

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT min(ts), max(ts), count()
                FROM equity_ohlcv_daily
                WHERE {" AND ".join(_symbol_provider_clauses(symbol, provider))}
                """
            )
            row = cursor.fetchone()

    first_bar = _to_date(row[0]) if row and row[0] is not None else None
    last_bar = _to_date(row[1]) if row and row[1] is not None else None
    row_count = int(row[2] or 0) if row else 0

    return MarketDataCoverage(
        symbol=_normalize_symbol(symbol),
        provider=_normalize_provider(provider),
        start=first_bar,
        end=last_bar,
        row_count=row_count,
    )


def _symbol_provider_clauses(symbol: str, provider: str) -> list[str]:
    return [
        f"symbol = {sql_literal(_normalize_symbol(symbol))}",
        f"provider = {sql_literal(_normalize_provider(provider))}",
    ]


def _questdb_date_expr(value: date) -> str:
    return f"to_timestamp({sql_literal(value.isoformat())}, 'yyyy-MM-dd')"


def _to_date(value: object) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()


def _normalize_symbol(value: str) -> str:
    return value.strip().upper()


def _normalize_provider(value: str) -> str:
    return value.strip().lower()


def _normalize_provider_symbol(value: str) -> str:
    return value.strip().upper()
