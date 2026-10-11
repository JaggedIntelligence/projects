import logging
from datetime import datetime, timezone
from typing import Any

from app.models import BacktestResponse, BacktestTrade, EquityPoint, OhlcvBar


class VectorBTUnavailable(ImportError):
    pass


def sma(values: list[float], window: int, index: int) -> float | None:
    if index + 1 < window:
        return None

    window_values = values[index + 1 - window : index + 1]
    return sum(window_values) / window


def max_drawdown(equity_curve: list[EquityPoint]) -> float:
    if not equity_curve:
        return 0

    peak = equity_curve[0].equity
    worst = 0.0
    for point in equity_curve:
        peak = max(peak, point.equity)
        if peak > 0:
            worst = min(worst, (point.equity - peak) / peak)

    return worst


def trade_win_rate(trades: list[BacktestTrade]) -> float | None:
    round_trips = []
    open_trade: BacktestTrade | None = None

    for trade in trades:
        if trade.side == "buy":
            open_trade = trade
        elif trade.side == "sell" and open_trade:
            round_trips.append(trade.price > open_trade.price)
            open_trade = None

    if not round_trips:
        return None

    return sum(1 for won in round_trips if won) / len(round_trips)


def scalar_float(value: Any) -> float:
    if hasattr(value, "iloc"):
        value = value.iloc[0]
    if hasattr(value, "item"):
        value = value.item()

    return float(value)


def build_trades_from_signals(
    bars: list[OhlcvBar],
    initial_cash: float,
    entries: list[bool],
    exits: list[bool],
) -> list[BacktestTrade]:
    cash = initial_cash
    shares = 0.0
    trades: list[BacktestTrade] = []

    for bar, should_enter, should_exit in zip(bars, entries, exits):
        if should_enter and shares == 0 and cash > 0:
            shares = cash / bar.close
            trade_value = shares * bar.close
            trades.append(
                BacktestTrade(
                    side="buy",
                    time=bar.time,
                    price=bar.close,
                    quantity=round(shares, 8),
                    value=round(trade_value, 2),
                )
            )
            cash = 0

        if should_exit and shares > 0:
            trade_value = shares * bar.close
            cash = trade_value
            trades.append(
                BacktestTrade(
                    side="sell",
                    time=bar.time,
                    price=bar.close,
                    quantity=round(shares, 8),
                    value=round(trade_value, 2),
                )
            )
            shares = 0

    return trades


def run_vectorbt_sma_crossover_backtest(
    symbol: str,
    bars: list[OhlcvBar],
    initial_cash: float,
    fast_sma: int,
    slow_sma: int,
    source: str,
    started_at: datetime,
) -> BacktestResponse:
    try:
        import pandas as pd
        import vectorbt as vbt
    except ImportError as exc:
        raise VectorBTUnavailable("vectorbt and pandas are required for the vectorbt backtest engine") from exc

    logging.info(
        "Using vectorbt backtest engine for symbol=%s fast_sma=%s slow_sma=%s bars=%s",
        symbol.upper(),
        fast_sma,
        slow_sma,
        len(bars),
    )

    index = pd.to_datetime([bar.time for bar in bars])
    price = pd.Series([bar.close for bar in bars], index=index, name=symbol.upper())

    fast_ma = vbt.MA.run(price, fast_sma)
    slow_ma = vbt.MA.run(price, slow_sma)
    entries = fast_ma.ma_crossed_above(slow_ma)
    exits = fast_ma.ma_crossed_below(slow_ma)

    portfolio = vbt.Portfolio.from_signals(price, entries, exits, init_cash=initial_cash, freq="1D")
    equity = portfolio.value()
    if getattr(equity, "ndim", 1) > 1:
        equity = equity.iloc[:, 0]
    if getattr(entries, "ndim", 1) > 1:
        entries = entries.iloc[:, 0]
    if getattr(exits, "ndim", 1) > 1:
        exits = exits.iloc[:, 0]

    equity_curve = [
        EquityPoint(time=timestamp.date(), equity=round(float(value), 2))
        for timestamp, value in equity.items()
        if not pd.isna(value)
    ]
    trades = build_trades_from_signals(
        bars=bars,
        initial_cash=initial_cash,
        entries=[bool(value) for value in entries.to_numpy()],
        exits=[bool(value) for value in exits.to_numpy()],
    )

    final_equity = equity_curve[-1].equity if equity_curve else initial_cash
    max_drawdown_value = scalar_float(portfolio.max_drawdown())
    completed_at = datetime.now(timezone.utc)

    return BacktestResponse(
        symbol=symbol.upper(),
        timeframe="1d",
        strategy=f"SMA crossover {fast_sma}/{slow_sma}",
        engine="vectorbt",
        source=source,
        initial_cash=round(initial_cash, 2),
        final_equity=round(final_equity, 2),
        total_return=round(scalar_float(portfolio.total_return()), 6),
        max_drawdown=round(-abs(max_drawdown_value), 6),
        trade_count=len(trades),
        win_rate=trade_win_rate(trades),
        started_at=started_at,
        completed_at=completed_at,
        trades=trades,
        equity_curve=equity_curve,
    )


def run_sma_crossover_backtest(
    symbol: str,
    bars: list[OhlcvBar],
    initial_cash: float,
    fast_sma: int,
    slow_sma: int,
    source: str,
) -> BacktestResponse:
    if fast_sma >= slow_sma:
        raise ValueError("fast_sma must be lower than slow_sma")

    started_at = datetime.now(timezone.utc)

    try:
        return run_vectorbt_sma_crossover_backtest(
            symbol=symbol,
            bars=bars,
            initial_cash=initial_cash,
            fast_sma=fast_sma,
            slow_sma=slow_sma,
            source=source,
            started_at=started_at,
        )
    except VectorBTUnavailable as exc:
        logging.info(
            "VectorBT unavailable; using manual SMA crossover backtest engine for symbol=%s fast_sma=%s slow_sma=%s bars=%s reason=%s",
            symbol.upper(),
            fast_sma,
            slow_sma,
            len(bars),
            exc,
        )

    closes = [bar.close for bar in bars]
    cash = initial_cash
    shares = 0.0
    was_fast_above = False
    trades: list[BacktestTrade] = []
    equity_curve: list[EquityPoint] = []

    for index, bar in enumerate(bars):
        fast = sma(closes, fast_sma, index)
        slow = sma(closes, slow_sma, index)

        if fast is not None and slow is not None:
            is_fast_above = fast > slow

            if is_fast_above and not was_fast_above and shares == 0 and cash > 0:
                shares = cash / bar.close
                trade_value = shares * bar.close
                trades.append(
                    BacktestTrade(
                        side="buy",
                        time=bar.time,
                        price=bar.close,
                        quantity=round(shares, 8),
                        value=round(trade_value, 2),
                    )
                )
                cash = 0

            if not is_fast_above and was_fast_above and shares > 0:
                trade_value = shares * bar.close
                cash = trade_value
                trades.append(
                    BacktestTrade(
                        side="sell",
                        time=bar.time,
                        price=bar.close,
                        quantity=round(shares, 8),
                        value=round(trade_value, 2),
                    )
                )
                shares = 0

            was_fast_above = is_fast_above

        equity = cash + shares * bar.close
        equity_curve.append(EquityPoint(time=bar.time, equity=round(equity, 2)))

    final_equity = equity_curve[-1].equity if equity_curve else initial_cash
    completed_at = datetime.now(timezone.utc)

    return BacktestResponse(
        symbol=symbol.upper(),
        timeframe="1d",
        strategy=f"SMA crossover {fast_sma}/{slow_sma}",
        engine="manual",
        source=source,
        initial_cash=round(initial_cash, 2),
        final_equity=round(final_equity, 2),
        total_return=round((final_equity - initial_cash) / initial_cash, 6),
        max_drawdown=round(max_drawdown(equity_curve), 6),
        trade_count=len(trades),
        win_rate=trade_win_rate(trades),
        started_at=started_at,
        completed_at=completed_at,
        trades=trades,
        equity_curve=equity_curve,
    )
