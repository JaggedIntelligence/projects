"use client";

import { useEffect, useRef, useState } from "react";

import type { OhlcvBar } from "@/lib/mock-ohlcv";

type SeriesApi = {
  setData: (data: unknown[]) => void;
};

type ChartApi = {
  addSeries?: (seriesType: unknown, options?: Record<string, unknown>) => SeriesApi;
  addCandlestickSeries?: (options?: Record<string, unknown>) => SeriesApi;
  addHistogramSeries?: (options?: Record<string, unknown>) => SeriesApi;
  applyOptions: (options: Record<string, unknown>) => void;
  timeScale: () => {
    fitContent: () => void;
  };
  remove: () => void;
};

type LightweightChartsApi = {
  createChart: (container: HTMLElement, options?: Record<string, unknown>) => ChartApi;
  CandlestickSeries?: unknown;
  HistogramSeries?: unknown;
};

declare global {
  interface Window {
    LightweightCharts?: LightweightChartsApi;
  }
}

const SCRIPT_ID = "tradingview-lightweight-charts";
const SCRIPT_SRC = "https://unpkg.com/lightweight-charts@5/dist/lightweight-charts.standalone.production.js";

let loadPromise: Promise<LightweightChartsApi> | null = null;

function loadLightweightCharts() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Lightweight Charts can only load in the browser."));
  }

  if (window.LightweightCharts) {
    return Promise.resolve(window.LightweightCharts);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.LightweightCharts) {
        resolve(window.LightweightCharts);
      } else {
        reject(new Error("Lightweight Charts loaded without exposing window.LightweightCharts."));
      }
    };
    script.onerror = () => reject(new Error("Could not load TradingView Lightweight Charts."));

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  return loadPromise;
}

export function LightweightCandlestickChart({ bars, ticker }: { bars: OhlcvBar[]; ticker: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;

    let chart: ChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let isMounted = true;

    loadLightweightCharts()
      .then((library) => {
        if (!isMounted || !containerRef.current) return;

        const container = containerRef.current;
        chart = library.createChart(container, {
          autoSize: true,
          height: 360,
          layout: {
            background: { color: "transparent" },
            textColor: "rgba(113, 113, 122, 1)"
          },
          grid: {
            vertLines: { color: "rgba(148, 163, 184, 0.14)" },
            horzLines: { color: "rgba(148, 163, 184, 0.14)" }
          },
          rightPriceScale: {
            borderColor: "rgba(148, 163, 184, 0.2)"
          },
          timeScale: {
            borderColor: "rgba(148, 163, 184, 0.2)",
            timeVisible: false
          },
          crosshair: {
            mode: 1
          }
        });

        const candleSeries =
          chart.addSeries && library.CandlestickSeries
            ? chart.addSeries(library.CandlestickSeries, {
                upColor: "#16a34a",
                downColor: "#dc2626",
                borderVisible: false,
                wickUpColor: "#16a34a",
                wickDownColor: "#dc2626"
              })
            : chart.addCandlestickSeries?.({
                upColor: "#16a34a",
                downColor: "#dc2626",
                borderVisible: false,
                wickUpColor: "#16a34a",
                wickDownColor: "#dc2626"
              });

        const volumeSeries =
          chart.addSeries && library.HistogramSeries
            ? chart.addSeries(library.HistogramSeries, {
                priceFormat: { type: "volume" },
                priceScaleId: "",
                color: "rgba(14, 165, 233, 0.35)"
              })
            : chart.addHistogramSeries?.({
                priceFormat: { type: "volume" },
                priceScaleId: "",
                color: "rgba(14, 165, 233, 0.35)"
              });

        candleSeries?.setData(
          bars.map((bar) => ({
            time: bar.time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close
          }))
        );

        volumeSeries?.setData(
          bars.map((bar) => ({
            time: bar.time,
            value: bar.volume,
            color: bar.close >= bar.open ? "rgba(22, 163, 74, 0.28)" : "rgba(220, 38, 38, 0.28)"
          }))
        );

        chart.applyOptions({
          localization: {
            priceFormatter: (price: number) => `$${price.toFixed(2)}`
          }
        });

        chart.timeScale().fitContent();

        resizeObserver = new ResizeObserver(() => {
          chart?.applyOptions({ autoSize: true });
          chart?.timeScale().fitContent();
        });
        resizeObserver.observe(container);
        setError(null);
      })
      .catch((loadError: Error) => {
        if (isMounted) setError(loadError.message);
      });

    return () => {
      isMounted = false;
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [bars, ticker]);

  if (error) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border bg-muted/20 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-md border bg-background" aria-label={`${ticker} candlestick chart`} />;
}

