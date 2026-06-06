from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Timeframe = Literal["1d"]
OHLC_RANGE_TOLERANCE = 1e-6


class OhlcvBar(BaseModel):
    time: date
    open: float
    high: float
    low: float
    close: float
    volume: int


class DailyOhlcvBar(BaseModel):
    symbol: str = Field(min_length=1, max_length=24)
    provider: str = Field(default="yfinance", min_length=1, max_length=64)
    provider_symbol: str | None = Field(default=None, max_length=64)
    time: date
    open: float = Field(gt=0)
    high: float = Field(gt=0)
    low: float = Field(gt=0)
    close: float = Field(gt=0)
    adj_close: float | None = Field(default=None, gt=0)
    volume: int = Field(ge=0)
    currency: str = Field(default="USD", min_length=1, max_length=8)

    @model_validator(mode="after")
    def validate_ohlc_range(self) -> DailyOhlcvBar:
        tolerance = max(abs(self.high), abs(self.low), abs(self.open), abs(self.close), 1.0) * OHLC_RANGE_TOLERANCE
        if self.high + tolerance < max(self.open, self.low, self.close):
            raise ValueError("high must be greater than or equal to open, low, and close")
        if self.low - tolerance > min(self.open, self.high, self.close):
            raise ValueError("low must be less than or equal to open, high, and close")
        return self


class MarketDataCoverage(BaseModel):
    symbol: str
    provider: str
    timeframe: Timeframe = "1d"
    start: date | None
    end: date | None
    row_count: int = Field(ge=0)


class BarsResponse(BaseModel):
    symbol: str
    timeframe: Timeframe
    source: str
    provider: str | None = None
    bars: list[OhlcvBar]


class MockIngestRequest(BaseModel):
    symbols: list[str] = Field(default_factory=lambda: ["AAPL", "MSFT", "SPY"])
    timeframe: Timeframe = "1d"
    provider: str = "mock_static"


class MockIngestResponse(BaseModel):
    provider: str
    timeframe: Timeframe
    symbols: list[str]
    inserted_bars: int


class BacktestRequest(BaseModel):
    symbol: str = "AAPL"
    timeframe: Timeframe = "1d"
    initial_cash: float = Field(default=100, gt=0)
    fast_sma: int = Field(default=10, ge=2)
    slow_sma: int = Field(default=50, ge=3)
    seed_if_empty: bool = True


class BacktestTrade(BaseModel):
    side: Literal["buy", "sell"]
    time: date
    price: float
    quantity: float
    value: float


class EquityPoint(BaseModel):
    time: date
    equity: float


class BacktestResponse(BaseModel):
    symbol: str
    timeframe: Timeframe
    strategy: str
    engine: str = "manual"
    source: str
    initial_cash: float
    final_equity: float
    total_return: float
    max_drawdown: float
    trade_count: int
    win_rate: float | None
    started_at: datetime
    completed_at: datetime
    trades: list[BacktestTrade]
    equity_curve: list[EquityPoint]
