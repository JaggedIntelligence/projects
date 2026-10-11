"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, CircleDollarSign, Gauge, LineChart, Play, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_INITIAL_CASH = 100;
const DEFAULT_FAST_SMA = 10;
const DEFAULT_SLOW_SMA = 50;

type BacktestResult = {
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

function money(value: number) {
  return value.toLocaleString(undefined, {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  });
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${percent(value)}`;
}

function compactNumber(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0
  });
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function sourceLabel(source: string) {
  if (source === "questdb_yfinance_daily") {
    return "QuestDB / yfinance";
  }
  if (source === "questdb_seeded_from_mock") {
    return "QuestDB / mock";
  }
  if (source === "next_mock_fallback") {
    return "Next.js mock fallback";
  }
  return source;
}

function engineLabel(engine?: string) {
  if (engine === "vectorbt") {
    return "vectorbt";
  }
  if (engine === "manual") {
    return "manual fallback";
  }
  return "market-api";
}

export function BacktestPage() {
  const [ticker, setTicker] = useState("AAPL");
  const [formError, setFormError] = useState<string | null>(null);
  const runBacktest = api.marketData.runBacktest.useMutation();
  const result = runBacktest.data as BacktestResult | undefined;

  const latestTrades = useMemo(() => result?.trades.slice(-8).reverse() ?? [], [result]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      setFormError("Ticker symbol is required");
      return;
    }

    setTicker(normalizedTicker);
    setFormError(null);
    runBacktest.mutate({
      ticker: normalizedTicker,
      timeframe: "1d",
      initialCash: DEFAULT_INITIAL_CASH,
      fastSma: DEFAULT_FAST_SMA,
      slowSma: DEFAULT_SLOW_SMA
    });
  }

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Dual-SMA</Badge>
          <Badge variant="outline">1d</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">Backtest</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-md border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_auto] md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="backtest-ticker">Ticker symbol</Label>
            <Input
              id="backtest-ticker"
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="AAPL"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={runBacktest.isPending} className="md:min-w-32">
            <Play className="h-4 w-4" />
            {runBacktest.isPending ? "Running" : "Run"}
          </Button>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <DefaultSetting label="Initial cash" value={money(DEFAULT_INITIAL_CASH)} />
          <DefaultSetting label="Fast SMA" value={String(DEFAULT_FAST_SMA)} />
          <DefaultSetting label="Slow SMA" value={String(DEFAULT_SLOW_SMA)} />
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        {runBacktest.error ? <p className="text-sm text-destructive">{runBacktest.error.message}</p> : null}
      </form>

      {runBacktest.isPending ? <div className="h-56 animate-pulse rounded-md border bg-muted" /> : null}

      {result ? (
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric icon={Wallet} label="Final equity" value={money(result.final_equity)} />
            <Metric
              icon={result.total_return >= 0 ? TrendingUp : TrendingDown}
              label="Total return"
              value={signedPercent(result.total_return)}
              tone={result.total_return >= 0 ? "positive" : "negative"}
            />
            <Metric icon={Gauge} label="Max drawdown" value={percent(result.max_drawdown)} tone="negative" />
            <Metric icon={Activity} label="Trades" value={String(result.trade_count)} />
            <Metric icon={CircleDollarSign} label="Win rate" value={result.win_rate === null ? "n/a" : percent(result.win_rate)} />
          </div>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-4 rounded-md border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{result.symbol}</h2>
                  <p className="text-sm text-muted-foreground">{result.strategy}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{engineLabel(result.engine)}</Badge>
                  <Badge variant="outline">{sourceLabel(result.source)}</Badge>
                </div>
              </div>
              <EquitySparkline points={result.equity_curve} />
            </div>

            <div className="rounded-md border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                <h2 className="text-base font-semibold">Recent trades</h2>
              </div>
              {latestTrades.length ? (
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Side</th>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-right font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestTrades.map((trade) => (
                        <tr key={`${trade.side}-${trade.time}-${trade.price}`} className="border-t">
                          <td className="px-3 py-2">
                            <span
                              className={
                                trade.side === "buy"
                                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                                  : "font-medium text-rose-600 dark:text-rose-400"
                              }
                            >
                              {trade.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{dateLabel(trade.time)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(trade.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No trades fired for this symbol and window.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function DefaultSetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: LucideIcon;
  label: string;
  tone?: "positive" | "negative";
  value: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  return (
    <div className="grid gap-2 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className={`truncate text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function EquitySparkline({ points }: { points: BacktestResult["equity_curve"] }) {
  if (points.length < 2) {
    return <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">No equity curve.</div>;
  }

  const width = 640;
  const height = 180;
  const padding = 12;
  const values = points.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.equity - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="grid gap-2">
      <div className="h-56 rounded-md border bg-background p-2">
        <svg aria-label="Equity curve" className="h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="img">
          <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" className="text-primary" />
        </svg>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {dateLabel(first.time)} · {money(first.equity)}
        </span>
        <span>
          {dateLabel(last.time)} · {money(last.equity)}
        </span>
        <span>
          Range {money(min)} to {money(max)}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">{compactNumber(points.length)} equity points</div>
    </div>
  );
}
