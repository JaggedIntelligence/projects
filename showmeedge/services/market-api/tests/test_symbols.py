from unittest import TestCase

from app.providers.symbols import load_symbol_universe, to_provider_symbol


class SymbolUniverseTests(TestCase):
    def test_loads_full_sp500_symbols(self) -> None:
        symbols = load_symbol_universe("sp500_current")
        symbol_map = {entry.symbol: entry for entry in symbols}

        self.assertGreaterEqual(len(symbols), 500)
        self.assertIn("AAPL", symbol_map)
        self.assertEqual(symbol_map["AAPL"].provider_symbol, "AAPL")
        self.assertEqual(symbol_map["AAPL"].currency, "USD")
        self.assertEqual(symbol_map["BRK.B"].provider_symbol, "BRK-B")
        self.assertEqual(symbol_map["BF.B"].provider_symbol, "BF-B")

    def test_maps_dot_class_symbols_for_yfinance(self) -> None:
        self.assertEqual(to_provider_symbol("BRK.B"), "BRK-B")
        self.assertEqual(to_provider_symbol("bf.b"), "BF-B")
