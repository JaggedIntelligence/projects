import csv
from io import StringIO

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.backtesting import run_sma_crossover_backtest
from app.config import get_settings
from app.logging_config import configure_logging
from app.mock_data import get_mock_ohlcv_bars
from app.models import (
    BacktestRequest,
    BacktestResponse,
    BarsResponse,
    DailyOhlcvBar,
    MockIngestRequest,
    MockIngestResponse,
    OhlcvBar,
    SqlQueryRequest,
    SqlQueryResponse,
    Timeframe,
)
from app.questdb import ensure_market_bars_table, fetch_bars, insert_bars, ping_questdb, questdb_connection
from app.repositories.questdb_daily_bars import ensure_equity_ohlcv_daily_table, fetch_daily_bars

settings = get_settings()
configure_logging(settings)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_market_bars_table()
    ensure_equity_ohlcv_daily_table()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/questdb/health")
def questdb_health() -> dict[str, str]:
    try:
        is_ready = ping_questdb()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"QuestDB is not ready: {exc}") from exc

    return {"status": "ok" if is_ready else "not_ready"}


@app.post("/query/sql", response_model=SqlQueryResponse)
def run_sql_query(request: SqlQueryRequest) -> SqlQueryResponse:
    try:
        with questdb_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(request.sql)
                columns = [_column_name(column) for column in cursor.description or []]
                rows = cursor.fetchall() if cursor.description else []
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"QuestDB query failed: {exc}") from exc

    return SqlQueryResponse(
        csv=_rows_to_csv(columns, rows),
        row_count=len(rows),
        columns=columns,
    )


@app.post("/market-data/ingest/mock", response_model=MockIngestResponse)
def ingest_mock_data(request: MockIngestRequest) -> MockIngestResponse:
    inserted = 0
    normalized_symbols = [symbol.upper() for symbol in request.symbols]

    for symbol in normalized_symbols:
        bars = get_mock_ohlcv_bars(symbol, request.timeframe)
        inserted += insert_bars(symbol, request.timeframe, request.provider, bars)

    return MockIngestResponse(
        provider=request.provider,
        timeframe=request.timeframe,
        symbols=normalized_symbols,
        inserted_bars=inserted,
    )


@app.get("/market-data/bars", response_model=BarsResponse)
def get_market_bars(
    symbol: str = Query(..., min_length=1, max_length=24),
    timeframe: Timeframe = "1d",
    provider: str = Query("yfinance", min_length=1, max_length=64),
    seed_if_empty: bool = True,
) -> BarsResponse:
    normalized_symbol = symbol.upper()

    try:
        daily_bars = fetch_daily_bars(normalized_symbol, provider=provider)
        if daily_bars:
            return BarsResponse(
                symbol=normalized_symbol,
                timeframe=timeframe,
                source=f"questdb_{provider.lower()}_daily",
                provider=provider.lower(),
                bars=[daily_bar_to_ohlcv_bar(bar) for bar in daily_bars],
            )

        bars = fetch_bars(normalized_symbol, timeframe)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"QuestDB query failed: {exc}") from exc

    source = "questdb"
    if not bars and seed_if_empty:
        mock_bars = get_mock_ohlcv_bars(normalized_symbol, timeframe)
        insert_bars(normalized_symbol, timeframe, "mock_static", mock_bars)
        bars = fetch_bars(normalized_symbol, timeframe)
        source = "questdb_seeded_from_mock"

    return BarsResponse(symbol=normalized_symbol, timeframe=timeframe, source=source, provider=None, bars=bars)


def daily_bar_to_ohlcv_bar(bar: DailyOhlcvBar) -> OhlcvBar:
    return OhlcvBar(
        time=bar.time,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        close=bar.close,
        volume=bar.volume,
    )


def _column_name(column: object) -> str:
    name = getattr(column, "name", None)
    if name is not None:
        return str(name)

    return str(column[0])


def _rows_to_csv(columns: list[str], rows: list[tuple[object, ...]]) -> str:
    output = StringIO()
    writer = csv.writer(output)

    if columns:
        writer.writerow(columns)
    writer.writerows(rows)

    return output.getvalue()


@app.post("/backtests/run", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest) -> BacktestResponse:
    if request.fast_sma >= request.slow_sma:
        raise HTTPException(status_code=400, detail="fast_sma must be lower than slow_sma")

    bars_response = get_market_bars(
        symbol=request.symbol,
        timeframe=request.timeframe,
        provider="yfinance",
        seed_if_empty=request.seed_if_empty,
    )

    if len(bars_response.bars) < request.slow_sma:
        raise HTTPException(status_code=400, detail="Not enough bars to run the requested backtest")

    return run_sma_crossover_backtest(
        symbol=request.symbol,
        bars=bars_response.bars,
        initial_cash=request.initial_cash,
        fast_sma=request.fast_sma,
        slow_sma=request.slow_sma,
        source=bars_response.source,
    )
