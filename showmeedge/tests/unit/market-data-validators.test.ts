import { describe, expect, it } from "vitest";

import { backtestRunSchema } from "@/lib/market-data-validators";

describe("backtestRunSchema", () => {
  it("normalizes ticker input and applies dual-SMA defaults", () => {
    const result = backtestRunSchema.parse({
      ticker: " aapl "
    });

    expect(result).toEqual({
      ticker: "AAPL",
      timeframe: "1d",
      initialCash: 100,
      fastSma: 10,
      slowSma: 50
    });
  });

  it("requires the fast SMA to be lower than the slow SMA", () => {
    const result = backtestRunSchema.safeParse({
      ticker: "AAPL",
      fastSma: 50,
      slowSma: 10
    });

    expect(result.success).toBe(false);
  });
});
