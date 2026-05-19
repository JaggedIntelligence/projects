import { z } from "zod";

export const timeframeSchema = z.enum(["1d"]);

export const marketBarsInputSchema = z.object({
  ticker: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
  timeframe: timeframeSchema.default("1d")
});

export const marketIngestMockSchema = z.object({
  tickers: z
    .array(z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()))
    .min(1)
    .default(["AAPL", "MSFT", "SPY"]),
  timeframe: timeframeSchema.default("1d")
});

export const backtestRunSchema = z
  .object({
    ticker: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
    timeframe: timeframeSchema.default("1d"),
    initialCash: z.coerce.number().finite().positive().default(100000),
    fastSma: z.coerce.number().int().min(2).default(10),
    slowSma: z.coerce.number().int().min(3).default(30)
  })
  .refine((value) => value.fastSma < value.slowSma, {
    message: "Fast SMA must be lower than slow SMA",
    path: ["fastSma"]
  });

export type Timeframe = z.infer<typeof timeframeSchema>;
export type MarketBarsInput = z.infer<typeof marketBarsInputSchema>;
export type MarketIngestMockInput = z.infer<typeof marketIngestMockSchema>;
export type BacktestRunInput = z.infer<typeof backtestRunSchema>;
