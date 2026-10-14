# NautilusTrader tutorial project


###  Backtest tutorial 

1. SR note: Codex built this source code by just asking as the prompt:
```
can you take code from this Natulius trader  tutorial  URL and place the same code snippets in appropriate folders for this  project in /naut-trader to run this back test
https://nautilustrader.io/docs/latest/getting_started/backtest_high_level/
```

2. From this folder, install dependencies and run the high-level backtest:

```bash
uv sync
uv run naut-backtest
```

The backtest follows the [NautilusTrader high-level backtest tutorial](https://nautilustrader.io/docs/latest/getting_started/backtest_high_level/). By default it downloads the tutorial's AUD/USD sample ticks, writes a Parquet catalog to `catalog/high_level_tutorial/`, and runs the built-in EMA cross strategy. The generated catalog is ignored by Git and replaced on each run.

To use local HISTDATA CSV files instead, set `NAUTILUS_DATA_DIR` to the directory containing the `HISTDATA` folder before running the command. The tutorial's small `naut-trader` command still runs the original import check.
