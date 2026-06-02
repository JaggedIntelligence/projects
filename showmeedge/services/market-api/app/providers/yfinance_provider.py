from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import date, timedelta
from typing import Any

from app.models import DailyOhlcvBar
from app.providers.symbols import SymbolMetadata, normalize_symbol, to_provider_symbol


class YFinanceProvider:
    provider_name = "yfinance"

    def __init__(self, symbols: Sequence[SymbolMetadata] | None = None) -> None:
        self.symbols = {entry.symbol: entry for entry in symbols or []}

    def fetch_daily_bars(
        self,
        symbols: list[str],
        start: date,
        end: date | None = None,
    ) -> list[DailyOhlcvBar]:
        normalized_symbols = _dedupe_symbols(symbols)
        if not normalized_symbols:
            return []

        provider_symbols_by_symbol = {
            symbol: self.symbols.get(symbol, _fallback_metadata(symbol)).provider_symbol
            for symbol in normalized_symbols
        }
        provider_symbols = list(dict.fromkeys(provider_symbols_by_symbol.values()))

        yf = _import_yfinance()
        data = yf.download(
            tickers=provider_symbols[0] if len(provider_symbols) == 1 else provider_symbols,
            start=start.isoformat(),
            end=_exclusive_end(end),
            interval="1d",
            group_by="ticker",
            auto_adjust=False,
            actions=False,
            progress=False,
            threads=True,
        )

        bars: list[DailyOhlcvBar] = []
        for symbol, provider_symbol in provider_symbols_by_symbol.items():
            frame = _frame_for_symbol(data, provider_symbol, len(provider_symbols))
            if frame is None or getattr(frame, "empty", False):
                continue

            metadata = self.symbols.get(symbol, _fallback_metadata(symbol))
            bars.extend(_bars_from_frame(symbol, metadata.provider_symbol, metadata.currency, frame))

        return bars


def _import_yfinance() -> Any:
    try:
        import yfinance as yf
    except ImportError as exc:
        raise RuntimeError("yfinance is required to fetch Yahoo Finance market data") from exc
    return yf


def _exclusive_end(end: date | None) -> str | None:
    if end is None:
        return None
    return (end + timedelta(days=1)).isoformat()


def _dedupe_symbols(symbols: list[str]) -> list[str]:
    return list(dict.fromkeys(normalize_symbol(symbol) for symbol in symbols if symbol.strip()))


def _fallback_metadata(symbol: str) -> SymbolMetadata:
    return SymbolMetadata(
        symbol=normalize_symbol(symbol),
        provider_symbol=to_provider_symbol(symbol, provider="yfinance"),
        name=normalize_symbol(symbol),
        currency="USD",
    )


def _frame_for_symbol(data: Any, provider_symbol: str, requested_symbol_count: int) -> Any | None:
    if data is None or getattr(data, "empty", False):
        return None

    columns = getattr(data, "columns", None)
    if columns is None:
        return None

    if requested_symbol_count == 1:
        return data

    if getattr(columns, "nlevels", 1) <= 1:
        return data

    level_zero_values = {str(value) for value in columns.get_level_values(0)}
    if provider_symbol in level_zero_values:
        return data[provider_symbol]

    level_one_values = {str(value) for value in columns.get_level_values(1)}
    if provider_symbol in level_one_values:
        return data.xs(provider_symbol, axis=1, level=1)

    return None


def _bars_from_frame(symbol: str, provider_symbol: str, currency: str, frame: Any) -> list[DailyOhlcvBar]:
    bars: list[DailyOhlcvBar] = []

    for timestamp, row in frame.iterrows():
        open_price = _row_float(row, "Open")
        high_price = _row_float(row, "High")
        low_price = _row_float(row, "Low")
        close_price = _row_float(row, "Close")
        volume = _row_int(row, "Volume")

        if None in (open_price, high_price, low_price, close_price, volume):
            continue

        adj_close = _row_float(row, "Adj Close")
        bars.append(
            DailyOhlcvBar(
                symbol=symbol,
                provider="yfinance",
                provider_symbol=provider_symbol,
                time=timestamp.date(),
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                adj_close=adj_close,
                volume=volume,
                currency=currency,
            )
        )

    return bars


def _row_float(row: Any, key: str) -> float | None:
    value = _row_value(row, key)
    if _is_missing(value):
        return None
    return float(value)


def _row_int(row: Any, key: str) -> int | None:
    value = _row_value(row, key)
    if _is_missing(value):
        return None
    return int(value)


def _row_value(row: Any, key: str) -> Any:
    try:
        return row[key]
    except (KeyError, TypeError):
        return None


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        return math.isnan(float(value))
    except (TypeError, ValueError):
        return False
