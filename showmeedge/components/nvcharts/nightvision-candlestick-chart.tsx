"use client";

import { useEffect, useId, useMemo, useState } from "react";

import type { CandleData, NightVisionData, SplineData } from "night-vision";

import type { OhlcvBar } from "@/lib/mock-ohlcv";

function dateToUtcMs(date: string) {
  return Date.parse(date.includes("T") ? date : `${date}T00:00:00.000Z`);
}

function toCandles(bars: OhlcvBar[]): CandleData[] {
  return bars.map((bar) => [dateToUtcMs(bar.time), bar.open, bar.high, bar.low, bar.close, bar.volume]);
}

function simpleMovingAverage(bars: OhlcvBar[], period: number): SplineData[] {
  return bars
    .map((bar, index) => {
      if (index < period - 1) return null;

      const window = bars.slice(index - period + 1, index + 1);
      const average = window.reduce((sum, item) => sum + item.close, 0) / period;

      return [dateToUtcMs(bar.time), Number(average.toFixed(2))] as SplineData;
    })
    .filter((value): value is SplineData => Boolean(value));
}

function buildNightVisionData(bars: OhlcvBar[], ticker: string): NightVisionData {
  return {
    indexBased: true,
    panes: [
      {
        overlays: [
          {
            name: `${ticker} Daily`,
            type: "Candles",
            main: true,
            data: toCandles(bars),
            settings: {
              precision: 2
            },
            props: {
              currencySymbol: "$",
              showAvgVolume: true,
              showVolume: true
            }
          },
          {
            name: "SMA 10",
            type: "Spline",
            data: simpleMovingAverage(bars, 10),
            settings: {
              precision: 2,
              zIndex: 4
            },
            props: {
              color: "#f8c537"
            }
          },
          {
            name: "SMA 20",
            type: "Spline",
            data: simpleMovingAverage(bars, 20),
            settings: {
              precision: 2,
              zIndex: 3
            },
            props: {
              color: "#b4d887"
            }
          },
          {
            name: "SMA 50",
            type: "Spline",
            data: simpleMovingAverage(bars, 50),
            settings: {
              precision: 2,
              zIndex: 3
            },
            props: {
              color: "#0c6732"
            }
          }
        ]
      }
    ]
  };
}

export function NightVisionCandlestickChart({ bars, ticker }: { bars: OhlcvBar[]; ticker: string }) {
  const reactId = useId();
  const chartId = useMemo(() => `nightvision-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const data = useMemo(() => buildNightVisionData(bars, ticker), [bars, ticker]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!bars.length) {
      setIsReady(false);
      return;
    }

    let chart: { destroy: () => void } | null = null;
    let isMounted = true;

    import("night-vision")
      .then(({ NightVision }) => {
        if (!isMounted) return;

        chart = new NightVision(chartId, {
          id: `${chartId}-instance`,
          autoResize: true,
          height: 820,
          indexBased: true,
          showLogo: false,
          colors: {
            back: "#080d10",
            grid: "#20303a88",
            text: "#a8bec7",
            textHL: "#f7fbff",
            textLG: "#d6e6ec",
            candleUp: "#22c55e",
            candleDw: "#fb7185",
            wickUp: "#86efacaa",
            wickDw: "#fda4afaa",
            volUp: "#22c55e52",
            volDw: "#fb718552",
            cross: "#f8c537",
            panel: "#132028"
          },
          data
        });

        setError(null);
        setIsReady(true);
      })
      .catch((loadError: Error) => {
        if (!isMounted) return;
        setError(loadError.message);
        setIsReady(false);
      });

    return () => {
      isMounted = false;
      chart?.destroy();
    };
  }, [bars.length, chartId, data]);

  if (error) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border bg-muted/20 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!bars.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No bars available for {ticker}.
      </div>
    );
  }

  return (
    /*  SR-fix: in nightvision-chandlestick-chart.tsx ---> relative h-140 , it was h-80    */

    <div className="relative h-140 min-w-0 max-w-full overflow-hidden rounded-md border bg-[#080d10]">
      {!isReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080d10] text-sm text-slate-300">
          Loading Night Vision chart...
        </div>
      ) : null}
      <div id={chartId} className="h-140 min-w-0 max-w-full overflow-hidden" aria-label={`${ticker} Night Vision candlestick chart`} />
    </div>
  );
}
