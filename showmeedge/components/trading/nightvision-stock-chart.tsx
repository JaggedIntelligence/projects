"use client";

import { useEffect, useId, useMemo, useState } from "react";

import type { CandleData, NightVisionData } from "night-vision";

export type NightVisionBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function dateToUtcMs(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function toCandles(bars: NightVisionBar[]): CandleData[] {
  return bars.map((bar) => [dateToUtcMs(bar.date), bar.open, bar.high, bar.low, bar.close, bar.volume]);
}

function simpleMovingAverage(bars: NightVisionBar[], period: number) {
  return bars
    .map((bar, index) => {
      if (index < period - 1) return null;

      const window = bars.slice(index - period + 1, index + 1);
      const average = window.reduce((sum, item) => sum + item.close, 0) / period;

      return [dateToUtcMs(bar.date), Number(average.toFixed(2))] as [number, number];
    })
    .filter((value): value is [number, number] => Boolean(value));
}

function buildNightVisionData(bars: NightVisionBar[]): NightVisionData {
  return {
    indexBased: true,
    panes: [
      {
        settings: {
          height: 460
        },
        overlays: [
          {
            name: "AAPL Daily",
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
              color: "#5cc8ff"
            }
          }
        ]
      }
    ]
  };
}

export function NightVisionStockChart({ bars }: { bars: NightVisionBar[] }) {
  const reactId = useId();
  const chartId = useMemo(() => `nightvision-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const data = useMemo(() => buildNightVisionData(bars), [bars]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let chart: { destroy: () => void } | null = null;
    let isMounted = true;

    import("night-vision")
      .then(({ NightVision }) => {
        if (!isMounted) return;

        chart = new NightVision(chartId, {
          id: `${chartId}-instance`,
          autoResize: true,
          height: 520,
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
  }, [chartId, data]);

  if (error) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-md border border-rose-400/30 bg-rose-950/20 p-6 text-center text-sm text-rose-100">
        {error}
      </div>
    );
  }

  return (
    <div className="relative min-h-[420px] min-w-0 max-w-full overflow-hidden rounded-md border border-slate-700/80 bg-[#080d10] md:min-h-[540px]">
      {!isReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080d10] text-sm text-slate-300">
          Loading Night Vision chart...
        </div>
      ) : null}
      <div id={chartId} className="h-[420px] min-w-0 max-w-full overflow-hidden md:h-[540px]" aria-label="AAPL sample Night Vision candlestick chart" />
    </div>
  );
}
