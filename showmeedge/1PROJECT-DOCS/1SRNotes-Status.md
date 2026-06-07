#  ShowmeEdge Project Status

### Big picture
 - here we list what is working and what is not 
 - over all project status

 ### 1. What is working 
  - all 3 services are coming up with commands shown below.
  -.
  - but SR needs to test what is Inside QuestDB , how to add DB rows in Quest DB and get the DATA OUT
  - read /1PROJECT-DOCS/feature-add-FASTAPI*.md file


 ### 2. QuestDB, FastAPI server, PostGresDB 
  - 1. all 3 are installed using docker specified in /scripts/docker-compose.yml file
  -
  - 2. QuestDB and PostgreDB are started and Stopped as below 
     pnpm db:start 
     pnpm db:stop 

     where above are defined in package.json as
        "db:start": "bash scripts/db-init.sh start"

 - 3. FastAPI Server is started with
    pnpm market-api:start 

    where above are defined in package.json as
        "market-api:start": "bash scripts/db-init.sh market",

 - 4. QuestDB admin UI is available at 
    http://127.0.0.1:9000/index.html

### 2.1 Where QuestDB is getting starated

 invoked from package.json as
        "db:start": "bash scripts/db-init.sh start"

 below is part of db-init.sh 
```
start_infra() {
  echo "Starting Postgres and QuestDB..."
  compose up -d postgres questdb
}

start)
    start_infra
    ;;
```


### 3. We got 3.18 million rows from 1997-01-01 to 2016-06-02 for all S&P 500 symbols
 - Thank god...  this is great achivement of getting 3.2 million rows ..
 - thanks to Codex $20 subscription it does all ..
 - thanks we selected QuestDB,  3 million row is breeze for  QuestDB ...

 - all details of design is in file : **3feature-add-BACKFILL-sp500.md**

 - thanks to SR , he went to step by step to understand the process instead of VIBE coding ( no /goal thing ..)
 - .
 -SR Note: when you want run the DATA fill , do not execute from  command line, instead login to 'Codex' be in codebase and Ask to Ingest Data, it will do it.

**message from CodeX**
```
 Beautiful. Glad QuestDB looks right.

We now have a much cleaner market-data foundation: 
 full historical load, bounded backfill control, 
 restart-safe logs, and no-data separated from real failures.
 
  Next natural step when you’re ready is the EOD update job using the same batch-jobs/yahoo-daily-bars-data/LOG/.../<run-id>/ pattern.

```

### 4. EOD update run  on June-02  5 PM PST ..
 - SR ran EOD update with the shell script bleow as given in the file '/1PROJECT-DOCS/4feature-add-EOD-refresh.md' and it worked.
 - nice multiple log files are in folder '/batch-jobs/yahoo-daily-bars-data/LOG/showmeedge-sp500-eod/20260602-170311' ( DATE-TIMEran 5 pm 03 min 11 sec)
 - I ran this from Mac Terminal being in /showmeedge folder
 - I ran out of credits, so better to run these scripts from 'local Terminal' instead of 'Codex', Codex RUNS uses tokens ..
 - now may need to go $100 plan .., Usage shows 'no credits ..'
 - .

 ```
bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh \
  --start 2026-05-20 \
  --end 2026-06-02
```



###  5. Lot of issues with beatuifulsoup and  Crawl4AI

 - Codex tried many things , still not getting live webpage from yahoo 
 - so avoid. Beautiful soup and Craw4ai
 - the botched files are in /services/market-api/app/test-not-working folder 
 - .
 - The solution is  Headless browser under Node.js  which is the file in /scripts/yahoo-earnings-calender.mjs


### 9. Major version 1.2 : Forex data support  with Batch data and UI screens
----------------------------------------------------------------------------
 - Forex Daily data ingested into QuestDB from 2003 for all major forex pairs ( into stame Table as Stocks data)
 - UI screen works for Forex just like Stocks ( no special treatement )