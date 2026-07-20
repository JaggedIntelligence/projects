import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderComponent } from "@/tests/helpers/render";

type OverlayData = {
  name: string;
  type: string;
  data?: number[][];
  props?: Record<string, unknown>;
};

type ChartData = {
  panes: Array<{
    overlays: OverlayData[];
  }>;
};

type ChartOptions = {
  data: ChartData;
  scripts?: string[];
};

const nightVisionMocks = vi.hoisted(() => ({
  constructorCalls: [] as Array<{ options: ChartOptions; target: string }>,
  dataUpdates: [] as ChartData[],
  destroy: vi.fn(),
  eventHandlers: new Map<string, (event: unknown) => void>(),
  eventsOn: vi.fn((name: string, handler: (event: unknown) => void) => {
    nightVisionMocks.eventHandlers.set(name, handler);
  }),
  eventsOff: vi.fn((component: string, type?: string) => {
    if (type) nightVisionMocks.eventHandlers.delete(`${component}:${type}`);
  })
}));

vi.mock("night-vision", () => ({
  NightVision: class {
    events = {
      on: nightVisionMocks.eventsOn,
      off: nightVisionMocks.eventsOff
    };

    constructor(target: string, options: ChartOptions) {
      nightVisionMocks.constructorCalls.push({ target, options });
    }

    set data(data: ChartData) {
      nightVisionMocks.dataUpdates.push(data);
    }

    destroy() {
      nightVisionMocks.destroy();
    }
  }
}));

const { NightVisionCandlestickChart } = await import("@/components/nvcharts/nightvision-candlestick-chart");

describe("NightVisionCandlestickChart", () => {
  beforeEach(() => {
    nightVisionMocks.constructorCalls.length = 0;
    nightVisionMocks.dataUpdates.length = 0;
    nightVisionMocks.eventHandlers.clear();
    nightVisionMocks.eventsOn.mockClear();
    nightVisionMocks.eventsOff.mockClear();
    nightVisionMocks.destroy.mockClear();
  });

  it("registers the rectangle overlay and updates the existing chart instance", async () => {
    const bars = [
      { time: "2026-01-02", open: 100, high: 103, low: 99, close: 102, volume: 1_000 },
      { time: "2026-01-05", open: 102, high: 106, low: 101, close: 105, volume: 1_100 },
      { time: "2026-01-06", open: 105, high: 108, low: 104, close: 107, volume: 1_200 }
    ];
    const view = renderComponent(<NightVisionCandlestickChart bars={bars} ticker="AAPL" />);

    await waitFor(() => expect(nightVisionMocks.constructorCalls).toHaveLength(1));
    expect(nightVisionMocks.constructorCalls[0].options.scripts?.[0]).toContain("[OVERLAY name=RectangleArea");
    expect(nightVisionMocks.constructorCalls[0].options.scripts?.[1]).toContain("[OVERLAY name=RectangleDrawTool");

    view.rerender(
      <NightVisionCandlestickChart
        bars={bars}
        ticker="AAPL"
        areas={[
          { id: "area-1", startTime: "2026-01-03", endTime: "2026-01-06", topPrice: 110, bottomPrice: 104 },
          { id: "area-2", startTime: "2026-01-02", endTime: "2026-01-02", topPrice: 106, bottomPrice: 100 }
        ]}
        selectedAreaId="area-2"
      />
    );

    await waitFor(() => expect(nightVisionMocks.dataUpdates).toHaveLength(1));

    const rectangleOverlays = nightVisionMocks.dataUpdates[0].panes[0].overlays.filter((overlay) => overlay.type === "RectangleArea");
    expect(rectangleOverlays).toHaveLength(2);
    expect(rectangleOverlays[0]?.data).toEqual([
      [Date.parse("2026-01-05T00:00:00.000Z"), 110, 104],
      [Date.parse("2026-01-06T00:00:00.000Z"), 110, 104]
    ]);
    expect(rectangleOverlays[1]?.data).toEqual([[Date.parse("2026-01-02T00:00:00.000Z"), 106, 100]]);
    expect(rectangleOverlays[0]?.props).toMatchObject({ borderColor: "#38bdf8cc", lineWidth: 1 });
    expect(rectangleOverlays[1]?.props).toMatchObject({ borderColor: "#f8c537", lineWidth: 2 });
    expect(nightVisionMocks.constructorCalls).toHaveLength(1);
    expect(nightVisionMocks.destroy).not.toHaveBeenCalled();
  });

  it("bridges a completed drag to React and renders the review draft", async () => {
    const bars = [
      { time: "2026-01-02", open: 100, high: 103, low: 99, close: 102, volume: 1_000 },
      { time: "2026-01-05", open: 102, high: 106, low: 101, close: 105, volume: 1_100 }
    ];
    const onRectangleDrawn = vi.fn();
    const view = renderComponent(
      <NightVisionCandlestickChart bars={bars} ticker="AAPL" drawingEnabled onRectangleDrawn={onRectangleDrawn} />
    );

    await waitFor(() => expect(nightVisionMocks.constructorCalls).toHaveLength(1));

    const initialOverlays = nightVisionMocks.constructorCalls[0].options.data.panes[0].overlays;
    expect(initialOverlays.find((overlay) => overlay.type === "RectangleDrawTool")?.props).toMatchObject({ enabled: true });

    const drawHandler = [...nightVisionMocks.eventHandlers.entries()].find(([name]) => name.endsWith(":rectangle-drawn"))?.[1];
    expect(drawHandler).toBeDefined();

    drawHandler?.({
      startTime: Date.parse("2026-01-02T00:00:00.000Z"),
      endTime: Date.parse("2026-01-05T00:00:00.000Z"),
      topPrice: 108.25,
      bottomPrice: 101.5
    });

    expect(onRectangleDrawn).toHaveBeenCalledWith({
      startTime: "2026-01-02",
      endTime: "2026-01-05",
      topPrice: 108.25,
      bottomPrice: 101.5
    });

    view.rerender(
      <NightVisionCandlestickChart
        bars={bars}
        ticker="AAPL"
        draftArea={{ startTime: "2026-01-02", endTime: "2026-01-05", topPrice: 108.25, bottomPrice: 101.5 }}
      />
    );

    await waitFor(() => expect(nightVisionMocks.dataUpdates.length).toBeGreaterThan(0));
    const overlays = nightVisionMocks.dataUpdates.at(-1)?.panes[0].overlays ?? [];
    expect(overlays.find((overlay) => overlay.name === "Rectangle draft")?.props).toMatchObject({
      borderColor: "#f8c537",
      dashed: true,
      lineWidth: 2
    });
    expect(overlays.find((overlay) => overlay.type === "RectangleDrawTool")?.props).toMatchObject({ enabled: false });
  });
});
