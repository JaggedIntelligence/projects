WITH equity_ohlcv_daily AS (
    SELECT 
        ts,
        symbol,
        open,
        high,
        low,
        close,
        -- Day of week: 1 = Monday, 5 = Friday, etc.
        day_of_week(ts) as dow,
        -- Calculate the percentage gain/loss for the current day
        ((close - open) / open) * 100.0 AS current_return,
        -- Look ahead to the NEXT row's return (Monday's return from a Friday row)
        LEAD(((close - open) / open) * 100.0, 1) OVER (
            PARTITION BY symbol ORDER BY ts
        ) AS next_day_return,
        -- Look ahead TWO rows (Tuesday's return from a Friday row)
        LEAD(((close - open) / open) * 100.0, 2) OVER (
            PARTITION BY symbol ORDER BY ts
        ) AS two_days_ahead_return,
        -- Look ahead TWO rows for the exact Tuesday date for context
        LEAD(ts, 2) OVER (
            PARTITION BY symbol ORDER BY ts
        ) AS tuesday_date
    FROM assets_eod
)
SELECT 
    ts AS friday_date,
    symbol,
    current_return AS friday_drop_pct,
    next_day_return AS monday_gain_pct,
    tuesday_date,
    two_days_ahead_return AS tuesday_return_pct
FROM equity_ohlcv_daily
WHERE 
    symbol = 'AMD'
    AND dow = 5                                -- Current row is Friday
    AND current_return <= -4.0             -- Friday drop of 4% or worse
    AND next_day_return >= 3.0             -- Next day (Monday) gain of 3% or better
ORDER BY 
    symbol, 
    ts;