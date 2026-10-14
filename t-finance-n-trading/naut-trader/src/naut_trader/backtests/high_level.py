"""Run the NautilusTrader high-level backtest tutorial.

Source: https://nautilustrader.io/docs/latest/getting_started/backtest_high_level/
"""

import os
import shutil
from decimal import Decimal
from pathlib import Path

import pandas as pd
from nautilus_trader.backtest import BacktestNode
from nautilus_trader.common import LogLevel
from nautilus_trader.config import BacktestDataConfig
from nautilus_trader.config import BacktestEngineConfig
from nautilus_trader.config import BacktestRunConfig
from nautilus_trader.config import BacktestVenueConfig
from nautilus_trader.config import LoggerConfig
from nautilus_trader.core.datetime import dt_to_unix_nanos
from nautilus_trader.execution import MakerTakerFeeModel
from nautilus_trader.model import AccountType
from nautilus_trader.model import BookType
from nautilus_trader.model import Currency
from nautilus_trader.model import NautilusDataType
from nautilus_trader.model import OmsType
from nautilus_trader.model import Quantity
from nautilus_trader.persistence import ParquetDataCatalog
from nautilus_trader.testkit.providers import TestDataProvider
from nautilus_trader.testkit.providers import TestInstrumentProvider
from nautilus_trader.trading import EmaCrossConfig


PROJECT_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = PROJECT_ROOT / "catalog" / "high_level_tutorial"


def main() -> None:
    data_dir = Path(os.environ.get("NAUTILUS_DATA_DIR", "~/Downloads/Data")).expanduser() / "HISTDATA"
    raw_files = (
        sorted(
            path
            for path in data_dir.iterdir()
            if path.is_file() and (path.suffix == ".csv" or path.name.endswith(".csv.gz"))
        )
        if data_dir.is_dir()
        else []
    )

    if raw_files:
        instrument = TestInstrumentProvider.default_fx_ccy("EUR/USD")
        ticks = TestDataProvider.quotes_from_histdata_csv(instrument, raw_files[0])
    else:
        instrument = TestInstrumentProvider.default_fx_ccy("AUD/USD")
        ticks = TestDataProvider.quotes_from_truefx_csv(
            instrument,
            "truefx/audusd-ticks.csv",
            max_rows=20_000,
        )

    ticks.sort(key=lambda tick: tick.ts_init)
    print(f"Loaded {len(ticks)} quote ticks for {instrument.id}")

    # This directory contains only the catalog produced by this example.
    if CATALOG_PATH.exists():
        shutil.rmtree(CATALOG_PATH)
    CATALOG_PATH.mkdir(parents=True)
    catalog = ParquetDataCatalog(str(CATALOG_PATH))
    catalog.write_instruments([instrument])
    catalog.write_quote_ticks(ticks)

    all_ticks = catalog.query_quote_ticks(identifiers=[instrument.id.value])
    if not all_ticks:
        raise ValueError("No ticks found in catalog")
    print(f"Total ticks in catalog: {len(all_ticks)}")

    first_tick_time = pd.Timestamp(all_ticks[0].ts_init, unit="ns", tz="UTC")
    last_tick_time = pd.Timestamp(all_ticks[-1].ts_init, unit="ns", tz="UTC")
    print(f"Data range: {first_tick_time} to {last_tick_time}")

    start_ns = all_ticks[0].ts_init
    end_ns = dt_to_unix_nanos(first_tick_time + pd.Timedelta(days=14))
    selected_ticks = catalog.query_quote_ticks(
        identifiers=[instrument.id.value],
        start=start_ns,
        end=end_ns,
    )
    print(f"Selected ticks for backtest: {len(selected_ticks)}")

    venue_configs = [
        BacktestVenueConfig(
            name="SIM",
            oms_type=OmsType.HEDGING,
            account_type=AccountType.MARGIN,
            book_type=BookType.L1_MBP,
            base_currency=Currency.from_str("USD"),
            starting_balances=["1_000_000 USD"],
            fee_model=MakerTakerFeeModel(
                maker_rate=Decimal("0.00002"),
                taker_rate=Decimal("0.00002"),
            ),
        ),
    ]
    data_configs = [
        BacktestDataConfig(
            data_type=NautilusDataType.QuoteTick,
            catalog_path=str(CATALOG_PATH),
            instrument_id=instrument.id,
            start_time=start_ns,
            end_time=end_ns,
        ),
    ]
    config = BacktestRunConfig(
        venues=venue_configs,
        data=data_configs,
        engine=BacktestEngineConfig(
            logging=LoggerConfig(stdout_level=LogLevel.ERROR),
        ),
    )

    node = BacktestNode(configs=[config])
    node.build()
    node.add_builtin_strategy(
        config.id,
        "EmaCross",
        EmaCrossConfig(
            instrument_id=instrument.id,
            trade_size=Quantity.from_int(1_000_000),
            fast_period=10,
            slow_period=20,
        ),
    )
    results = node.run()
    print(results)


if __name__ == "__main__":
    main()
