# both will work, try second to get all 3000 stock tickers 

bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh --universe sp500_current

bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh --universe russell3000_current


once done, you can rows from UI or from QuestDB DBAdmin with SQL
 - http://127.0.0.1:9000/index.html
 - select *  from equity_ohlcv_daily  where symbol = 'AMD'   order by ts desc