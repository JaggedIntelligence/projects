from __future__ import annotations

from unittest import TestCase

try:
    from app.jobs.update_daily_emas import (
        CLOSE_CHANGE_COLUMN,
        EMA_EXPRESSIONS,
        build_candidate_sql,
        build_count_sql,
        build_insert_sql,
        build_scope_sql,
    )
    from app.repositories.questdb_daily_bars import (
        EQUITY_OHLCV_DAILY_MIGRATION_SQL,
        EQUITY_OHLCV_DAILY_TABLE_SQL,
    )
except ImportError:
    CLOSE_CHANGE_COLUMN = None
    EMA_EXPRESSIONS = None
    EQUITY_OHLCV_DAILY_MIGRATION_SQL = None
    EQUITY_OHLCV_DAILY_TABLE_SQL = None
    build_candidate_sql = None
    build_count_sql = None
    build_scope_sql = None
    build_insert_sql = None


class DailyEmaTests(TestCase):
    def setUp(self) -> None:
        if (
            CLOSE_CHANGE_COLUMN is None
            or EMA_EXPRESSIONS is None
            or EQUITY_OHLCV_DAILY_MIGRATION_SQL is None
            or EQUITY_OHLCV_DAILY_TABLE_SQL is None
            or build_candidate_sql is None
            or build_count_sql is None
            or build_insert_sql is None
            or build_scope_sql is None
        ):
            self.skipTest("market-api runtime dependencies are required for EMA tests")

    def test_schema_and_migration_include_all_indicator_columns(self) -> None:
        expected_ema_columns = {"ema10", "ema20", "ema50", "ema200", "volema10", "volema20"}
        expected_columns = expected_ema_columns | {"close_change_pct"}

        self.assertEqual(set(EMA_EXPRESSIONS), expected_ema_columns)
        self.assertEqual(CLOSE_CHANGE_COLUMN, "close_change_pct")
        for column in expected_columns:
            self.assertIn(f"{column} DOUBLE", EQUITY_OHLCV_DAILY_TABLE_SQL)
            self.assertIn(f" {column} DOUBLE", EQUITY_OHLCV_DAILY_MIGRATION_SQL[column])

    def test_insert_uses_adjusted_close_and_volume_period_emas(self) -> None:
        sql = build_insert_sql("provider = 'yfinance'", only_missing=True)

        self.assertIn("avg(coalesce(adj_close, close), 'period', 200)", sql)
        self.assertIn("avg(volume, 'period', 10)", sql)
        self.assertIn("avg(volume, 'period', 20)", sql)
        self.assertIn("lag(close) OVER (PARTITION BY symbol, provider ORDER BY ts)", sql)
        self.assertIn("((close / previous_close) - 1) * 100.0", sql)
        self.assertIn("close_change_pct, ema10", sql)
        self.assertIn("PARTITION BY symbol, provider ORDER BY ts", sql)
        self.assertIn("INSERT INTO equity_ohlcv_daily", sql)
        self.assertIn("current_ema10 IS NULL", sql)
        self.assertGreater(sql.index("OVER (PARTITION BY symbol, provider ORDER BY ts)"), sql.index("WITH calculated"))
        self.assertGreater(sql.index("WHERE (current_ema10 IS NULL"), sql.index("FROM calculated"))

    def test_missing_change_requires_an_eligible_previous_close(self) -> None:
        candidate_sql = build_candidate_sql()
        count_sql = build_count_sql("provider = 'yfinance'", only_missing=True)

        self.assertIn("current_close_change_pct IS NULL", candidate_sql)
        self.assertIn("previous_close IS NOT NULL", candidate_sql)
        self.assertIn("previous_close <> 0", candidate_sql)
        self.assertIn("lag(close)", count_sql)
        self.assertNotIn("lag(adj_close)", count_sql)

    def test_scope_normalizes_provider_and_limits_symbols(self) -> None:
        scope = build_scope_sql(" YFINANCE ", ["AAPL", "MSFT"])

        self.assertEqual(scope, "provider = 'yfinance' AND symbol IN ('AAPL', 'MSFT')")
