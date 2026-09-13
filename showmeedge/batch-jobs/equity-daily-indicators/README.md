# Equity daily indicators

Populate missing price and volume EMA values after daily OHLCV ingestion:

```bash
bash batch-jobs/equity-daily-indicators/update-emas.sh --rebuild
```

The default run updates every `yfinance` row with at least one empty EMA column. Price EMAs use
`adj_close` with `close` as a fallback. Volume EMAs use `volume`.

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
