"use client";

import { Activity, Database, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { NightVisionCandlestickChart } from "@/components/nvcharts/nightvision-candlestick-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const utils = api.useUtils();
  const ingestMock = api.marketData.ingestMock.useMutation({
    onSuccess: () => utils.marketData.bars.invalidate()
  });
  const runBacktest = api.marketData.runBacktest.useMutation();
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
      <CardContent className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex flex-wrap gap-2">
          
         
        </div>
        
        {ingestMock.error ? <p className="text-sm text-destructive">{ingestMock.error.message}</p> : null}
        {barsQuery.isLoading ? <div className="h-80 animate-pulse rounded-md border bg-muted" /> : <NightVisionCandlestickChart bars={bars} ticker={ticker} />}
        
        
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
