# Custom Queries on QuestDB table equity_ohlcv_daily  data 

### What is it
 - we need custom SQL queries to find out like what is the Max Draw down and Max profit potential in a given START and END Date range for a GIVEN TIcker
 - best way is to pass the Paramters and a QUERY text to QuestDB from  the UI Screen and it worked
 - below are examples Queries

### query 1.  window_of_max_drawdown_highest_profit

 --name : window_of_max_drawdown_highest_profit
 -- parameters: enter these values on the web site /query router web page AFTER pasting the Query below ...
 -- it shows Max Drawn down and Max Profit as % for a Given Stock in that DATE Range.
$1 : ticker : AAPL
$2 : source:  yfinance
$3 start_date = 2015-06-01
$4 end_date = 2015-06-01

WITH price_rows AS (
  SELECT
    ts,
    close
  FROM equity_ohlcv_daily
  WHERE symbol = $1
    AND provider = $2
    AND ts >= to_timestamp($3, 'yyyy-MM-dd')
    AND ts < dateadd(
      'd',
      1,
      to_timestamp($4, 'yyyy-MM-dd')
    )
    AND close > 0
),
summary AS (
  SELECT
    min(ts) AS actual_start_date,
    max(ts) AS actual_end_date,

    arg_min(close, ts) AS start_close,
    arg_max(close, ts) AS end_close,

    min(close) AS lowest_close,
    arg_min(ts, close) AS lowest_close_date,

    max(close) AS highest_close,
    arg_max(ts, close) AS highest_close_date,

    count() AS trading_days
  FROM price_rows
)
SELECT
  actual_start_date,
  actual_end_date,
  start_close,
  end_close,

  100.0 * (
    end_close - start_close
  ) / start_close AS performance_pct,

  lowest_close,
  lowest_close_date,
  100.0 * (
    lowest_close - start_close
  ) / start_close AS max_drawdown_pct,

  highest_close,
  highest_close_date,
  100.0 * (
    highest_close - start_close
  ) / start_close AS max_profit_potential_pct,

  trading_days
FROM summary;


### query 2.  for the last N days stock drop is between 5% and 8% of AMD then What is next 3day,  5day , 10 day Return of the Stock .

- SR got this kind of query worked, but lost the Source Code ...
- need to find it ..