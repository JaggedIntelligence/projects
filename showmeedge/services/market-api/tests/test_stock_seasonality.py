from __future__ import annotations

from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

try:
    from fastapi import HTTPException

    from app.main import get_stock_seasonality
    from app.models import MonthlyDailySeasonality, SeasonalityMonth, SeasonalityResponse
    from app.repositories.questdb_seasonality import (
        SourceDailyBar,
        calculate_daily_returns,
        calculate_month_outcomes,
    )
except ImportError:
    HTTPException = None
    MonthlyDailySeasonality = None
    SeasonalityMonth = None
    SeasonalityResponse = None
    SourceDailyBar = None
    calculate_daily_returns = None
    calculate_month_outcomes = None
    get_stock_seasonality = None


class StockSeasonalityTests(TestCase):
    def setUp(self) -> None:
        if (
            HTTPException is None
            or MonthlyDailySeasonality is None
            or SeasonalityMonth is None
            or SeasonalityResponse is None
            or SourceDailyBar is None
            or calculate_daily_returns is None
            or calculate_month_outcomes is None
            or get_stock_seasonality is None
        ):
            self.skipTest("market-api runtime dependencies are required for seasonality tests")

    def test_daily_returns_use_adjusted_close_and_trading_day_ordinals(self) -> None:
        calculated_at = ts("2025-01-10")
        rows = calculate_daily_returns(
            [
                bar("2025-01-02", close=100, adj_close=50),
                bar("2025-01-03", close=110, adj_close=55),
                bar("2025-01-06", close=104, adj_close=52),
            ],
            calculated_at=calculated_at,
        )

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].trading_day_of_month, 2)
        self.assertEqual(rows[0].trading_day_of_year, 2)
        self.assertEqual(rows[0].month_code, "JAN")
        self.assertAlmostEqual(rows[0].return_pct, 10.0)
        self.assertEqual(rows[0].direction, "UP")
        self.assertEqual(rows[1].trading_day_of_month, 3)
        self.assertEqual(rows[1].direction, "DOWN")
        self.assertEqual(rows[1].calculated_at, calculated_at)

    def test_month_outcomes_skip_first_and_final_source_months(self) -> None:
        outcomes = calculate_month_outcomes(
            [
                bar("2024-12-31", close=100),
                bar("2025-01-02", close=102),
                bar("2025-01-31", close=110),
                bar("2025-02-03", close=108),
                bar("2025-02-28", close=120),
                bar("2025-03-03", close=121),
            ]
        )

        self.assertEqual(len(outcomes), 2)
        self.assertEqual(outcomes[0].month_code, "JAN")
        self.assertAlmostEqual(outcomes[0].month_return_pct, 10.0)
        self.assertEqual(outcomes[0].direction, "POSITIVE")
        self.assertEqual(outcomes[1].month_code, "FEB")
        self.assertAlmostEqual(outcomes[1].month_return_pct, 9.0909090909)

    def test_endpoint_returns_404_when_cache_is_missing(self) -> None:
        with patch("app.main.fetch_seasonality_response", return_value=None):
            with self.assertRaises(HTTPException) as raised:
                get_stock_seasonality("AMD")

        self.assertEqual(raised.exception.status_code, 404)

    def test_endpoint_normalizes_inputs_before_fetching_cache(self) -> None:
        captured: dict[str, str] = {}
        response = SeasonalityResponse(
            symbol="AMD",
            provider="yfinance",
            lookback_years="ALL",
            as_of_ts=ts("2026-06-10"),
            months=[
                SeasonalityMonth(
                    month_num=1,
                    month_code="JAN",
                    monthly_daily_seasonality=MonthlyDailySeasonality(
                        sample_years=1,
                        sample_days=2,
                        percent_up_days=50,
                        percent_down_days=50,
                    ),
                    trading_day_seasonality=[],
                    monthly_outcome_seasonality=None,
                )
            ],
        )

        def fake_fetch(symbol: str, provider: str, lookback_years: str) -> SeasonalityResponse:
            captured["symbol"] = symbol
            captured["provider"] = provider
            captured["lookback_years"] = lookback_years
            return response

        with patch("app.main.fetch_seasonality_response", side_effect=fake_fetch):
            returned = get_stock_seasonality("amd", provider="YFINANCE", lookback_years="all")

        self.assertEqual(returned.symbol, "AMD")
        self.assertEqual(captured, {"symbol": "AMD", "provider": "yfinance", "lookback_years": "ALL"})


def ts(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


def bar(value: str, close: float, adj_close: float | None = None) -> SourceDailyBar:
    return SourceDailyBar(
        ts=ts(value),
        symbol="AMD",
        provider="yfinance",
        close=close,
        adj_close=adj_close,
        ingested_at=ts(value),
    )
