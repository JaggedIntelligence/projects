import type { Metadata } from "next";
import { ExternalLink, LineChart, TrendingUp } from "lucide-react";

import { NightVisionStockChart, type NightVisionBar } from "@/components/trading/nightvision-stock-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Night Vision Stock Chart",
  description: "Standalone Night Vision chart demo with fixed stock data."
};

const sampleRows: Array<[date: string, open: number, high: number, low: number, close: number, volume: number]> = [
  ["2025-09-02", 226.4, 229.3, 224.95, 226.05, 50500000],
  ["2025-09-03", 227.11, 230.42, 225.78, 227.55, 58378759],
  ["2025-09-04", 227.63, 231.51, 226.08, 228.75, 65550487],
  ["2025-09-05", 227.94, 232.11, 226.17, 229.51, 71372582],
  ["2025-09-08", 228.02, 232.16, 226.06, 229.77, 75325431],
  ["2025-09-09", 227.9, 231.64, 225.77, 229.52, 77059758],
  ["2025-09-10", 227.61, 230.63, 225.33, 228.81, 76428455],
  ["2025-09-11", 227.18, 229.23, 224.79, 227.74, 73499985],
  ["2025-09-12", 226.66, 227.91, 223.99, 226.45, 68552146],
  ["2025-09-15", 226.1, 227.69, 222.6, 225.09, 62046755],
  ["2025-09-16", 225.54, 227.45, 221.34, 223.83, 54587561],
  ["2025-09-17", 225.01, 227.21, 220.35, 222.8, 56774767],
  ["2025-09-18", 224.54, 226.99, 219.72, 222.1, 64285583],
  ["2025-09-19", 224.14, 226.79, 219.51, 221.77, 70671385],
  ["2025-09-22", 223.81, 226.62, 219.71, 221.82, 75361191],
  ["2025-09-23", 223.57, 226.45, 220.25, 222.19, 77938568],
  ["2025-09-24", 223.39, 226.29, 221.03, 222.77, 78179584],
  ["2025-09-25", 223.28, 226.3, 221.75, 223.46, 76073211],
  ["2025-09-26", 223.22, 226.84, 221.92, 224.12, 71822332],
  ["2025-09-29", 219.05, 223.04, 217.92, 220.49, 65825250],
  ["2025-09-30", 219.43, 223.46, 218.06, 221.15, 58639395],
  ["2025-10-01", 219.86, 223.59, 218.27, 221.55, 55109472],
  ["2025-10-02", 220.34, 223.44, 218.54, 221.71, 62867932],
  ["2025-10-03", 220.88, 223.07, 218.89, 221.68, 69739917],
  ["2025-10-06", 221.5, 222.91, 219.34, 221.56, 75110139],
  ["2025-10-07", 222.2, 223.88, 219.15, 221.45, 78500163],
  ["2025-10-08", 222.97, 224.97, 219.08, 221.48, 79612001],
  ["2025-10-09", 223.81, 226.09, 219.28, 221.74, 78355271],
  ["2025-10-10", 225.71, 228.23, 220.81, 223.31, 74855429],
  ["2025-10-13", 226.27, 228.98, 221.36, 223.85, 69442341],
  ["2025-10-14", 226.83, 229.66, 222.24, 224.68, 62620218],
  ["2025-10-15", 227.32, 230.22, 223.35, 225.71, 55021676],
  ["2025-10-16", 228.23, 231.12, 225.11, 227.35, 61329921],
  ["2025-10-17", 229, 231.81, 226.82, 228.91, 68604549],
  ["2025-10-20", 229.58, 232.93, 227.67, 230.26, 74590229],
  ["2025-10-21", 229.95, 233.72, 228.24, 231.24, 78752440],
  ["2025-10-22", 230.1, 234, 228.61, 231.76, 80722829],
  ["2025-10-23", 230.04, 233.72, 228.78, 231.78, 80332775],
  ["2025-10-24", 229.79, 232.93, 228.62, 231.31, 77628758],
  ["2025-10-27", 229.41, 231.72, 228.01, 230.42, 72868123],
  ["2025-10-28", 228.95, 230.71, 227.32, 229.26, 66495624],
  ["2025-10-29", 228.48, 230.26, 226.17, 228.01, 59102904],
  ["2025-10-30", 228.1, 230.18, 224.82, 226.84, 59705427],
  ["2025-10-31", 227.86, 230.22, 223.78, 225.96, 67294176],
  ["2025-11-03", 227.85, 230.43, 223.22, 225.53, 73822740],
  ["2025-11-04", 228.12, 230.87, 223.26, 225.67, 78707126],
  ["2025-11-05", 228.7, 231.55, 223.95, 226.42, 81513171],
  ["2025-11-06", 229.59, 232.49, 225.27, 227.77, 81996105],
  ["2025-11-07", 230.78, 233.66, 227.15, 229.64, 80122853],
  ["2025-11-10", 232.23, 235.01, 229.44, 231.87, 76075056],
  ["2025-11-11", 233.86, 236.92, 231.52, 234.29, 70232511],
  ["2025-11-12", 235.6, 239.12, 233.38, 236.7, 63138566],
  ["2025-11-13", 237.34, 241.06, 235.28, 238.91, 58029396],
  ["2025-11-14", 238.99, 242.59, 237.11, 240.74, 65839859]
];

const sampleBars: NightVisionBar[] = sampleRows.map(([date, open, high, low, close, volume]) => ({
  date,
  open,
  high,
  low,
  close,
  volume
}));

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function formatVolume(value: number) {
  return Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(value);
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "up" | "down" }) {
  const toneClass =
    tone === "up"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "down"
        ? "text-rose-600 dark:text-rose-300"
        : "text-foreground";

  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function NightVisionPage() {
  const latest = sampleBars.at(-1) ?? sampleBars[0];
  const previous = sampleBars.at(-2) ?? latest;
  const first = sampleBars[0];
  const change = latest.close - previous.close;
  const changePercent = (change / previous.close) * 100;
  const rangeChange = latest.close - first.open;
  const rangeChangePercent = (rangeChange / first.open) * 100;
  const averageVolume = sampleBars.reduce((sum, bar) => sum + bar.volume, 0) / sampleBars.length;

  return (
    <main className="container grid min-w-0 gap-6 overflow-hidden py-6">
      <section className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">AAPL</Badge>
            <Badge variant="outline">Daily OHLCV</Badge>
            <Badge variant="outline">Fixed sample data</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Night Vision Stock Chart</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A standalone Night Vision canvas chart with hard-coded stock candles, volume, and SMA overlays.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit self-start">
          <a href="https://nightvision.dev/guide/intro/10-basic-examples.html" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Docs
          </a>
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Last close" value={`$${formatMoney(latest.close)}`} />
        <Stat
          label="1 day"
          value={`${change >= 0 ? "+" : ""}$${formatMoney(change)} (${changePercent.toFixed(2)}%)`}
          tone={change >= 0 ? "up" : "down"}
        />
        <Stat
          label="Sample range"
          value={`${rangeChange >= 0 ? "+" : ""}${rangeChangePercent.toFixed(2)}%`}
          tone={rangeChange >= 0 ? "up" : "down"}
        />
        <Stat label="Avg volume" value={formatVolume(averageVolume)} />
      </section>

      <Card className="min-w-0">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Night Vision
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            {sampleBars.length} trading sessions
          </div>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          <NightVisionStockChart bars={sampleBars} />
        </CardContent>
      </Card>
    </main>
  );
}
