from unittest import TestCase

try:
    from app.sql_params import prepare_sql_query
except ImportError:
    prepare_sql_query = None


class SqlQueryParamTests(TestCase):
    def setUp(self) -> None:
        if prepare_sql_query is None:
            self.skipTest("market-api runtime dependencies are required for SQL parameter tests")

    def test_prepare_sql_query_renders_numbered_parameters_in_occurrence_order(self) -> None:
        prepared_sql = prepare_sql_query(
            "SELECT * FROM equity_ohlcv_daily WHERE symbol = $1 AND provider = $2 OR alt_symbol = $1",
            ["AAPL", "yfinance"],
        )

        self.assertEqual(
            prepared_sql,
            "SELECT * FROM equity_ohlcv_daily WHERE symbol = 'AAPL' AND provider = 'yfinance' OR alt_symbol = 'AAPL'",
        )

    def test_prepare_sql_query_renders_numeric_literals_without_quotes(self) -> None:
        prepared_sql = prepare_sql_query("SELECT * FROM equity_ohlcv_daily WHERE close > $1", [" 100.25 "])

        self.assertEqual(prepared_sql, "SELECT * FROM equity_ohlcv_daily WHERE close > 100.25")

    def test_prepare_sql_query_escapes_string_literals(self) -> None:
        prepared_sql = prepare_sql_query("SELECT * FROM companies WHERE name = $1", ["Bob's Widgets"])

        self.assertEqual(prepared_sql, "SELECT * FROM companies WHERE name = 'Bob''s Widgets'")

    def test_prepare_sql_query_requires_referenced_parameter_value(self) -> None:
        with self.assertRaisesRegex(ValueError, r"Parameter \$3 is required"):
            prepare_sql_query("SELECT * FROM equity_ohlcv_daily WHERE symbol = $3", ["AAPL"])

    def test_prepare_sql_query_rejects_unused_parameter_value(self) -> None:
        with self.assertRaisesRegex(ValueError, r"Parameter \$2 was provided but is not referenced"):
            prepare_sql_query("SELECT * FROM equity_ohlcv_daily WHERE symbol = $1", ["AAPL", "yfinance"])

    def test_prepare_sql_query_ignores_placeholders_in_literals_and_comments(self) -> None:
        prepared_sql = prepare_sql_query(
            "SELECT '$1' AS literal, symbol FROM equity_ohlcv_daily -- $2\nWHERE symbol = $1",
            ["AAPL"],
        )

        self.assertEqual(
            prepared_sql,
            "SELECT '$1' AS literal, symbol FROM equity_ohlcv_daily -- $2\nWHERE symbol = 'AAPL'",
        )
