import { TRPCError } from "@trpc/server";

import { backtestRunSchema, marketBarsInputSchema, marketIngestMockSchema } from "@/lib/market-data-validators";
import { getMockOhlcvBars, type OhlcvBar } from "@/lib/mock-ohlcv";
import { protectedProcedure, router } from "@/server/api/trpc";

const MARKET_API_BASE_URL = (process.env.MARKET_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

type MarketBarsResponse = {
  ticker?: string;
  symbol: string;
  timeframe: "1d";
  source: string;
  provider?: string | null;
  bars: OhlcvBar[];
};

type MarketIngestResponse = {
  provider: string;
  timeframe: "1d";
  symbols: string[];
  inserted_bars: number;
};

type BacktestResponse = {
  symbol: string;
  timeframe: "1d";
  strategy: string;
  engine?: string;
  source: string;
  initial_cash: number;
  final_equity: number;
  total_return: number;
  max_drawdown: number;
  trade_count: number;
  win_rate: number | null;
  started_at: string;
  completed_at: string;
  trades: Array<{
    side: "buy" | "sell";
    time: string;
    price: number;
    quantity: number;
    value: number;
  }>;
  equity_curve: Array<{
    time: string;
    equity: number;
  }>;
};

async function fetchFromMarketApi<T>(path: string, init?: RequestInit, timeoutMs = 2500): Promise<T> {
  const response = await fetch(`${MARKET_API_BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      }
    } catch {
      message = body;
    }
    throw new Error(message || `Market API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const marketDataRouter = router({
  bars: protectedProcedure.input(marketBarsInputSchema).query(async ({ input }) => {
    try {
      return await fetchFromMarketApi<MarketBarsResponse>(
        `/market-data/bars?symbol=${encodeURIComponent(input.ticker)}&timeframe=${input.timeframe}&provider=yfinance&seed_if_empty=true`
      );
    } catch {
      return {
        ticker: input.ticker,
        symbol: input.ticker,
        timeframe: input.timeframe,
        source: "next_mock_fallback",
        provider: null,
        bars: getMockOhlcvBars(input.ticker, input.timeframe)
      };
    }
  }),

  ingestMock: protectedProcedure.input(marketIngestMockSchema).mutation(async ({ input }) => {
    try {
      return await fetchFromMarketApi<MarketIngestResponse>("/market-data/ingest/mock", {
        method: "POST",
        body: JSON.stringify({
          symbols: input.tickers,
          timeframe: input.timeframe,
          provider: "mock_static"
        })
      });
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Market API is unavailable"
      });
    }
  }),

  runBacktest: protectedProcedure.input(backtestRunSchema).mutation(async ({ input }) => {
    try {
      return await fetchFromMarketApi<BacktestResponse>("/backtests/run", {
        method: "POST",
        body: JSON.stringify({
          symbol: input.ticker,
          timeframe: input.timeframe,
          initial_cash: input.initialCash,
          fast_sma: input.fastSma,
          slow_sma: input.slowSma,
          seed_if_empty: true
        })
      }, 15000);
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Market API is unavailable"
      });
    }
  })
});
