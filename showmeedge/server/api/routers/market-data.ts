import { marketBarsInputSchema } from "@/lib/market-data-validators";
import { getMockOhlcvBars } from "@/lib/mock-ohlcv";
import { protectedProcedure, router } from "@/server/api/trpc";

export const marketDataRouter = router({
  bars: protectedProcedure.input(marketBarsInputSchema).query(({ input }) => ({
    ticker: input.ticker,
    timeframe: input.timeframe,
    source: "mock_static",
    bars: getMockOhlcvBars(input.ticker, input.timeframe)
  }))
});
