"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { CandleData, NightVision, NightVisionData, SplineData } from "night-vision";

import type { OhlcvBar } from "@/lib/mock-ohlcv";

export type ChartRectangle = {
  startTime: string;
  endTime: string;
  topPrice: number;
  bottomPrice: number;
};

export type ChartRectangleArea = ChartRectangle & {
  id: string;
};

type RectangleData = [timeMs: number, topPrice: number, bottomPrice: number];

const EMPTY_RECTANGLE_AREAS: ChartRectangleArea[] = [];

const RECTANGLE_AREA_SCRIPT = `
// Navy ~ 0.2-lite

[OVERLAY name=RectangleArea, ctx=Canvas, version=1.0.0]

prop('fillColor', { type: 'color', def: '#38bdf833' })
prop('borderColor', { type: 'color', def: '#38bdf8cc' })
prop('lineWidth', { type: 'number', def: 1 })

draw(ctx) {
    const data = $core.data
    if (!data.length) return

    const layout = $core.layout
    const first = data[0]
    const lastIndex = data.length - 1
    const last = data[lastIndex]
    const halfStep = Math.max(layout.pxStep * 0.5, 0.5)
    const left = layout.ti2x(first[0], 0) - halfStep
    const right = layout.ti2x(last[0], lastIndex) + halfStep
    const firstPriceY = layout.value2y(first[1])
    const secondPriceY = layout.value2y(first[2])
    const top = Math.min(firstPriceY, secondPriceY)
    const bottom = Math.max(firstPriceY, secondPriceY)

    ctx.save()
    ctx.fillStyle = $props.fillColor
    ctx.fillRect(left, top, right - left, bottom - top)
    ctx.strokeStyle = $props.borderColor
    ctx.lineWidth = $props.lineWidth
    ctx.strokeRect(left, top, right - left, bottom - top)
    ctx.restore()
}

yRange() => null
legend() => null
`;

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

function rectangleData(bars: OhlcvBar[], rectangle: ChartRectangle | null): RectangleData[] {
  if (!rectangle) return [];

  const startTime = dateToUtcMs(rectangle.startTime);
  const endTime = dateToUtcMs(rectangle.endTime);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return [];

  return bars
    .filter((bar) => {
      const time = dateToUtcMs(bar.time);
      return time >= startTime && time <= endTime;
    })
    .map((bar) => [dateToUtcMs(bar.time), rectangle.topPrice, rectangle.bottomPrice]);
}

function buildNightVisionData(
  bars: OhlcvBar[],
  ticker: string,
  areas: ChartRectangleArea[],
  selectedAreaId: string | null
): NightVisionData {
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
          },
          ...areas.flatMap((area) => {
            const boxData = rectangleData(bars, area);
            if (!boxData.length) return [];

            const isSelected = area.id === selectedAreaId;

            return [
              {
                name: `Price Area ${area.id}`,
                type: "RectangleArea",
                data: boxData,
                settings: {
                  precision: 2,
                  zIndex: -1
                },
                props: {
                  fillColor: isSelected ? "#f8c5372e" : "#38bdf833",
                  borderColor: isSelected ? "#f8c537" : "#38bdf8cc",
                  lineWidth: isSelected ? 2 : 1
                }
              }
            ];
          })
        ]
      }
    ]
  };
}

export function NightVisionCandlestickChart({
  bars,
  ticker,
  areas = EMPTY_RECTANGLE_AREAS,
  selectedAreaId = null
}: {
  bars: OhlcvBar[];
  ticker: string;
  areas?: ChartRectangleArea[];
  selectedAreaId?: string | null;
}) {
  const reactId = useId();
  const chartId = useMemo(() => `nightvision-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const data = useMemo(() => buildNightVisionData(bars, ticker, areas, selectedAreaId), [areas, bars, selectedAreaId, ticker]);
  const dataRef = useRef(data);
  const chartRef = useRef<NightVision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const hasBars = bars.length > 0;

  useEffect(() => {
    dataRef.current = data;

    if (chartRef.current) {
      chartRef.current.data = data;
    }
  }, [data]);

  useEffect(() => {
    if (!hasBars) {
      setIsReady(false);
      return;
    }

    let isMounted = true;

    import("night-vision")
      .then(({ NightVision }) => {
        if (!isMounted) return;

        chartRef.current = new NightVision(chartId, {
          id: `${chartId}-instance`,
          autoResize: true,
          height: 820,
          indexBased: true,
          showLogo: false,
          scripts: [RECTANGLE_AREA_SCRIPT],
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
          data: dataRef.current
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
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartId, hasBars]);

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
