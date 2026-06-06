"use client";

import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { NightVisionCandlestickChart } from "@/components/nvcharts/nightvision-candlestick-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartSymbol = {
  id: string;
  ticker: string;
  name: string;
};

const fallbackSymbols: ChartSymbol[] = [
  { id: "mock-aapl", ticker: "AAPL", name: "Apple Inc." },
  { id: "mock-msft", ticker: "MSFT", name: "Microsoft Corp." },
  { id: "mock-spy", ticker: "SPY", name: "SPDR S&P 500 ETF" }
];

function money(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}


// ------***. SR removed lots of stuff inside Chart panel.  above Chart ---------------------

export function NightVisionMarketChartPanel({ symbols }: { symbols: ChartSymbol[] }) {
  const chartSymbols = useMemo(() => (symbols.length ? symbols : fallbackSymbols), [symbols]);
  const [ticker, setTicker] = useState(chartSymbols[0]?.ticker ?? "AAPL");

  useEffect(() => {
    if (!chartSymbols.some((symbol) => symbol.ticker === ticker)) {
      setTicker(chartSymbols[0]?.ticker ?? "AAPL");
    }
  }, [chartSymbols, ticker]);

  const barsQuery = api.marketData.bars.useQuery({ ticker, timeframe: "1d" });
  const bars = barsQuery.data?.bars ?? [];
  const latestBar = bars.at(-1);
  const previousBar = bars.at(-2);
  const change = latestBar && previousBar ? latestBar.close - previousBar.close : 0;
  const changePercent = latestBar && previousBar ? (change / previousBar.close) * 100 : 0;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market chart*
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ticker">
          {chartSymbols.map((symbol) => {
            const isSelected = symbol.ticker === ticker;

            return (
              <Button
                key={symbol.id}
                type="button"
                variant={isSelected ? "secondary" : "outline"}
                size="sm"
                aria-pressed={isSelected}
                title={`${symbol.ticker} · ${symbol.name}`}
                className="h-8 px-2.5 text-xs font-semibold"
                onClick={() => setTicker(symbol.ticker)}
              >
                {symbol.ticker}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{ticker}</Badge>
          <Badge variant="outline">1d</Badge>
          {latestBar ? (
            <>
              <span className="text-sm font-medium">${money(latestBar.close)}</span>
              <span className={change >= 0 ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-rose-600 dark:text-rose-400"}>
                {change >= 0 ? "+" : ""}
                {money(change)} ({changePercent.toFixed(2)}%)
              </span>
            </>
          ) : null}
        </div>
        {barsQuery.isLoading ? <div className="h-80 animate-pulse rounded-md border bg-muted" /> : <NightVisionCandlestickChart bars={bars} ticker={ticker} />}
      </CardContent>
    </Card>
  );
}
