#  ShowmeEdge Project Status

### Big picture
 - here we list what is working and what is not 
 - over all project status

 ### What is working 
  - all 3 services are coming up with commands shown below.
  -.
  - but SR needs to test what is Inside QuestDB , how to add DB rows in Quest DB and get the DATA OUT
  - read /1PROJECT-DOCS/feature-add-FASTAPI*.md file


 ### QuestDB, FastAPI server, PostGresDB 
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


### We got 3.18 million rows from 1997-01-01 to 2016-06-02 for all S&P 500 symbols
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
 
  Next natural step when you’re ready is the EOD update job using the same scripts/LOG/.../<run-id>/ pattern.

```