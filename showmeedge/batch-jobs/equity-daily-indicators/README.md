# Equity daily indicators

Populate missing price EMA, volume EMA, and daily close-change values after daily OHLCV ingestion:

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh --rebuild
```

The default run updates every eligible `yfinance` row with at least one empty indicator column.
Price EMAs use `adj_close` with `close` as a fallback. Volume EMAs use `volume`.
`close_change_pct` uses the raw close-to-previous-close percentage change; the first row in each
symbol/provider series remains null.

Limit a run to a universe or a few symbols:

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh --universe sp500_current
bash batch-jobs/equity-daily-indicators/update-emas.sh --symbols AAPL MSFT
```

Force recalculation of every selected row:

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh --symbols AAPL --rebuild-all
```

The S&P 500 EOD wrapper runs this job automatically after a successful OHLCV refresh.


# Files that changed as part of this "EMA indicators FEATURE" implementation ..

README.md 
batch-jobs/equity-daily-indicators/README.mdbatch-jobs/equity-daily-indicators/README.md 
package.jsonpackage.json
scripts/README.mdscripts/README.md
scripts/db-init.shscripts/db-init.sh

batch-jobs/equity-daily-indicators/update-emas.shbatch-jobs/equity-daily-indicators/update-emas.sh 
batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.shbatch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh 
db/questdb/init.sqldb/questdb/init.sql
db/questdb/migrations/0001_add_equity_ohlcv_daily_emas.sqldb/questdb/migrations/0001_add_equity_ohlcv_daily_emas.sql

services/market-api/app/jobs/update_daily_emas.pyservices/market-api/app/jobs/update_daily_emas.py
services/market-api/app/main.pyservices/market-api/app/main.py
services/market-api/app/repositories/questdb_daily_bars.pyservices/market-api/app/repositories/questdb_daily_bars.py
services/market-api/tests/test_daily_emas.pyservices/market-api/tests/test_daily_emas.py
