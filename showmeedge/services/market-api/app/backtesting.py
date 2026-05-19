from datetime import datetime, timezone

from app.models import BacktestResponse, BacktestTrade, EquityPoint, OhlcvBar


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

