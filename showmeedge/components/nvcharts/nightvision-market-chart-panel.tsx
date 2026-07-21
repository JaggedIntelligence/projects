"use client";

import { Activity, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { NightVisionCandlestickChart, type ChartRectangle } from "@/components/nvcharts/nightvision-candlestick-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHART_AREA_COLORS,
  CHART_AREA_COLOR_KEYS,
  DEFAULT_CHART_AREA_COLOR_KEY,
  type ChartAreaColorKey
} from "@/lib/chart-area-colors";

type ChartSymbol = {
  id: string;
  ticker: string;
  name: string;
};

type TrackedTrade = {
  buyPrice: number;
  entryDate: string;
  entryIndex: number;
};

type TrackedTradeRow = {
  close: number;
  date: string;
  maxDrawdownPercent: number;
  profitLossPercent: number;
  time: string;
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

function formatBuyPrice(value: number) {
  return value.toFixed(2);
}

function formatBarDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return value;

  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(date).toUpperCase();
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" }).format(date);

  return `${weekday} ${month} ${day}`;
}

function formatSignedPercent(value: number) {
  if (value > 0) return `+${value.toFixed(1)}%`;
  if (value < 0) return `${value.toFixed(1)}%`;
  return "0.0%";
}

function formatDrawdownPercent(value: number) {
  return value > 0 ? `-${value.toFixed(1)}%` : "0.0%";
}

function dateToUtcMs(date: string) {
  return Date.parse(date.includes("T") ? date : `${date}T00:00:00.000Z`);
}

// ------***. SR removed lots of stuff inside Chart panel.  above Chart ---------------------

export function NightVisionMarketChartPanel({ symbols }: { symbols: ChartSymbol[] }) {
  const utils = api.useUtils();
  const chartSymbols = useMemo(() => (symbols.length ? symbols : fallbackSymbols), [symbols]);
  const [ticker, setTicker] = useState(chartSymbols[0]?.ticker ?? "AAPL");
  const [daysBackInput, setDaysBackInput] = useState("5");
  const [hiddenTailDays, setHiddenTailDays] = useState(0);
  const [buyPriceInput, setBuyPriceInput] = useState("");
  const [trackedTrade, setTrackedTrade] = useState<TrackedTrade | null>(null);
  const [draftArea, setDraftArea] = useState<ChartRectangle | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [rectangleError, setRectangleError] = useState<string | null>(null);
  const [drawingColorKey, setDrawingColorKey] = useState<ChartAreaColorKey | null>(null);
  const isDrawingArea = drawingColorKey !== null;
  const isReviewingDrawnArea = draftArea !== null;

  useEffect(() => {
    if (!chartSymbols.some((symbol) => symbol.ticker === ticker)) {
      setTicker(chartSymbols[0]?.ticker ?? "AAPL");
    }
  }, [chartSymbols, ticker]);

  const barsQuery = api.marketData.bars.useQuery({ ticker, timeframe: "1d" });
  const chartAreasQuery = api.chartAreas.list.useQuery({ ticker, timeframe: "1d" });
  const createArea = api.chartAreas.create.useMutation({
    onSuccess: async (area, input) => {
      setSelectedAreaId(area.id);
      setDraftArea(null);
      setRectangleError(null);
      setDrawingColorKey(null);
      await utils.chartAreas.list.invalidate({ ticker: input.ticker, timeframe: input.timeframe });
    }
  });
  const deleteArea = api.chartAreas.delete.useMutation({
    onSuccess: async (_, input) => {
      setSelectedAreaId((currentAreaId) => (currentAreaId === input.id ? null : currentAreaId));
      setRectangleError(null);
      await utils.chartAreas.list.invalidate({ ticker, timeframe: "1d" });
    }
  });
  const queryBars = barsQuery.data?.bars;
  const bars = useMemo(() => queryBars ?? [], [queryBars]);
  const rectangleAreas = useMemo(() => chartAreasQuery.data ?? [], [chartAreasQuery.data]);
  const maxHiddenTailDays = Math.max(bars.length - 1, 0);
  const displayedBars = useMemo(() => bars.slice(0, bars.length - hiddenTailDays), [bars, hiddenTailDays]);
  const currentVisibleIndex = displayedBars.length - 1;
  const latestBar = displayedBars.at(-1);
  const previousBar = displayedBars.at(-2);
  const latestBarDate = latestBar ? formatBarDate(latestBar.time) : null;
  const buyPrice = Number(buyPriceInput);
  const isBuyPriceValid = Number.isFinite(buyPrice) && buyPrice > 0;
  const change = latestBar && previousBar ? latestBar.close - previousBar.close : 0;
  const changePercent = latestBar && previousBar ? (change / previousBar.close) * 100 : 0;
  const trackedTradeRows = useMemo<TrackedTradeRow[]>(() => {
    if (!trackedTrade || currentVisibleIndex <= trackedTrade.entryIndex) return [];

    let maxDrawdownPercent = 0;

    return bars.slice(trackedTrade.entryIndex + 1, currentVisibleIndex + 1).map((bar) => {
      const profitLossPercent = ((bar.close - trackedTrade.buyPrice) / trackedTrade.buyPrice) * 100;
      const dayDrawdownPercent = bar.low < trackedTrade.buyPrice ? ((trackedTrade.buyPrice - bar.low) / trackedTrade.buyPrice) * 100 : 0;
      maxDrawdownPercent = Math.max(maxDrawdownPercent, dayDrawdownPercent);

      return {
        close: bar.close,
        date: formatBarDate(bar.time),
        maxDrawdownPercent,
        profitLossPercent,
        time: bar.time
      };
    });
  }, [bars, currentVisibleIndex, trackedTrade]);

  useEffect(() => {
    setTrackedTrade(null);
    setSelectedAreaId(null);
    setRectangleError(null);
    setDraftArea(null);
    setDrawingColorKey(null);
  }, [ticker]);

  useEffect(() => {
    setBuyPriceInput(latestBar ? formatBuyPrice(latestBar.close) : "");
  }, [latestBar]);

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

  function trackTrade() {
    if (!latestBar || !isBuyPriceValid) return;

    setTrackedTrade({
      buyPrice,
      entryDate: latestBar.time,
      entryIndex: currentVisibleIndex
    });
  }

  function addArea() {
    if (!draftArea) {
      setRectangleError("Draw an area on the chart before saving.");
      return;
    }

    const { startTime, endTime, topPrice, bottomPrice, colorKey } = draftArea;
    const startTimeMs = dateToUtcMs(startTime);
    const endTimeMs = dateToUtcMs(endTime);

    if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
      setRectangleError("The drawn area has invalid start or end dates.");
      return;
    }

    if (startTimeMs > endTimeMs) {
      setRectangleError("Start time must be on or before end time.");
      return;
    }

    if (!Number.isFinite(topPrice) || !Number.isFinite(bottomPrice) || topPrice <= 0 || bottomPrice <= 0) {
      setRectangleError("Top and bottom prices must be positive numbers.");
      return;
    }

    if (topPrice <= bottomPrice) {
      setRectangleError("Top price must be greater than bottom price.");
      return;
    }

    const overlapsVisibleBars = displayedBars.some((bar) => {
      const time = dateToUtcMs(bar.time);
      return time >= startTimeMs && time <= endTimeMs;
    });

    if (!overlapsVisibleBars) {
      setRectangleError("The selected time range does not contain a visible trading day.");
      return;
    }

    createArea.mutate({ ticker, timeframe: "1d", startTime, endTime, topPrice, bottomPrice, colorKey });
  }

  function selectDrawingColor(colorKey: ChartAreaColorKey) {
    if (drawingColorKey === colorKey) {
      cancelDrawingArea();
      return;
    }

    setSelectedAreaId(null);
    setDraftArea(null);
    setRectangleError(null);
    setDrawingColorKey(colorKey);
  }

  function cancelDrawingArea() {
    setDrawingColorKey(null);
    setRectangleError(null);
  }

  function reviewDrawnArea(rectangle: ChartRectangle) {
    setDraftArea(rectangle);
    setSelectedAreaId(null);
    setRectangleError(null);
    setDrawingColorKey(null);
  }

  function cancelDrawnAreaReview() {
    setDraftArea(null);
    setRectangleError(null);
  }

  function removeArea(area: { id: string; startTime: string; endTime: string }) {
    const shouldDelete = window.confirm(`Delete the area from ${area.startTime.slice(0, 10)} to ${area.endTime.slice(0, 10)}?`);

    if (shouldDelete) {
      deleteArea.mutate({ id: area.id });
    }
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
          <div className="grid gap-1.5">
            <Label htmlFor="buy-price" className="text-xs font-medium text-muted-foreground">
              Buy price
            </Label>
            <Input
              id="buy-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={buyPriceInput}
              onChange={(event) => setBuyPriceInput(event.target.value)}
              disabled={!latestBar}
              className="h-9 w-28"
            />
          </div>
          <Button type="button" size="sm" onClick={trackTrade} disabled={!latestBar || !isBuyPriceValid}>
            Track Trade
          </Button>
        </div>

        <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Draw a Price Range area on Chart:</p>
            <p className="text-xs text-muted-foreground">
              {drawingColorKey
                ? `Drawing a ${CHART_AREA_COLORS[drawingColorKey].label.toLowerCase()} area. Drag from one corner to the other. Press Escape to cancel.`
                : isReviewingDrawnArea
                  ? "Review the drawn values below, then click Add Area to save it."
                  : "STEP 1: Choose a color, then drag a time and price range on the chart; --- STEP2: then Click on 'Add Area' button."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Draw Area</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Draw Area colors">
              {CHART_AREA_COLOR_KEYS.map((colorKey) => {
                const color = CHART_AREA_COLORS[colorKey];
                const isActive = drawingColorKey === colorKey;

                return (
                  <button
                    key={colorKey}
                    type="button"
                    title={`Draw ${color.label.toLowerCase()} area`}
                    aria-label={`Draw ${color.label.toLowerCase()} area`}
                    aria-pressed={isActive}
                    disabled={!displayedBars.length || createArea.isPending}
                    onClick={() => selectDrawingColor(colorKey)}
                    className={
                      isActive
                        ? "grid h-9 w-9 place-items-center rounded-full border-2 border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background disabled:opacity-50"
                        : "grid h-9 w-9 place-items-center rounded-full border-2 border-transparent hover:border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                    }
                  >
                    <span className="h-6 w-6 rounded-full border border-black/20" style={{ backgroundColor: color.solid }} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
          {draftArea ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-amber-400/60 bg-amber-400/10 px-3 py-2 text-xs" aria-label="Rectangle draft">
              <span>
                <span className="font-medium">Time:</span> {draftArea.startTime.slice(0, 10)} to {draftArea.endTime.slice(0, 10)}
              </span>
              <span>
                <span className="font-medium">Price:</span> ${money(draftArea.bottomPrice)}–${money(draftArea.topPrice)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium">Color: </span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_AREA_COLORS[draftArea.colorKey].solid }} aria-hidden="true" />
                <span>{CHART_AREA_COLORS[draftArea.colorKey].label}</span>
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={addArea}
              disabled={!displayedBars.length || !draftArea || createArea.isPending || isDrawingArea}
            >
              {createArea.isPending ? "Adding..." : "Add Area"}
            </Button>
            {isReviewingDrawnArea ? (
              <Button type="button" variant="ghost" size="sm" onClick={cancelDrawnAreaReview} disabled={createArea.isPending}>
                Cancel Draft
              </Button>
            ) : null}
          </div>
          {rectangleError || createArea.error || deleteArea.error || chartAreasQuery.error ? (
            <p role="alert" className="text-xs text-destructive">
              {rectangleError ?? createArea.error?.message ?? deleteArea.error?.message ?? chartAreasQuery.error?.message}
            </p>
          ) : null}
          <div className="grid gap-2" aria-label="Saved chart areas">
            {chartAreasQuery.isLoading ? <p className="text-xs text-muted-foreground">Loading saved areas...</p> : null}
            {!chartAreasQuery.isLoading && !rectangleAreas.length ? (
              <p className="text-xs text-muted-foreground">No saved areas for {ticker}.</p>
            ) : null}
            {rectangleAreas.map((area, index) => {
              const isSelected = area.id === selectedAreaId;
              const color = CHART_AREA_COLORS[area.colorKey] ?? CHART_AREA_COLORS[DEFAULT_CHART_AREA_COLOR_KEY];
              const isDeleting = deleteArea.isPending && deleteArea.variables?.id === area.id;

              return (
                <div
                  key={area.id}
                  className={
                    isSelected
                      ? "flex items-center rounded-md border border-foreground bg-muted/50"
                      : "flex items-center rounded-md border bg-background/50 hover:bg-muted/50"
                  }
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedAreaId(area.id)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left text-xs"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color.solid }} aria-hidden="true" />
                    <span className="font-semibold">Area {index + 1}</span>
                    <span className="text-muted-foreground">
                      {area.startTime.slice(0, 10)} to {area.endTime.slice(0, 10)}
                    </span>
                    <span>
                      ${money(area.bottomPrice)}–${money(area.topPrice)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={`Delete Area ${index + 1}`}
                    aria-label={`Delete Area ${index + 1}`}
                    onClick={() => removeArea(area)}
                    disabled={isDeleting}
                    className="mr-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {trackedTrade ? (
          <div className="w-full overflow-x-auto rounded-md border lg:w-1/2">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium">Trade Buy Price:</span>
              <span className="font-semibold">${money(trackedTrade.buyPrice)}</span>
              <span className="text-muted-foreground">ON</span>
              <span className="font-semibold">{formatBarDate(trackedTrade.entryDate)}</span>
            </div>
            <table className="w-full min-w-[440px] text-xs">
              <thead className="bg-muted/20 text-left text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Close</th>
                  <th className="px-3 py-2 text-right font-medium">P/L %</th>
                  <th className="px-3 py-2 text-right font-medium">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {trackedTradeRows.map((row) => (
                  <tr key={row.time} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.date}</td>
                    <td className="px-3 py-2 text-right">${money(row.close)}</td>
                    <td
                      className={
                        row.profitLossPercent > 0
                          ? "px-3 py-2 text-right font-medium text-emerald-600 dark:text-emerald-400"
                          : row.profitLossPercent < 0
                            ? "px-3 py-2 text-right font-medium text-rose-600 dark:text-rose-400"
                            : "px-3 py-2 text-right font-medium"
                      }
                    >
                      {formatSignedPercent(row.profitLossPercent)}
                    </td>
                    <td
                      className={
                        row.maxDrawdownPercent > 0
                          ? "px-3 py-2 text-right font-medium text-rose-600 dark:text-rose-400"
                          : "px-3 py-2 text-right font-medium"
                      }
                    >
                      {formatDrawdownPercent(row.maxDrawdownPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {barsQuery.isLoading ? (
          <div className="h-80 animate-pulse rounded-md border bg-muted" />
        ) : (
          <NightVisionCandlestickChart
            bars={displayedBars}
            ticker={ticker}
            areas={rectangleAreas}
            selectedAreaId={selectedAreaId}
            draftArea={draftArea}
            drawingEnabled={isDrawingArea}
            drawingColorKey={drawingColorKey ?? DEFAULT_CHART_AREA_COLOR_KEY}
            onRectangleDrawn={reviewDrawnArea}
            onRectangleDrawingCancelled={cancelDrawingArea}
            onRectangleDrawingError={setRectangleError}
          />
        )}
      </CardContent>
    </Card>
  );
}
