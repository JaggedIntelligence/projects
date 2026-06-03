# Docker operations

### big picture
- this file is created by SReddy
- to do bring up PostgresDB with docker-compose.yml file
- to Stop and Start DB 

### 1/ Commands to Start and Stop Postgres DB which is defined in the file /scripts/docker-compose.yml

1. be on Mac terminal, not OrbStack terminal. OrbStack Ubuntu can have issues with Docker.
2. be in the project root folder.
3. issue these commands through `package.json`.

```
Goal                        Command 
-----                       --------------
Initialize DB                       pnpm db:init    <-- these 4 are pnpm commmands defined in package.json. --- >
(create tabel Schema in Postgres DB)

Start DB                    pnpm db:start

Stop DB                     pnpm db:stop

Reset DB                    pnpm db:reset

Check Status                docker  ps              <--    these 2  are regular Docker commands ---->

Watch Messages              docker logs -f second-brain-postgres
(last param container name)
```

###  2/ major rewrite of "Postgres DB Docker container" operations of START and STOP

Now these operation are controlled with pnpm commands ( which are in package.json) in a simpler way and it all Works:

pnpm db:start

pnpm db:stop

###  3/ Meet Drizzle Studio
🖥 Drizzle Studio is a new way for you to explore SQL database on Drizzle projects.

https://orm.drizzle.team/drizzle-studio/overview 

SR Notes:
 - we have dirzzle-kit in package.json, all you do is on a Mac terminal at the root  folder /project-mgmt
 - pnpm db:studio
 - this will start a new web app, here to the web page url to see FULL Database ...
 - https://local.drizzle.studio

### 4/ Safe S&P 500 yfinance backfill

Use this wrapper for restartable QuestDB daily stock data backfills:

```bash
bash scripts/yahoo-daily-bars-data/backfill-sp500-safe.sh
```

The script starts `questdb` and `market-api`, checks service health, refuses to run a full backfill if the selected universe is unexpectedly small, writes timestamped logs under `scripts/LOG/showmeedge-sp500-backfill`, and calls:

```bash
python -m app.jobs.backfill_daily \
  --universe sp500_current \
  --start 2010-01-01 \
  --batch-size 10 \
  --skip-existing \
  --retry-attempts 3
```

For a small smoke test:

```bash
bash scripts/yahoo-daily-bars-data/backfill-sp500-safe.sh --allow-small-universe --max-symbols 20
```

For a bounded historical window, pass both dates. The end date is inclusive:

```bash
bash scripts/yahoo-daily-bars-data/backfill-sp500-safe.sh --start 2015-01-01 --end 2020-12-31
```

Each run writes:

```text
backfill.log
verification.log
failed-symbols.json
no-data-symbols.json
run-summary.json
```

### 5/ Safe S&P 500 end-of-day refresh

Use this wrapper after market close to refresh the recent daily window without rerunning the full historical backfill:

```bash
bash scripts/yahoo-daily-bars-data/update-sp500-eod-safe.sh
```

The script writes timestamped logs under `scripts/LOG/showmeedge-sp500-eod` and calls:

```bash
python -m app.jobs.update_daily_recent \
  --universe sp500_current \
  --lookback-days 10 \
  --batch-size 10 \
  --retry-attempts 3
```

For a small smoke test:

```bash
bash scripts/yahoo-daily-bars-data/update-sp500-eod-safe.sh --max-symbols 5 --lookback-days 2
```

Each EOD run writes:

```text
update.log
verification.log
failed-symbols.json
no-data-symbols.json
run-summary.json
```
