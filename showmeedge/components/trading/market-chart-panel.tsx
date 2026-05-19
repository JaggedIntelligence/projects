"use client";

import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LightweightCandlestickChart } from "@/components/trading/lightweight-candlestick-chart";

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

export function MarketChartPanel({ symbols }: { symbols: ChartSymbol[] }) {
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
            Market chart
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Static OHLCV data now; FastAPI and QuestDB can replace this source later.</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-64">
          <Select value={ticker} onValueChange={setTicker}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chartSymbols.map((symbol) => (
                <SelectItem key={symbol.id} value={symbol.ticker}>
                  {symbol.ticker} · {symbol.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{barsQuery.data?.source ?? "mock_static"}</Badge>
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
        {barsQuery.isLoading ? (
          <div className="h-80 animate-pulse rounded-md border bg-muted" />
        ) : (
          <LightweightCandlestickChart bars={bars} ticker={ticker} />
        )}
        <p className="text-xs text-muted-foreground">
          Charts by{" "}
          <a className="underline underline-offset-2" href="https://www.tradingview.com" target="_blank" rel="noreferrer">
            TradingView
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}

