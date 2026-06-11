"use client";

import { BarChart3, CalendarDays, Database, Search, TrendingDown, TrendingUp } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SeasonalityResponse = {
  symbol: string;
  provider: string;
  lookback_years: "ALL";
  as_of_ts: string;
  months: SeasonalityMonth[];
};

type SeasonalityMonth = {
  month_num: number;
  month_code: string;
  monthly_daily_seasonality: {
    sample_years: number;
    sample_days: number;
    percent_up_days: number;
    percent_down_days: number;
    avg_return_pct: number | null;
    median_return_pct: number | null;
    stddev_return_pct: number | null;
  };
  trading_day_seasonality: Array<{
    trading_day_of_month: number;
    sample_observations: number;
    percent_up_days: number;
    percent_down_days: number;
    avg_return_pct: number | null;
  }>;
  monthly_outcome_seasonality: {
    sample_months: number;
    percent_positive_months: number;
    percent_negative_months: number;
    avg_month_return_pct: number | null;
    median_month_return_pct: number | null;
    stddev_month_return_pct: number | null;
  } | null;
};

const DEFAULT_TICKER = "AMD";

export function SeasonalityPage() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [submittedTicker, setSubmittedTicker] = useState(DEFAULT_TICKER);
  const [selectedMonthNum, setSelectedMonthNum] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const seasonality = api.marketData.getSeasonality.useQuery({
    ticker: submittedTicker,
    provider: "yfinance",
    lookbackYears: "ALL"
  });
  const result = seasonality.data as SeasonalityResponse | undefined;
  const selectedMonth = useMemo(() => {
    if (!result?.months.length) {
      return null;
    }

    return result.months.find((month) => month.month_num === selectedMonthNum) ?? result.months[0];
  }, [result, selectedMonthNum]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      setFormError("Ticker symbol is required");
      return;
    }

    setTicker(normalizedTicker);
    setSubmittedTicker(normalizedTicker);
    setSelectedMonthNum(1);
    setFormError(null);
  }

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">QuestDB</Badge>
          <Badge variant="outline">ALL</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">Seasonality</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-md border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_auto] md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="seasonality-ticker">Ticker symbol</Label>
            <Input
              id="seasonality-ticker"
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              placeholder={DEFAULT_TICKER}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={seasonality.isFetching} className="md:min-w-32">
            <Search className="h-4 w-4" />
            {seasonality.isFetching ? "Loading" : "Load"}
          </Button>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <DefaultSetting label="Provider" value="yfinance" />
          <DefaultSetting label="Lookback" value="ALL" />
          <DefaultSetting label="Data" value="Cache" />
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        {seasonality.error ? <p className="text-sm text-destructive">{seasonality.error.message}</p> : null}
      </form>

      {seasonality.isFetching ? <div className="h-64 animate-pulse rounded-md border bg-muted" /> : null}

      {result ? (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{result.symbol}</h2>
              <p className="text-sm text-muted-foreground">As of {dateLabel(result.as_of_ts)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{result.months.length} months</Badge>
              <Badge variant="outline">{result.provider}</Badge>
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.months.map((month) => (
              <MonthSummaryButton
                key={month.month_num}
                month={month}
                selected={selectedMonth?.month_num === month.month_num}
                onSelect={() => setSelectedMonthNum(month.month_num)}
              />
            ))}
          </section>

          {selectedMonth ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="rounded-md border bg-card p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <h2 className="text-base font-semibold">{selectedMonth.month_code} Trading Days</h2>
                  </div>
                  <Badge variant="outline">{selectedMonth.trading_day_seasonality.length} rows</Badge>
                </div>
                <TradingDayTable month={selectedMonth} />
              </div>

              <aside className="grid content-start gap-4">
                <MetricPanel month={selectedMonth} />
                <OutcomePanel month={selectedMonth} />
              </aside>
            </section>
          ) : null}
        </div>
      ) : null}

      {!seasonality.isFetching && !result && !seasonality.error ? (
        <div className="min-h-64 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Load a symbol to view seasonality.
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

function MonthSummaryButton({
  month,
  onSelect,
  selected
}: {
  month: SeasonalityMonth;
  onSelect: () => void;
  selected: boolean;
}) {
  const daily = month.monthly_daily_seasonality;
  const upTone = daily.percent_up_days >= daily.percent_down_days;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "grid min-h-40 gap-3 rounded-md border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/60",
        selected ? "border-primary ring-2 ring-ring" : null
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold">{month.month_code}</div>
        {upTone ? (
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Up days" value={formatPercent(daily.percent_up_days)} tone="positive" />
        <Stat label="Down days" value={formatPercent(daily.percent_down_days)} tone="negative" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Avg day</span>
        <span className={cn("font-medium tabular-nums", signedToneClass(daily.avg_return_pct))}>
          {formatPercent(daily.avg_return_pct, true)}
        </span>
      </div>
    </button>
  );
}

function TradingDayTable({ month }: { month: SeasonalityMonth }) {
  if (!month.trading_day_seasonality.length) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No trading-day rows are available.</div>;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Day</th>
            <th className="px-3 py-2 text-right font-medium">Up</th>
            <th className="px-3 py-2 text-right font-medium">Down</th>
            <th className="px-3 py-2 text-right font-medium">Avg</th>
            <th className="px-3 py-2 text-right font-medium">Sample</th>
          </tr>
        </thead>
        <tbody>
          {month.trading_day_seasonality.map((day) => (
            <tr key={`${month.month_code}-${day.trading_day_of_month}`} className="border-t">
              <td className="px-3 py-2 font-medium">{day.trading_day_of_month}</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatPercent(day.percent_up_days)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                {formatPercent(day.percent_down_days)}
              </td>
              <td className={cn("px-3 py-2 text-right tabular-nums", signedToneClass(day.avg_return_pct))}>
                {formatPercent(day.avg_return_pct, true)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {day.sample_observations.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricPanel({ month }: { month: SeasonalityMonth }) {
  const daily = month.monthly_daily_seasonality;

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        <h2 className="text-base font-semibold">Daily Summary</h2>
      </div>
      <div className="grid gap-2 text-sm">
        <Stat label="Sample days" value={daily.sample_days.toLocaleString()} />
        <Stat label="Sample years" value={daily.sample_years.toLocaleString()} />
        <Stat label="Median day" value={formatPercent(daily.median_return_pct, true)} tone={toneFromValue(daily.median_return_pct)} />
        <Stat label="Std dev" value={formatPercent(daily.stddev_return_pct)} />
      </div>
    </div>
  );
}

function OutcomePanel({ month }: { month: SeasonalityMonth }) {
  const outcome = month.monthly_outcome_seasonality;

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4" />
        <h2 className="text-base font-semibold">Monthly Outcome</h2>
      </div>
      {outcome ? (
        <div className="grid gap-2 text-sm">
          <Stat label="Positive months" value={formatPercent(outcome.percent_positive_months)} tone="positive" />
          <Stat label="Negative months" value={formatPercent(outcome.percent_negative_months)} tone="negative" />
          <Stat label="Avg month" value={formatPercent(outcome.avg_month_return_pct, true)} tone={toneFromValue(outcome.avg_month_return_pct)} />
          <Stat label="Sample months" value={outcome.sample_months.toLocaleString()} />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No completed monthly outcomes are available.</div>
      )}
    </div>
  );
}

function Stat({
  label,
  tone,
  value
}: {
  label: string;
  tone?: "positive" | "negative";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : null,
          tone === "negative" ? "text-rose-600 dark:text-rose-400" : null
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatPercent(value: number | null | undefined, signed = false) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function toneFromValue(value: number | null | undefined): "positive" | "negative" | undefined {
  if (value === null || value === undefined || value === 0) {
    return undefined;
  }
  return value > 0 ? "positive" : "negative";
}

function signedToneClass(value: number | null | undefined) {
  const tone = toneFromValue(value);
  if (tone === "positive") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (tone === "negative") {
    return "text-rose-600 dark:text-rose-400";
  }
  return "";
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
