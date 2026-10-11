# both will work, try second to get all 3000 stock tickers 

bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh --universe russell3000_current

bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh --universe sp500_current



# for EAM indicators update, seems we don't need it ,  above update_sp500-eod-safe.sh will do the EMA calc update also by clalling .sh after EOD update ..
 bash batch-jobs/equity-daily-indicators/update-emas.sh --universe russell3000_current

once done, you can rows from UI or from QuestDB DBAdmin with SQL
 - http://127.0.0.1:9000/index.html
 - select *  from equity_ohlcv_daily  where symbol = 'AMD'   order by ts desc