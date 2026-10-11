from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from statistics import median, pstdev

from app.models import (
    MonthlyDailySeasonality,
    MonthlyOutcomeSeasonality,
    SeasonalityMonth,
    SeasonalityResponse,
    TradingDaySeasonality,
)
from app.questdb import questdb_connection, sql_literal

LOOKBACK_ALL = "ALL"
MONTH_CODES = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")

EQUITY_DAILY_RETURNS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS equity_daily_returns (
  ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  trade_year INT,
  month_num INT,
  month_code SYMBOL CAPACITY 3,
  trading_day_of_month INT,
  trading_day_of_year INT,
  close_price DOUBLE,
  adj_close_price DOUBLE,
  previous_adj_close_price DOUBLE,
  return_pct DOUBLE,
  direction SYMBOL CAPACITY 8,
  source_ingested_at TIMESTAMP,
  calculated_at TIMESTAMP
) TIMESTAMP(ts)
PARTITION BY MONTH WAL
DEDUP UPSERT KEYS(ts, symbol, provider)
"""

EQUITY_MONTH_SEASONALITY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS equity_month_seasonality (
  as_of_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  month_num INT,
  month_code SYMBOL CAPACITY 3,
  lookback_years SYMBOL CAPACITY 16,
  start_year INT,
  end_year INT,
  sample_years INT,
  sample_days LONG,
  up_days LONG,
  down_days LONG,
  flat_days LONG,
  percent_up_days DOUBLE,
  percent_down_days DOUBLE,
  percent_flat_days DOUBLE,
  avg_return_pct DOUBLE,
  median_return_pct DOUBLE,
  avg_up_day_return_pct DOUBLE,
  avg_down_day_return_pct DOUBLE,
  best_daily_return_pct DOUBLE,
  worst_daily_return_pct DOUBLE,
  stddev_return_pct DOUBLE,
  calculated_at TIMESTAMP
) TIMESTAMP(as_of_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(as_of_ts, symbol, provider, month_num, lookback_years)
"""

EQUITY_MONTH_TRADING_DAY_SEASONALITY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS equity_month_trading_day_seasonality (
  as_of_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  month_num INT,
  month_code SYMBOL CAPACITY 3,
  trading_day_of_month INT,
  lookback_years SYMBOL CAPACITY 16,
  start_year INT,
  end_year INT,
  sample_observations LONG,
  up_days LONG,
  down_days LONG,
  flat_days LONG,
  percent_up_days DOUBLE,
  percent_down_days DOUBLE,
  percent_flat_days DOUBLE,
  avg_return_pct DOUBLE,
  median_return_pct DOUBLE,
  avg_up_day_return_pct DOUBLE,
  avg_down_day_return_pct DOUBLE,
  best_return_pct DOUBLE,
  worst_return_pct DOUBLE,
  stddev_return_pct DOUBLE,
  calculated_at TIMESTAMP
) TIMESTAMP(as_of_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(as_of_ts, symbol, provider, month_num, trading_day_of_month, lookback_years)
"""

EQUITY_MONTH_OUTCOME_SEASONALITY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS equity_month_outcome_seasonality (
  as_of_ts TIMESTAMP,
  symbol SYMBOL CAPACITY 1024,
  provider SYMBOL CAPACITY 32,
  month_num INT,
  month_code SYMBOL CAPACITY 3,
  lookback_years SYMBOL CAPACITY 16,
  start_year INT,
  end_year INT,
  sample_months LONG,
  positive_months LONG,
  negative_months LONG,
  flat_months LONG,
  percent_positive_months DOUBLE,
  percent_negative_months DOUBLE,
  percent_flat_months DOUBLE,
  avg_month_return_pct DOUBLE,
  median_month_return_pct DOUBLE,
  avg_positive_month_return_pct DOUBLE,
  avg_negative_month_return_pct DOUBLE,
  best_month_return_pct DOUBLE,
  worst_month_return_pct DOUBLE,
  stddev_month_return_pct DOUBLE,
  calculated_at TIMESTAMP
) TIMESTAMP(as_of_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(as_of_ts, symbol, provider, month_num, lookback_years)
"""


@dataclass(frozen=True)
class SourceDailyBar:
    ts: datetime
    symbol: str
    provider: str
    close: float
    adj_close: float | None
    ingested_at: datetime | None

    @property
    def trade_date(self) -> date:
        return _to_date(self.ts)

    @property
    def return_price(self) -> float:
        return self.adj_close if self.adj_close is not None else self.close


@dataclass(frozen=True)
class DailyReturnRow:
    ts: datetime
    symbol: str
    provider: str
    trade_year: int
    month_num: int
    month_code: str
    trading_day_of_month: int
    trading_day_of_year: int
    close_price: float
    adj_close_price: float
    previous_adj_close_price: float
    return_pct: float
    direction: str
    source_ingested_at: datetime | None
    calculated_at: datetime


@dataclass(frozen=True)
class MonthOutcomeRow:
    symbol: str
    provider: str
    trade_year: int
    month_num: int
    month_code: str
    month_return_pct: float
    direction: str


@dataclass(frozen=True)
class SeasonalityBuildResult:
    symbol: str
    provider: str
    lookback_years: str
    source_bars: int
    daily_return_rows: int
    month_seasonality_rows: int
    trading_day_seasonality_rows: int
    month_outcome_rows: int
    as_of_ts: datetime | None


def ensure_seasonality_tables() -> None:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(EQUITY_DAILY_RETURNS_TABLE_SQL)
            cursor.execute(EQUITY_MONTH_SEASONALITY_TABLE_SQL)
            cursor.execute(EQUITY_MONTH_TRADING_DAY_SEASONALITY_TABLE_SQL)
            cursor.execute(EQUITY_MONTH_OUTCOME_SEASONALITY_TABLE_SQL)


def fetch_symbols_with_daily_bars(provider: str = "yfinance") -> list[str]:
    ensure_seasonality_tables()
    normalized_provider = _normalize_provider(provider)
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT symbol
                FROM equity_ohlcv_daily
                WHERE provider = {sql_literal(normalized_provider)}
                GROUP BY symbol
                ORDER BY symbol
                """
            )
            rows = cursor.fetchall()

    return [str(row[0]) for row in rows]


def rebuild_symbol_seasonality(
    symbol: str,
    provider: str = "yfinance",
    lookback_years: str = LOOKBACK_ALL,
) -> SeasonalityBuildResult:
    if lookback_years != LOOKBACK_ALL:
        raise ValueError("Only ALL lookback is supported for the MVP")

    ensure_seasonality_tables()
    normalized_symbol = _normalize_symbol(symbol)
    normalized_provider = _normalize_provider(provider)
    source_bars = fetch_source_daily_bars(normalized_symbol, normalized_provider)
    calculated_at = datetime.now(timezone.utc)
    daily_return_rows = calculate_daily_returns(source_bars, calculated_at=calculated_at)
    month_outcomes = calculate_month_outcomes(source_bars)
    as_of_ts = source_bars[-1].ts if source_bars else None

    insert_daily_return_rows(daily_return_rows)

    month_rows = build_month_seasonality_rows(
        daily_return_rows,
        as_of_ts=as_of_ts,
        lookback_years=lookback_years,
        calculated_at=calculated_at,
    )
    trading_day_rows = build_trading_day_seasonality_rows(
        daily_return_rows,
        as_of_ts=as_of_ts,
        lookback_years=lookback_years,
        calculated_at=calculated_at,
    )
    outcome_rows = build_month_outcome_seasonality_rows(
        month_outcomes,
        as_of_ts=as_of_ts,
        lookback_years=lookback_years,
        calculated_at=calculated_at,
    )

    insert_month_seasonality_rows(month_rows)
    insert_trading_day_seasonality_rows(trading_day_rows)
    insert_month_outcome_rows(outcome_rows)

    return SeasonalityBuildResult(
        symbol=normalized_symbol,
        provider=normalized_provider,
        lookback_years=lookback_years,
        source_bars=len(source_bars),
        daily_return_rows=len(daily_return_rows),
        month_seasonality_rows=len(month_rows),
        trading_day_seasonality_rows=len(trading_day_rows),
        month_outcome_rows=len(outcome_rows),
        as_of_ts=as_of_ts,
    )


def fetch_source_daily_bars(symbol: str, provider: str) -> list[SourceDailyBar]:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT ts, symbol, provider, close, adj_close, ingested_at
                FROM equity_ohlcv_daily
                WHERE symbol = {sql_literal(_normalize_symbol(symbol))}
                  AND provider = {sql_literal(_normalize_provider(provider))}
                ORDER BY ts ASC
                """
            )
            rows = cursor.fetchall()

    return [
        SourceDailyBar(
            ts=_to_datetime(row[0]),
            symbol=str(row[1]),
            provider=str(row[2]),
            close=float(row[3]),
            adj_close=float(row[4]) if row[4] is not None else None,
            ingested_at=_to_datetime(row[5]) if row[5] is not None else None,
        )
        for row in rows
    ]


def calculate_daily_returns(source_bars: list[SourceDailyBar], calculated_at: datetime | None = None) -> list[DailyReturnRow]:
    if len(source_bars) < 2:
        return []

    calculated_at = calculated_at or datetime.now(timezone.utc)
    rows: list[DailyReturnRow] = []
    trading_days_by_month: dict[tuple[int, int], int] = {}
    trading_days_by_year: dict[int, int] = {}
    previous_bar: SourceDailyBar | None = None

    for bar in source_bars:
        trade_date = bar.trade_date
        month_key = (trade_date.year, trade_date.month)
        trading_days_by_month[month_key] = trading_days_by_month.get(month_key, 0) + 1
        trading_days_by_year[trade_date.year] = trading_days_by_year.get(trade_date.year, 0) + 1

        if previous_bar is None:
            previous_bar = bar
            continue

        previous_price = previous_bar.return_price
        current_price = bar.return_price
        if previous_price <= 0 or current_price <= 0:
            previous_bar = bar
            continue

        return_pct = ((current_price / previous_price) - 1) * 100
        rows.append(
            DailyReturnRow(
                ts=bar.ts,
                symbol=bar.symbol,
                provider=bar.provider,
                trade_year=trade_date.year,
                month_num=trade_date.month,
                month_code=month_code(trade_date.month),
                trading_day_of_month=trading_days_by_month[month_key],
                trading_day_of_year=trading_days_by_year[trade_date.year],
                close_price=bar.close,
                adj_close_price=current_price,
                previous_adj_close_price=previous_price,
                return_pct=return_pct,
                direction=direction_for_return(return_pct),
                source_ingested_at=bar.ingested_at,
                calculated_at=calculated_at,
            )
        )
        previous_bar = bar

    return rows


def calculate_month_outcomes(source_bars: list[SourceDailyBar]) -> list[MonthOutcomeRow]:
    if len(source_bars) < 3:
        return []

    outcomes: list[MonthOutcomeRow] = []
    month_starts: list[int] = []
    previous_key: tuple[int, int] | None = None

    for index, bar in enumerate(source_bars):
        key = (bar.trade_date.year, bar.trade_date.month)
        if key != previous_key:
            month_starts.append(index)
            previous_key = key

    # Skip the first source month because it has no prior close, and skip the
    # final source month because it may be incomplete.
    for month_start_position in range(1, len(month_starts) - 1):
        first_index = month_starts[month_start_position]
        next_month_index = month_starts[month_start_position + 1]
        previous_bar = source_bars[first_index - 1]
        last_bar = source_bars[next_month_index - 1]

        previous_price = previous_bar.return_price
        last_price = last_bar.return_price
        if previous_price <= 0 or last_price <= 0:
            continue

        trade_date = last_bar.trade_date
        month_return_pct = ((last_price / previous_price) - 1) * 100
        outcomes.append(
            MonthOutcomeRow(
                symbol=last_bar.symbol,
                provider=last_bar.provider,
                trade_year=trade_date.year,
                month_num=trade_date.month,
                month_code=month_code(trade_date.month),
                month_return_pct=month_return_pct,
                direction=direction_for_month_return(month_return_pct),
            )
        )

    return outcomes


def build_month_seasonality_rows(
    daily_returns: list[DailyReturnRow],
    *,
    as_of_ts: datetime | None,
    lookback_years: str,
    calculated_at: datetime,
) -> list[tuple[object, ...]]:
    if as_of_ts is None:
        return []

    rows: list[tuple[object, ...]] = []
    for month_num in range(1, 13):
        month_returns = [row for row in daily_returns if row.month_num == month_num]
        if not month_returns:
            continue

        values = [row.return_pct for row in month_returns]
        up_values = [row.return_pct for row in month_returns if row.direction == "UP"]
        down_values = [row.return_pct for row in month_returns if row.direction == "DOWN"]
        up_days = len(up_values)
        down_days = len(down_values)
        flat_days = sum(1 for row in month_returns if row.direction == "FLAT")
        years = sorted({row.trade_year for row in month_returns})

        rows.append(
            (
                as_of_ts,
                month_returns[0].symbol,
                month_returns[0].provider,
                month_num,
                month_code(month_num),
                lookback_years,
                years[0],
                years[-1],
                len(years),
                len(month_returns),
                up_days,
                down_days,
                flat_days,
                percent(up_days, len(month_returns)),
                percent(down_days, len(month_returns)),
                percent(flat_days, len(month_returns)),
                avg(values),
                median(values),
                avg(up_values),
                avg(down_values),
                max(values),
                min(values),
                stddev(values),
                calculated_at,
            )
        )

    return rows


def build_trading_day_seasonality_rows(
    daily_returns: list[DailyReturnRow],
    *,
    as_of_ts: datetime | None,
    lookback_years: str,
    calculated_at: datetime,
) -> list[tuple[object, ...]]:
    if as_of_ts is None:
        return []

    grouped: dict[tuple[int, int], list[DailyReturnRow]] = {}
    for row in daily_returns:
        grouped.setdefault((row.month_num, row.trading_day_of_month), []).append(row)

    result_rows: list[tuple[object, ...]] = []
    for (month_num, trading_day_of_month), rows in sorted(grouped.items()):
        values = [row.return_pct for row in rows]
        up_values = [row.return_pct for row in rows if row.direction == "UP"]
        down_values = [row.return_pct for row in rows if row.direction == "DOWN"]
        up_days = len(up_values)
        down_days = len(down_values)
        flat_days = sum(1 for row in rows if row.direction == "FLAT")
        years = sorted({row.trade_year for row in rows})

        result_rows.append(
            (
                as_of_ts,
                rows[0].symbol,
                rows[0].provider,
                month_num,
                month_code(month_num),
                trading_day_of_month,
                lookback_years,
                years[0],
                years[-1],
                len(rows),
                up_days,
                down_days,
                flat_days,
                percent(up_days, len(rows)),
                percent(down_days, len(rows)),
                percent(flat_days, len(rows)),
                avg(values),
                median(values),
                avg(up_values),
                avg(down_values),
                max(values),
                min(values),
                stddev(values),
                calculated_at,
            )
        )

    return result_rows


def build_month_outcome_seasonality_rows(
    month_outcomes: list[MonthOutcomeRow],
    *,
    as_of_ts: datetime | None,
    lookback_years: str,
    calculated_at: datetime,
) -> list[tuple[object, ...]]:
    if as_of_ts is None:
        return []

    rows: list[tuple[object, ...]] = []
    for month_num in range(1, 13):
        outcomes = [row for row in month_outcomes if row.month_num == month_num]
        if not outcomes:
            continue

        values = [row.month_return_pct for row in outcomes]
        positive_values = [row.month_return_pct for row in outcomes if row.direction == "POSITIVE"]
        negative_values = [row.month_return_pct for row in outcomes if row.direction == "NEGATIVE"]
        positive_months = len(positive_values)
        negative_months = len(negative_values)
        flat_months = sum(1 for row in outcomes if row.direction == "FLAT")
        years = sorted({row.trade_year for row in outcomes})

        rows.append(
            (
                as_of_ts,
                outcomes[0].symbol,
                outcomes[0].provider,
                month_num,
                month_code(month_num),
                lookback_years,
                years[0],
                years[-1],
                len(outcomes),
                positive_months,
                negative_months,
                flat_months,
                percent(positive_months, len(outcomes)),
                percent(negative_months, len(outcomes)),
                percent(flat_months, len(outcomes)),
                avg(values),
                median(values),
                avg(positive_values),
                avg(negative_values),
                max(values),
                min(values),
                stddev(values),
                calculated_at,
            )
        )

    return rows


def insert_daily_return_rows(rows: list[DailyReturnRow]) -> int:
    if not rows:
        return 0

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO equity_daily_returns
                  (ts, symbol, provider, trade_year, month_num, month_code, trading_day_of_month,
                   trading_day_of_year, close_price, adj_close_price, previous_adj_close_price,
                   return_pct, direction, source_ingested_at, calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        row.ts,
                        row.symbol,
                        row.provider,
                        row.trade_year,
                        row.month_num,
                        row.month_code,
                        row.trading_day_of_month,
                        row.trading_day_of_year,
                        row.close_price,
                        row.adj_close_price,
                        row.previous_adj_close_price,
                        row.return_pct,
                        row.direction,
                        row.source_ingested_at,
                        row.calculated_at,
                    )
                    for row in rows
                ],
            )

    return len(rows)


def insert_month_seasonality_rows(rows: list[tuple[object, ...]]) -> int:
    if not rows:
        return 0

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO equity_month_seasonality
                  (as_of_ts, symbol, provider, month_num, month_code, lookback_years, start_year,
                   end_year, sample_years, sample_days, up_days, down_days, flat_days,
                   percent_up_days, percent_down_days, percent_flat_days, avg_return_pct,
                   median_return_pct, avg_up_day_return_pct, avg_down_day_return_pct,
                   best_daily_return_pct, worst_daily_return_pct, stddev_return_pct, calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )

    return len(rows)


def insert_trading_day_seasonality_rows(rows: list[tuple[object, ...]]) -> int:
    if not rows:
        return 0

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO equity_month_trading_day_seasonality
                  (as_of_ts, symbol, provider, month_num, month_code, trading_day_of_month,
                   lookback_years, start_year, end_year, sample_observations, up_days,
                   down_days, flat_days, percent_up_days, percent_down_days, percent_flat_days,
                   avg_return_pct, median_return_pct, avg_up_day_return_pct,
                   avg_down_day_return_pct, best_return_pct, worst_return_pct,
                   stddev_return_pct, calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )

    return len(rows)


def insert_month_outcome_rows(rows: list[tuple[object, ...]]) -> int:
    if not rows:
        return 0

    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO equity_month_outcome_seasonality
                  (as_of_ts, symbol, provider, month_num, month_code, lookback_years,
                   start_year, end_year, sample_months, positive_months, negative_months,
                   flat_months, percent_positive_months, percent_negative_months,
                   percent_flat_months, avg_month_return_pct, median_month_return_pct,
                   avg_positive_month_return_pct, avg_negative_month_return_pct,
                   best_month_return_pct, worst_month_return_pct, stddev_month_return_pct,
                   calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )

    return len(rows)


def fetch_seasonality_response(symbol: str, provider: str = "yfinance", lookback_years: str = LOOKBACK_ALL) -> SeasonalityResponse | None:
    ensure_seasonality_tables()
    normalized_symbol = _normalize_symbol(symbol)
    normalized_provider = _normalize_provider(provider)
    normalized_lookback = lookback_years.strip().upper()

    if normalized_lookback != LOOKBACK_ALL:
        raise ValueError("Only ALL lookback is supported for the MVP")

    as_of_ts = fetch_latest_seasonality_as_of(normalized_symbol, normalized_provider, normalized_lookback)
    if as_of_ts is None:
        return None

    month_rows = fetch_month_seasonality_rows(normalized_symbol, normalized_provider, normalized_lookback, as_of_ts)
    if not month_rows:
        return None

    trading_day_rows = fetch_trading_day_seasonality_rows(normalized_symbol, normalized_provider, normalized_lookback, as_of_ts)
    outcome_rows = fetch_month_outcome_seasonality_rows(normalized_symbol, normalized_provider, normalized_lookback, as_of_ts)

    trading_days_by_month: dict[int, list[TradingDaySeasonality]] = {}
    for row in trading_day_rows:
        trading_days_by_month.setdefault(int(row["month_num"]), []).append(
            TradingDaySeasonality(
                trading_day_of_month=int(row["trading_day_of_month"]),
                sample_observations=int(row["sample_observations"]),
                percent_up_days=float(row["percent_up_days"]),
                percent_down_days=float(row["percent_down_days"]),
                avg_return_pct=_optional_float(row["avg_return_pct"]),
            )
        )

    outcomes_by_month = {
        int(row["month_num"]): MonthlyOutcomeSeasonality(
            sample_months=int(row["sample_months"]),
            percent_positive_months=float(row["percent_positive_months"]),
            percent_negative_months=float(row["percent_negative_months"]),
            avg_month_return_pct=_optional_float(row["avg_month_return_pct"]),
            median_month_return_pct=_optional_float(row["median_month_return_pct"]),
            stddev_month_return_pct=_optional_float(row["stddev_month_return_pct"]),
        )
        for row in outcome_rows
    }

    months = [
        SeasonalityMonth(
            month_num=int(row["month_num"]),
            month_code=str(row["month_code"]),
            monthly_daily_seasonality=MonthlyDailySeasonality(
                sample_years=int(row["sample_years"]),
                sample_days=int(row["sample_days"]),
                percent_up_days=float(row["percent_up_days"]),
                percent_down_days=float(row["percent_down_days"]),
                avg_return_pct=_optional_float(row["avg_return_pct"]),
                median_return_pct=_optional_float(row["median_return_pct"]),
                stddev_return_pct=_optional_float(row["stddev_return_pct"]),
            ),
            trading_day_seasonality=trading_days_by_month.get(int(row["month_num"]), []),
            monthly_outcome_seasonality=outcomes_by_month.get(int(row["month_num"])),
        )
        for row in month_rows
    ]

    return SeasonalityResponse(
        symbol=normalized_symbol,
        provider=normalized_provider,
        lookback_years=normalized_lookback,
        as_of_ts=as_of_ts,
        months=months,
    )


def fetch_latest_seasonality_as_of(symbol: str, provider: str, lookback_years: str) -> datetime | None:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT max(as_of_ts)
                FROM equity_month_seasonality
                WHERE symbol = {sql_literal(symbol)}
                  AND provider = {sql_literal(provider)}
                  AND lookback_years = {sql_literal(lookback_years)}
                """
            )
            row = cursor.fetchone()

    if not row or row[0] is None:
        return None
    return _to_datetime(row[0])


def fetch_month_seasonality_rows(symbol: str, provider: str, lookback_years: str, as_of_ts: datetime) -> list[dict[str, object]]:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT month_num, month_code, sample_years, sample_days, percent_up_days,
                       percent_down_days, avg_return_pct, median_return_pct, stddev_return_pct
                FROM equity_month_seasonality
                WHERE symbol = {sql_literal(symbol)}
                  AND provider = {sql_literal(provider)}
                  AND lookback_years = {sql_literal(lookback_years)}
                  AND as_of_ts = {_timestamp_expr(as_of_ts)}
                ORDER BY month_num ASC
                """
            )
            rows = cursor.fetchall()

    keys = [
        "month_num",
        "month_code",
        "sample_years",
        "sample_days",
        "percent_up_days",
        "percent_down_days",
        "avg_return_pct",
        "median_return_pct",
        "stddev_return_pct",
    ]
    return [dict(zip(keys, row)) for row in rows]


def fetch_trading_day_seasonality_rows(symbol: str, provider: str, lookback_years: str, as_of_ts: datetime) -> list[dict[str, object]]:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT month_num, trading_day_of_month, sample_observations,
                       percent_up_days, percent_down_days, avg_return_pct
                FROM equity_month_trading_day_seasonality
                WHERE symbol = {sql_literal(symbol)}
                  AND provider = {sql_literal(provider)}
                  AND lookback_years = {sql_literal(lookback_years)}
                  AND as_of_ts = {_timestamp_expr(as_of_ts)}
                ORDER BY month_num ASC, trading_day_of_month ASC
                """
            )
            rows = cursor.fetchall()

    keys = [
        "month_num",
        "trading_day_of_month",
        "sample_observations",
        "percent_up_days",
        "percent_down_days",
        "avg_return_pct",
    ]
    return [dict(zip(keys, row)) for row in rows]


def fetch_month_outcome_seasonality_rows(symbol: str, provider: str, lookback_years: str, as_of_ts: datetime) -> list[dict[str, object]]:
    with questdb_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT month_num, sample_months, percent_positive_months,
                       percent_negative_months, avg_month_return_pct,
                       median_month_return_pct, stddev_month_return_pct
                FROM equity_month_outcome_seasonality
                WHERE symbol = {sql_literal(symbol)}
                  AND provider = {sql_literal(provider)}
                  AND lookback_years = {sql_literal(lookback_years)}
                  AND as_of_ts = {_timestamp_expr(as_of_ts)}
                ORDER BY month_num ASC
                """
            )
            rows = cursor.fetchall()

    keys = [
        "month_num",
        "sample_months",
        "percent_positive_months",
        "percent_negative_months",
        "avg_month_return_pct",
        "median_month_return_pct",
        "stddev_month_return_pct",
    ]
    return [dict(zip(keys, row)) for row in rows]


def direction_for_return(value: float) -> str:
    if value > 0:
        return "UP"
    if value < 0:
        return "DOWN"
    return "FLAT"


def direction_for_month_return(value: float) -> str:
    if value > 0:
        return "POSITIVE"
    if value < 0:
        return "NEGATIVE"
    return "FLAT"


def month_code(month_num: int) -> str:
    if month_num < 1 or month_num > 12:
        raise ValueError("month_num must be between 1 and 12")
    return MONTH_CODES[month_num - 1]


def percent(part: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return (part / total) * 100


def avg(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def stddev(values: list[float]) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return 0.0
    return pstdev(values)


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    return float(value)


def _timestamp_expr(value: datetime) -> str:
    return f"to_timestamp({sql_literal(value.date().isoformat())}, 'yyyy-MM-dd')"


def _to_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)


def _to_date(value: object) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return _to_datetime(value).date()


def _normalize_symbol(value: str) -> str:
    return value.strip().upper()


def _normalize_provider(value: str) -> str:
    return value.strip().lower()
