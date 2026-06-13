"use client";

import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { NightVisionCandlestickChart } from "@/components/nvcharts/nightvision-candlestick-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function clampDays(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), max);
}

function formatBarDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return value;

  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(date).toUpperCase();
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" }).format(date);

  return `${weekday} ${month} ${day}`;
}

// ------***. SR removed lots of stuff inside Chart panel.  above Chart ---------------------

export function NightVisionMarketChartPanel({ symbols }: { symbols: ChartSymbol[] }) {
  const chartSymbols = useMemo(() => (symbols.length ? symbols : fallbackSymbols), [symbols]);
  const [ticker, setTicker] = useState(chartSymbols[0]?.ticker ?? "AAPL");
  const [daysBackInput, setDaysBackInput] = useState("5");
  const [hiddenTailDays, setHiddenTailDays] = useState(0);

  useEffect(() => {
    if (!chartSymbols.some((symbol) => symbol.ticker === ticker)) {
      setTicker(chartSymbols[0]?.ticker ?? "AAPL");
    }
  }, [chartSymbols, ticker]);

  const barsQuery = api.marketData.bars.useQuery({ ticker, timeframe: "1d" });
  const queryBars = barsQuery.data?.bars;
  const bars = useMemo(() => queryBars ?? [], [queryBars]);
  const maxHiddenTailDays = Math.max(bars.length - 1, 0);
  const displayedBars = useMemo(() => bars.slice(0, bars.length - hiddenTailDays), [bars, hiddenTailDays]);
  const latestBar = displayedBars.at(-1);
  const previousBar = displayedBars.at(-2);
  const latestBarDate = latestBar ? formatBarDate(latestBar.time) : null;
  const change = latestBar && previousBar ? latestBar.close - previousBar.close : 0;
  const changePercent = latestBar && previousBar ? (change / previousBar.close) * 100 : 0;

  useEffect(() => {
    if (hiddenTailDays <= maxHiddenTailDays) return;

    const nextHiddenTailDays = clampDays(hiddenTailDays, maxHiddenTailDays);
    setHiddenTailDays(nextHiddenTailDays);
    setDaysBackInput(String(nextHiddenTailDays));
  }, [hiddenTailDays, maxHiddenTailDays]);

  function updateHiddenTailDays(nextDays: number) {
    const nextHiddenTailDays = clampDays(nextDays, maxHiddenTailDays);
    setHiddenTailDays(nextHiddenTailDays);
    setDaysBackInput(String(nextHiddenTailDays));
  }

  function applyDaysBack() {
    updateHiddenTailDays(Number(daysBackInput));
  }

  function showPreviousDay() {
    updateHiddenTailDays(hiddenTailDays + 1);
  }

  function showNextDay() {
    updateHiddenTailDays(hiddenTailDays - 1);
  }

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
          {hiddenTailDays ? <Badge variant="outline">{hiddenTailDays} hidden</Badge> : null}
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

        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="days-go-back" className="text-xs font-medium text-muted-foreground">
              Days go back
            </Label>
            <Input
              id="days-go-back"
              type="number"
              inputMode="numeric"
              min={0}
              max={maxHiddenTailDays}
              value={daysBackInput}
              onChange={(event) => setDaysBackInput(event.target.value)}
              className="h-9 w-32"
            />
          </div>
          <Button type="button" size="sm" onClick={applyDaysBack} disabled={!bars.length}>
            Update
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Remove one visible day"
            aria-label="Remove one visible day"
            onClick={showPreviousDay}
            disabled={hiddenTailDays >= maxHiddenTailDays}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Add one visible day"
            aria-label="Add one visible day"
            onClick={showNextDay}
            disabled={hiddenTailDays <= 0}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {latestBarDate ? (
            <Badge variant="outline" className="ml-2 flex h-9 items-center px-3 text-sm font-medium" aria-live="polite">
              {latestBarDate}
            </Badge>
          ) : null}
        </div>

        {barsQuery.isLoading ? <div className="h-80 animate-pulse rounded-md border bg-muted" /> : <NightVisionCandlestickChart bars={displayedBars} ticker={ticker} />}
      </CardContent>
    </Card>
  );
}
