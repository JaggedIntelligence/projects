from datetime import date
from unittest import TestCase

try:
    from app.models import DailyOhlcvBar
    from app.providers.yfinance_provider import _bars_from_frame, _frame_for_symbol
    import pandas as pd
except ImportError:
    DailyOhlcvBar = None
    _bars_from_frame = None
    _frame_for_symbol = None
    pd = None


class YFinanceProviderTests(TestCase):
    def setUp(self) -> None:
        if pd is None or DailyOhlcvBar is None or _bars_from_frame is None or _frame_for_symbol is None:
            self.skipTest("market-api runtime dependencies are required for provider tests")

    def test_extracts_single_symbol_from_yfinance_multi_index_frame(self) -> None:
        frame = pd.DataFrame(
            [[10.0, 11.0, 9.5, 10.5, 10.4, 1000]],
            index=pd.to_datetime(["2024-01-02"]),
            columns=pd.MultiIndex.from_tuples(
                [
                    ("Open", "BAC"),
                    ("High", "BAC"),
                    ("Low", "BAC"),
                    ("Close", "BAC"),
                    ("Adj Close", "BAC"),
                    ("Volume", "BAC"),
                ]
            ),
        )

        symbol_frame = _frame_for_symbol(frame, "BAC", requested_symbol_count=1)

        self.assertIsNotNone(symbol_frame)
        self.assertEqual(list(symbol_frame.columns), ["Open", "High", "Low", "Close", "Adj Close", "Volume"])
        bars = _bars_from_frame("BAC", "BAC", "USD", symbol_frame)
        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].time, date(2024, 1, 2))

    def test_clamps_tiny_ohlc_drift_from_provider_data(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "Open": 100.00005,
                    "High": 100.0,
                    "Low": 99.0,
                    "Close": 100.00004,
                    "Adj Close": 100.00004,
                    "Volume": 1000,
                }
            ],
            index=pd.to_datetime(["2024-01-02"]),
        )

        bars = _bars_from_frame("TEST", "TEST", "USD", frame)

        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].high, 100.00005)

    def test_skips_materially_invalid_ohlc_rows(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "Open": 105.0,
                    "High": 100.0,
                    "Low": 99.0,
                    "Close": 104.0,
                    "Adj Close": 104.0,
                    "Volume": 1000,
                }
            ],
            index=pd.to_datetime(["2024-01-02"]),
        )

        bars = _bars_from_frame("TEST", "TEST", "USD", frame)

        self.assertEqual(bars, [])

    def test_uses_zero_volume_for_yahoo_forex_nan_volume(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "Open": 1.08,
                    "High": 1.09,
                    "Low": 1.07,
                    "Close": 1.085,
                    "Adj Close": 1.085,
                    "Volume": float("nan"),
                }
            ],
            index=pd.to_datetime(["2024-01-02"]),
        )

        bars = _bars_from_frame("EURUSD", "EURUSD=X", "USD", frame)

        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].volume, 0)

    def test_uses_zero_volume_for_yahoo_forex_missing_volume(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "Open": 141.0,
                    "High": 142.0,
                    "Low": 140.5,
                    "Close": 141.5,
                    "Adj Close": 141.5,
                }
            ],
            index=pd.to_datetime(["2024-01-02"]),
        )

        bars = _bars_from_frame("USDJPY", "JPY=X", "JPY", frame)

        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].volume, 0)

    def test_skips_stock_rows_with_missing_volume(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "Open": 100.0,
                    "High": 101.0,
                    "Low": 99.0,
                    "Close": 100.5,
                    "Adj Close": 100.5,
                }
            ],
            index=pd.to_datetime(["2024-01-02"]),
        )

        bars = _bars_from_frame("TEST", "TEST", "USD", frame)

        self.assertEqual(bars, [])

    def test_daily_bar_model_allows_tiny_ohlc_drift(self) -> None:
        bar = DailyOhlcvBar(
            symbol="TEST",
            provider="yfinance",
            provider_symbol="TEST",
            time=date(2024, 1, 2),
            open=100.00005,
            high=100.0,
            low=99.0,
            close=100.00004,
            adj_close=100.00004,
            volume=1000,
            currency="USD",
        )

        self.assertEqual(bar.symbol, "TEST")
