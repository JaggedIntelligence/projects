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

type RectangleDrawEvent = {
  startTime: number;
  endTime: number;
  topPrice: number;
  bottomPrice: number;
};

const EMPTY_RECTANGLE_AREAS: ChartRectangleArea[] = [];

const RECTANGLE_AREA_SCRIPT = `
// Navy ~ 0.2-lite

[OVERLAY name=RectangleArea, ctx=Canvas, version=1.0.0]

prop('fillColor', { type: 'color', def: '#38bdf833' })
prop('borderColor', { type: 'color', def: '#38bdf8cc' })
prop('lineWidth', { type: 'number', def: 1 })
prop('dashed', { type: 'boolean', def: false })

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
    if ($props.dashed) ctx.setLineDash([6, 4])
    ctx.strokeRect(left, top, right - left, bottom - top)
    ctx.restore()
}

yRange() => null
legend() => null
`;

const RECTANGLE_DRAW_TOOL_SCRIPT = `
// Navy ~ 0.2-lite

[OVERLAY name=RectangleDrawTool, ctx=Canvas, version=1.0.0]

prop('enabled', { type: 'boolean', def: false })
prop('fillColor', { type: 'color', def: '#f8c5372e' })
prop('borderColor', { type: 'color', def: '#f8c537' })

let state = 'idle'
let anchor = null
let current = null

pointAt(event) {
    const layout = $core.layout
    const data = $core.hub.mainOv.data
    if (!layout || !data.length) return null

    const x = Math.max(0, Math.min(event.layerX, layout.width))
    const y = Math.max(0, Math.min(event.layerY, layout.height))
    let time

    if (layout.indexBased) {
        const index = Math.max(0, Math.min(data.length - 1, Math.round(layout.x2ti(x))))
        time = data[index] ? data[index][0] : null
    } else {
        time = layout.x2time(x)
    }

    const price = layout.y2value(y)
    if (!Number.isFinite(time) || !Number.isFinite(price)) return null

    return { x, y, time, price }
}

reset() {
    state = 'idle'
    anchor = null
    current = null
    $events.emit('scroll-lock', false)
}

redraw() {
    $events.emitSpec('chart', 'update-layout')
}

draw(ctx) {
    if (!$props.enabled) {
        if (state !== 'idle') reset()
        return
    }

    if (state !== 'dragging' || !anchor || !current) return

    const left = Math.min(anchor.x, current.x)
    const right = Math.max(anchor.x, current.x)
    const top = Math.min(anchor.y, current.y)
    const bottom = Math.max(anchor.y, current.y)

    ctx.save()
    ctx.fillStyle = $props.fillColor
    ctx.fillRect(left, top, right - left, bottom - top)
    ctx.strokeStyle = $props.borderColor
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(left, top, right - left, bottom - top)
    ctx.restore()
}

mousedown(event) {
    if (!$props.enabled) return

    const point = pointAt(event)
    if (!point) return

    event.preventDefault()
    $events.emit('scroll-lock', true)
    anchor = point
    current = point
    state = 'dragging'
    redraw()
}

mousemove(event) {
    if (!$props.enabled || state !== 'dragging') return

    const point = pointAt(event)
    if (!point) return

    event.preventDefault()
    current = point
    redraw()
}

mouseup(event) {
    if (!$props.enabled || state !== 'dragging' || !anchor) return

    event.preventDefault()
    const endPoint = pointAt(event) || current
    const width = endPoint ? Math.abs(endPoint.x - anchor.x) : 0
    const height = endPoint ? Math.abs(endPoint.y - anchor.y) : 0

    if (!endPoint || width < 4 || height < 4) {
        reset()
        $events.emit('rectangle-draw-error', {
            message: 'Drag across a visible time and price range.'
        })
        redraw()
        return
    }

    const topPrice = Math.round(Math.max(anchor.price, endPoint.price) * 100) / 100
    const bottomPrice = Math.round(Math.min(anchor.price, endPoint.price) * 100) / 100

    if (topPrice <= 0 || bottomPrice <= 0 || topPrice <= bottomPrice) {
        reset()
        $events.emit('rectangle-draw-error', {
            message: 'Draw an area with a positive price range.'
        })
        redraw()
        return
    }

    const rectangle = {
        startTime: Math.min(anchor.time, endPoint.time),
        endTime: Math.max(anchor.time, endPoint.time),
        topPrice,
        bottomPrice
    }

    reset()
    $events.emit('rectangle-drawn', rectangle)
    redraw()
}

mouseout() {
    if (!$props.enabled || state !== 'dragging') return

    reset()
    $events.emit('rectangle-draw-cancelled', {})
    redraw()
}

keydown(event) {
    if (!$props.enabled || event.key !== 'Escape') return

    event.preventDefault()
    reset()
    $events.emit('rectangle-draw-cancelled', {})
    redraw()
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

function normalizeDrawnRectangle(event: RectangleDrawEvent): ChartRectangle | null {
  const { startTime, endTime, topPrice, bottomPrice } = event;

  if (![startTime, endTime, topPrice, bottomPrice].every(Number.isFinite)) return null;
  if (startTime > endTime || topPrice <= bottomPrice || bottomPrice <= 0) return null;

  return {
    startTime: new Date(startTime).toISOString().slice(0, 10),
    endTime: new Date(endTime).toISOString().slice(0, 10),
    topPrice,
    bottomPrice
  };
}

function buildNightVisionData(
  bars: OhlcvBar[],
  ticker: string,
  areas: ChartRectangleArea[],
  selectedAreaId: string | null,
  draftArea: ChartRectangle | null,
  drawingEnabled: boolean
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
                  lineWidth: isSelected ? 2 : 1,
                  dashed: false
                }
              }
            ];
          }),
          ...(draftArea && rectangleData(bars, draftArea).length
            ? [
                {
                  name: "Rectangle draft",
                  type: "RectangleArea",
                  data: rectangleData(bars, draftArea),
                  settings: {
                    precision: 2,
                    zIndex: 8
                  },
                  props: {
                    fillColor: "#f8c5372e",
                    borderColor: "#f8c537",
                    lineWidth: 2,
                    dashed: true
                  }
                }
              ]
            : []),
          {
            name: "Rectangle drawing tool",
            type: "RectangleDrawTool",
            data: bars.map((bar) => [dateToUtcMs(bar.time)]),
            settings: {
              precision: 2,
              zIndex: 20
            },
            props: {
              enabled: drawingEnabled,
              fillColor: "#f8c5372e",
              borderColor: "#f8c537"
            }
          }
        ]
      }
    ]
  };
}

export function NightVisionCandlestickChart({
  bars,
  ticker,
  areas = EMPTY_RECTANGLE_AREAS,
  selectedAreaId = null,
  draftArea = null,
  drawingEnabled = false,
  onRectangleDrawn,
  onRectangleDrawingCancelled,
  onRectangleDrawingError
}: {
  bars: OhlcvBar[];
  ticker: string;
  areas?: ChartRectangleArea[];
  selectedAreaId?: string | null;
  draftArea?: ChartRectangle | null;
  drawingEnabled?: boolean;
  onRectangleDrawn?: (rectangle: ChartRectangle) => void;
  onRectangleDrawingCancelled?: () => void;
  onRectangleDrawingError?: (message: string) => void;
}) {
  const reactId = useId();
  const chartId = useMemo(() => `nightvision-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const data = useMemo(
    () => buildNightVisionData(bars, ticker, areas, selectedAreaId, draftArea, drawingEnabled),
    [areas, bars, draftArea, drawingEnabled, selectedAreaId, ticker]
  );
  const dataRef = useRef(data);
  const chartRef = useRef<NightVision | null>(null);
  const onRectangleDrawnRef = useRef(onRectangleDrawn);
  const onRectangleDrawingCancelledRef = useRef(onRectangleDrawingCancelled);
  const onRectangleDrawingErrorRef = useRef(onRectangleDrawingError);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const hasBars = bars.length > 0;

  onRectangleDrawnRef.current = onRectangleDrawn;
  onRectangleDrawingCancelledRef.current = onRectangleDrawingCancelled;
  onRectangleDrawingErrorRef.current = onRectangleDrawingError;

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

        const chart = new NightVision(chartId, {
          id: `${chartId}-instance`,
          autoResize: true,
          height: 820,
          indexBased: true,
          showLogo: false,
          scripts: [RECTANGLE_AREA_SCRIPT, RECTANGLE_DRAW_TOOL_SCRIPT],
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

        chart.events.on(`${chartId}-rectangle-drawn:rectangle-drawn`, (drawEvent: RectangleDrawEvent) => {
          const rectangle = normalizeDrawnRectangle(drawEvent);

          if (rectangle) {
            onRectangleDrawnRef.current?.(rectangle);
          } else {
            onRectangleDrawingErrorRef.current?.("The drawn rectangle could not be converted into a valid area.");
          }
        });
        chart.events.on(`${chartId}-rectangle-cancelled:rectangle-draw-cancelled`, () => {
          onRectangleDrawingCancelledRef.current?.();
        });
        chart.events.on(`${chartId}-rectangle-error:rectangle-draw-error`, (drawError: { message?: string }) => {
          onRectangleDrawingErrorRef.current?.(drawError.message ?? "Draw across a visible time and price range.");
        });
        chartRef.current = chart;

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
      const chart = chartRef.current;
      chart?.events.off(`${chartId}-rectangle-drawn`, "rectangle-drawn");
      chart?.events.off(`${chartId}-rectangle-cancelled`, "rectangle-draw-cancelled");
      chart?.events.off(`${chartId}-rectangle-error`, "rectangle-draw-error");
      chart?.destroy();
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

    <div
      className={`relative h-140 min-w-0 max-w-full overflow-hidden rounded-md border bg-[#080d10] ${drawingEnabled ? "cursor-crosshair" : ""}`}
    >
      {!isReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080d10] text-sm text-slate-300">
          Loading Night Vision chart...
        </div>
      ) : null}
      <div id={chartId} className="h-140 min-w-0 max-w-full overflow-hidden" aria-label={`${ticker} Night Vision candlestick chart`} />
    </div>
  );
}
