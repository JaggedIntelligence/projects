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
  destroy: vi.fn()
}));

vi.mock("night-vision", () => ({
  NightVision: class {
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
});
