from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

try:
    from app.main import run_backtest
    from app.mock_data import get_mock_ohlcv_bars
    from app.models import BacktestRequest, BacktestResponse, BarsResponse
except ImportError:
    BacktestRequest = None
    BacktestResponse = None
    BarsResponse = None
    get_mock_ohlcv_bars = None
    run_backtest = None


class BacktestApiTests(TestCase):
    def setUp(self) -> None:
        if (
            BacktestRequest is None
            or BacktestResponse is None
            or BarsResponse is None
            or get_mock_ohlcv_bars is None
            or run_backtest is None
        ):
            self.skipTest("market-api runtime dependencies are required for backtest API tests")

    def test_run_backtest_passes_concrete_provider_to_internal_bars_call(self) -> None:
        captured: dict[str, object] = {}

        def fake_get_market_bars(**kwargs: object) -> BarsResponse:
            captured.update(kwargs)
            return BarsResponse(
                symbol="AAPL",
                timeframe="1d",
                source="test",
                provider="yfinance",
                bars=get_mock_ohlcv_bars("AAPL"),
            )

        def fake_run_sma_crossover_backtest(**_: object) -> BacktestResponse:
            now = datetime.now(timezone.utc)
            return BacktestResponse(
                symbol="AAPL",
                timeframe="1d",
                strategy="SMA crossover 10/50",
                engine="test",
                source="test",
                initial_cash=100,
                final_equity=100,
                total_return=0,
                max_drawdown=0,
                trade_count=0,
                win_rate=None,
                started_at=now,
                completed_at=now,
                trades=[],
                equity_curve=[],
            )

        with patch("app.main.get_market_bars", side_effect=fake_get_market_bars):
            with patch("app.main.run_sma_crossover_backtest", side_effect=fake_run_sma_crossover_backtest):
                run_backtest(BacktestRequest(symbol="AAPL", initial_cash=100, fast_sma=10, slow_sma=50))

        self.assertEqual(captured["provider"], "yfinance")
