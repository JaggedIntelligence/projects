from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Timeframe = Literal["1d"]


class OhlcvBar(BaseModel):
    time: date
    open: float
    high: float
    low: float
    close: float
    volume: int


class BarsResponse(BaseModel):
    symbol: str
    timeframe: Timeframe
    source: str
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
    initial_cash: float = Field(default=100_000, gt=0)
    fast_sma: int = Field(default=10, ge=2)
    slow_sma: int = Field(default=30, ge=3)
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

