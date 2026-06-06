"use client";

import { Activity, Database, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { NightVisionCandlestickChart } from "@/components/trading/nightvision-candlestick-chart";
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

function sourceLabel(source?: string, provider?: string | null) {
  if (source === "questdb_yfinance_daily") {
    return "QuestDB / yfinance";
  }
  if (source === "questdb_seeded_from_mock") {
    return "QuestDB / mock";
  }
  if (source === "next_mock_fallback") {
    return "Next.js mock fallback";
  }
  if (source === "questdb" && provider) {
    return `QuestDB / ${provider}`;
  }
  return source ?? "mock_static";
}

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
            Market chart
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Daily OHLCV from QuestDB when backfilled, with local mock fallback for empty symbols.</p>
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
          <Badge variant="secondary">{sourceLabel(barsQuery.data?.source, barsQuery.data?.provider)}</Badge>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => ingestMock.mutate({ tickers: chartSymbols.map((symbol) => symbol.ticker), timeframe: "1d" })}
            disabled={ingestMock.isPending}
          >
            <Database className="h-4 w-4" />
            {ingestMock.isPending ? "Ingesting..." : "Ingest mock bars"}
          </Button>
          <Button type="button" variant="outline" onClick={() => runBacktest.mutate({ ticker, timeframe: "1d" })} disabled={runBacktest.isPending}>
            <Play className="h-4 w-4" />
            {runBacktest.isPending ? "Running..." : "Run SMA backtest"}
          </Button>
        </div>
        {ingestMock.data ? (
          <p className="text-sm text-muted-foreground">
            Ingested {ingestMock.data.inserted_bars} bars into QuestDB for {ingestMock.data.symbols.join(", ")}.
          </p>
        ) : null}
        {ingestMock.error ? <p className="text-sm text-destructive">{ingestMock.error.message}</p> : null}
        {barsQuery.isLoading ? <div className="h-80 animate-pulse rounded-md border bg-muted" /> : <NightVisionCandlestickChart bars={bars} ticker={ticker} />}
        {runBacktest.data ? (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <Metric label="Strategy" value={runBacktest.data.strategy} />
            <Metric label="Final equity" value={`$${money(runBacktest.data.final_equity)}`} />
            <Metric label="Return" value={`${(runBacktest.data.total_return * 100).toFixed(2)}%`} />
            <Metric label="Trades" value={String(runBacktest.data.trade_count)} />
          </div>
        ) : null}
        {runBacktest.error ? <p className="text-sm text-destructive">{runBacktest.error.message}</p> : null}
        <p className="text-xs text-muted-foreground">
          Charts by{" "}
          <a className="underline underline-offset-2" href="https://nightvision.dev" target="_blank" rel="noreferrer">
            Night Vision
          </a>
          .
        </p>
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
