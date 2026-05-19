from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.backtesting import run_sma_crossover_backtest
from app.config import get_settings
from app.mock_data import get_mock_ohlcv_bars
from app.models import (
    BacktestRequest,
    BacktestResponse,
    BarsResponse,
    MockIngestRequest,
    MockIngestResponse,
    Timeframe,
)
from app.questdb import ensure_market_bars_table, fetch_bars, insert_bars, ping_questdb

settings = get_settings()

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
    seed_if_empty: bool = True,
) -> BarsResponse:
    normalized_symbol = symbol.upper()

    try:
        bars = fetch_bars(normalized_symbol, timeframe)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"QuestDB query failed: {exc}") from exc

    source = "questdb"
    if not bars and seed_if_empty:
        mock_bars = get_mock_ohlcv_bars(normalized_symbol, timeframe)
        insert_bars(normalized_symbol, timeframe, "mock_static", mock_bars)
        bars = fetch_bars(normalized_symbol, timeframe)
        source = "questdb_seeded_from_mock"

    return BarsResponse(symbol=normalized_symbol, timeframe=timeframe, source=source, bars=bars)


@app.post("/backtests/run", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest) -> BacktestResponse:
    if request.fast_sma >= request.slow_sma:
        raise HTTPException(status_code=400, detail="fast_sma must be lower than slow_sma")

    bars_response = get_market_bars(
        symbol=request.symbol,
        timeframe=request.timeframe,
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

