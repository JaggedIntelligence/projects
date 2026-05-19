from contextlib import contextmanager
from datetime import datetime, time, timezone
from typing import Iterator

import psycopg

from app.config import Settings, get_settings
from app.models import OhlcvBar, Timeframe

TABLE_SQL = """
CREATE TABLE IF NOT EXISTS market_bars (
  symbol SYMBOL,
  provider SYMBOL,
  timeframe SYMBOL,
  ts TIMESTAMP,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  volume LONG
) TIMESTAMP(ts) PARTITION BY DAY
"""


@contextmanager
def questdb_connection(settings: Settings | None = None) -> Iterator[psycopg.Connection]:
    config = settings or get_settings()
    with psycopg.connect(
        host=config.questdb_host,
        port=config.questdb_pg_port,
        user=config.questdb_user,
        password=config.questdb_password,
        dbname=config.questdb_database,
        autocommit=True,
    ) as connection:
        yield connection


def ensure_market_bars_table() -> None:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(TABLE_SQL)


def ping_questdb() -> bool:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone() is not None


def insert_bars(symbol: str, timeframe: Timeframe, provider: str, bars: list[OhlcvBar]) -> int:
    ensure_market_bars_table()
    if not bars:
        return 0

    normalized_symbol = symbol.upper()
    rows = [
        (
            normalized_symbol,
            provider,
            timeframe,
            datetime.combine(bar.time, time.min, tzinfo=timezone.utc),
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.volume,
        )
        for bar in bars
    ]

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO market_bars
                  (symbol, provider, timeframe, ts, open, high, low, close, volume)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )

    return len(rows)


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def fetch_bars(symbol: str, timeframe: Timeframe) -> list[OhlcvBar]:
    ensure_market_bars_table()
    normalized_symbol = symbol.upper()

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT ts, open, high, low, close, volume
                FROM market_bars
                WHERE symbol = {sql_literal(normalized_symbol)} AND timeframe = {sql_literal(timeframe)}
                ORDER BY ts ASC
                """
            )
            rows = cursor.fetchall()

    deduped: dict[str, OhlcvBar] = {}
    for row in rows:
        timestamp_value = row[0]
        if isinstance(timestamp_value, datetime):
            bar_date = timestamp_value.date()
        else:
            bar_date = timestamp_value

        deduped[str(bar_date)] = OhlcvBar(
            time=bar_date,
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=int(row[5]),
        )

    return list(deduped.values())
