from datetime import date, timedelta
from math import cos, sin

from app.models import OhlcvBar, Timeframe

SEED_PRICES = {
    "AAPL": 186,
    "MSFT": 425,
    "NVDA": 890,
    "SPY": 510,
    "TSLA": 178,
}

TICKER_OFFSETS = {
    "AAPL": 0,
    "MSFT": 5,
    "NVDA": 11,
    "SPY": 17,
    "TSLA": 23,
}


def ticker_seed(ticker: str) -> int:
    return sum(ord(char) for char in ticker)


def trading_dates() -> list[date]:
    dates: list[date] = []
    cursor = date(2025, 1, 2)

    while len(dates) < 90:
        if cursor.weekday() < 5:
            dates.append(cursor)
        cursor += timedelta(days=1)

    return dates


def get_mock_ohlcv_bars(symbol: str, timeframe: Timeframe = "1d") -> list[OhlcvBar]:
    if timeframe != "1d":
        return []

    ticker = symbol.upper()
    seed = ticker_seed(ticker)
    base = SEED_PRICES.get(ticker, 90 + (seed % 180))
    offset = TICKER_OFFSETS.get(ticker, seed % 31)

    bars: list[OhlcvBar] = []
    for index, bar_date in enumerate(trading_dates()):
        wave = sin((index + offset) / 5) * 4.8
        drift = index * 0.18
        noise = cos((index + offset) / 3) * 1.7
        open_price = base + drift + wave + noise
        close_price = open_price + sin((index + offset) / 2.7) * 2.2
        high_price = max(open_price, close_price) + 1.4 + abs(cos(index / 4)) * 1.8
        low_price = min(open_price, close_price) - 1.3 - abs(sin(index / 6)) * 1.6
        volume_base = 900_000 + (seed % 9) * 120_000
        volume = round(volume_base + abs(sin((index + offset) / 4)) * volume_base * 0.75)

        bars.append(
            OhlcvBar(
                time=bar_date,
                open=round(open_price, 2),
                high=round(high_price, 2),
                low=round(low_price, 2),
                close=round(close_price, 2),
                volume=volume,
            )
        )

    return bars

