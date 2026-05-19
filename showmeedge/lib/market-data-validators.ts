import { z } from "zod";

export const timeframeSchema = z.enum(["1d"]);

export const marketBarsInputSchema = z.object({
  ticker: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
  timeframe: timeframeSchema.default("1d")
});

export type Timeframe = z.infer<typeof timeframeSchema>;
export type MarketBarsInput = z.infer<typeof marketBarsInputSchema>;
