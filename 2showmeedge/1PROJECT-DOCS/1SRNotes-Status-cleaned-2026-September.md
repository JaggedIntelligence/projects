#  ShowmeEdge Project  FEATURES Status

Updatge Date:  2026-September-12

### 1. Big picture
 - here we list what is working and what is not 
 - over all project status
 - we have TWO Databases 1)  Quest DB which holds  Stock Tikcer DAILY data 2) PostgresDB 

## 2. ----------- How to Start Servcies --------

 ### 2.1 How to start the various Services/Servers :  QuestDB, FastAPI server, PostGresDB 
  - 1. All services START is defined in package.json file

  - $ pnpm install. --> installs all packages defined in package.json ; be in  ~/projects/showmeedge foler 
  - pnpm run dev   --> start Next.js Server ( in Terminal Tab1)

### 2.2 : start QuestDB and PostgreDB are started and Stopped as below 
     pnpm db:start 
     pnpm db:stop  --> use only when you need to shutdown DB

     where above are defined in package.json as
        "db:start": "bash scripts/db-init.sh start"

 ### 2.3. FastAPI Server is started with ( Uvcorn server)
    pnpm market-api:start 

    where above are defined in package.json as
        "market-api:start": "bash scripts/db-init.sh market",

 ### 2.4  after starting above , list docker services with
  $ docker status  --> It shows 3 services running a) Quest DB. b) Postgres DB.  c) Python Uvcorn Server

  --  QuestDB admin CONSOLE UI is available at , so you can Query any Table QuestDB table
    http://127.0.0.1:9000/index.html to see QuestDB admin console
    
   isssue folllowing Query  to see TABLE Data ...
   select *  from equity_ohlcv_daily  where symbol = 'EURUSD'   order by ts desc
 - 




## 3.  STOCK Daily DATA  End of DAY Daily DATA Update to QUEST DB

 -- We got 3.18 million rows from 1997-01-01 to 2016-06-02 for all S&P 500 symbols
 - Thank god...  this is great achivement of getting 3.2 million rows ..
 

### 3.1  How to run Shell Batch JOB to Fetch and update DAILY Stocks DATA from Yahoo finance for 3000 TIkcers
 
 -- run these from  project home Page that is :  /projects/showmeedge folder

-- both will work, try second to get all 3000 stock tickers 
 -- with out '--start YYYY-MM-DD' it will do for the LATEST 30 to 40 DAYS of DATA.

$bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh --universe russell3000_current

$bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh --universe sp500_current


## 4/ Industry Peers for a Given Stock

 - Industry_peers table is populated in the QuestDB, following  Query shows AMD peers ( I think we scraped from Yahoo finance peers page)
 
 select *  from industry_peers     where source_ticker  = 'AMD'  

 - TODO: so Build a route /peers and UI screens to show , for a given symbole like AMD show the Peers 
 - how peers stock is performing in the last 1 day, 2 days, 5 days, 20 days, 100 days to get an Idea