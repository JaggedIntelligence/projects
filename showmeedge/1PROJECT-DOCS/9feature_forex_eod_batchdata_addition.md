# Feature: Forex EOD Batch Data Addition

## Goal

Add Forex pair historical and EOD daily bars using the same market-data structure already used for stocks.

The implementation should reuse the existing Yahoo/yfinance daily OHLC ingestion path, add a Forex universe CSV, and keep QuestDB storage unchanged for now.

## Current Stock Data Pattern

Stock historical data is loaded through:

- `services/market-api/app/providers/yfinance_provider.py`
- `services/market-api/app/data/sp500_current.csv`
- `services/market-api/app/jobs/backfill_daily.py`
- `services/market-api/app/jobs/update_daily_recent.py`
- `batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh`
- `batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh`

The same pattern can support Forex because `yfinance.download()` accepts Yahoo Finance FX symbols such as `EURUSD=X`, `JPY=X`, and `GBPUSD=X`.

## Design Decisions

1. Keep using `yfinance`

   No new provider is required for the first Forex chart/data pass. The existing provider already fetches generic OHLCV bars.

2. Add a Forex universe CSV

   Add:

   `services/market-api/app/data/forex_major_pairs.csv`

   Keep the same column format as `sp500_current.csv`:

   ```csv
   symbol,provider_symbol,name,exchange,currency,sector,industry
   EURUSD,EURUSD=X,EUR/USD,FX,USD,Forex,Major Pair
   USDJPY,JPY=X,USD/JPY,FX,JPY,Forex,Major Pair
   ```

   App symbols stay clean, for example `EURUSD` and `USDJPY`. Yahoo-specific symbols stay in `provider_symbol`.

3. Keep QuestDB table as-is

   Continue storing daily bars in `equity_ohlcv_daily`.

   The table name is equity-specific, but the schema works for Forex daily OHLC data. Avoid a table migration in this phase.

4. Handle missing Forex volume

   Yahoo FX bars may return `Volume` as `0`, missing, or `NaN`.

   Provider behavior:

   - If `Volume` is present and valid, use it.
   - If `Volume` is missing or `NaN` for Yahoo FX symbols ending in `=X`, store `volume = 0`.
   - If `Volume` is missing for stock/ETF symbols, keep strict behavior and skip the row.

5. Reuse existing backfill and EOD jobs

   Use the same Python jobs with `--universe forex_major_pairs`.

   Forex is a small universe, so pass `--allow-small-universe` or lower `--min-symbols`.

6. Make batch logs universe-aware

   The shell wrappers should not produce S&P-looking paths for Forex runs.

   Default log/report labels should be derived from the selected universe:

   - `showmeedge-sp500-backfill`
   - `showmeedge-sp500-eod`
   - `showmeedge-forex-major-pairs-backfill`
   - `showmeedge-forex-major-pairs-eod`

7. Make verification universe-aware

   Verification should summarize only the requested universe symbols, not all rows where `provider = 'yfinance'`.

   For Forex, verification should report:

   - requested universe
   - requested symbol count
   - requested yfinance row count
   - requested distinct symbol count
   - start/end timestamps for requested symbols
   - missing symbols, if any

## Implementation Scope

### Market API

- Add `forex_major_pairs.csv`.
- Update `YFinanceProvider` volume parsing to default missing Yahoo FX volume to `0`.
- Add unit tests for:
  - Forex universe mapping.
  - FX `NaN` volume becomes `0`.
  - FX missing volume becomes `0`.
  - Stock missing volume is still skipped.

### Batch Wrappers

Update:

- `batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh`
- `batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh`

Changes:

- Derive default `LOG_ROOT` from `--universe`.
- Derive temp report filenames from the same run label.
- Keep custom `--log-root` override working.
- Improve the small-universe error message so it applies to Forex, not only S&P 500.
- Update verification SQL to load the requested universe and filter by those symbols.

### Documentation

Update:

- `batch-jobs/yahoo-daily-bars-data/README.md`

Document that the existing wrappers can run both S&P 500 and Forex universes.

## Backfill Command

Historical Forex backfill:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh \
  --universe forex_major_pairs \
  --allow-small-universe \
  --start 2003-01-01 \
  --rebuild
```

If the image is already rebuilt with the latest code/data:

```bash
bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh \
  --universe forex_major_pairs \
  --allow-small-universe \
  --start 2003-01-01
```

## EOD Update Command

Incremental Forex refresh:

```bash
bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh \
  --universe forex_major_pairs \
  --allow-small-universe \
  --rebuild
```

If the image is already rebuilt:

```bash
bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh \
  --universe forex_major_pairs \
  --allow-small-universe
```

## Verification

Expected verification output should be scoped to the Forex universe.

Example from the successful local DB check:

```text
requested_universe=forex_major_pairs
requested_symbols=28
requested_yfinance_rows=159958
requested_distinct_symbols=28
requested_start_ts=2003-01-01 00:00:00
requested_end_ts=2026-06-07 00:00:00
```

API/UI read path:

```bash
curl "http://localhost:8000/market-data/bars?symbol=EURUSD&timeframe=1d&provider=yfinance&seed_if_empty=false"
```

The UI should request symbols like `EURUSD`, `USDJPY`, and `GBPUSD`; the provider maps those to Yahoo symbols from the Forex universe CSV.

## Notes And Risks

- Forex volume is not meaningful in the same way as stock volume; storing `0` is intentional when Yahoo omits it.
- The table name `equity_ohlcv_daily` remains unchanged for now.
- Existing wrappers still default to `sp500_current`, so Forex runs must explicitly pass `--universe forex_major_pairs`.
- Forex is a small universe, so runs need `--allow-small-universe` unless `--min-symbols` is lowered.
- For production-grade real-time FX, bid/ask spread, tick data, or strict SLA, a dedicated FX data provider may be needed later.

