# Yahoo Daily bars Data

### Big picture
 - two shell files in this folder
 - update-sp500-eod-safe.sh is USED to Fetch LAST FEW DAYS incremental DATA from Yahoo and update DB
 - backfill-sp500-safe.sh is for FIRST TIME historical loads and inserts into DB
 - both scripts accept --universe, so the same wrappers can run S&P 500 stocks or Forex pairs
 - .
 - TODO :
   - SR needs to setup CronJob to run update-sp500-eod-safe.sh COUPLE of Times in the DAY :  9:40 , 11, 1 PM, 4:20 PM ( all ET times)

### Symbol universe source location
- CSV universe files live under:
- /services/market-api/app/data/
- stock universe:
- /services/market-api/app/data/sp500_current.csv
- Forex universe:
- /services/market-api/app/data/forex_major_pairs.csv
- both update-sp500-eod-safe.sh AND backfill-sp500-safe.sh default to UNIVERSE="sp500_current"
- pass --universe forex_major_pairs --allow-small-universe for Forex runs
- default logs are written under LOG/showmeedge-<universe>-backfill or LOG/showmeedge-<universe>-eod
