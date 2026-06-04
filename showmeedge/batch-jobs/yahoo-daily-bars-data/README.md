# Yahoo Daily bars Data

### Big picture
 - two shell files in this folder
 - update-sp500-eod-safe.sh is USED to go and Fetch LAST FEW DAYS incremental DATA from Yahoo and update DB
 - backfill-sp500-safe.sh  is for FIRST TIME to get Data and insert into DB
 - .
 - TODO :
   - SR needs to setup CronJob to run update-sp500-eod-safe.sh COUPLE of Times in the DAY :  9:40 , 11, 1 PM, 4:20 PM ( all ET times)

### SP500 ticker symbols source locatoin
- the CSV file of the 500 tickers physical location is as follows 
- /services/market-api/app/data/sp500_current.csv
- both update-sp500-eod-safe.sh AND backfill-sp500-safe.sh use above file 
-  UNIVERSE="sp500_current"  shell varaiable is defined in .sh files and it is used to locate file and use 500 symbols