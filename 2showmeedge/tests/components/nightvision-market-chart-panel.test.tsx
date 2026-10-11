import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderComponent } from "@/tests/helpers/render";

type TestBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TestChartArea = {
  id: string;
  ticker: string;
  timeframe: string;
  startTime: string;
  endTime: string;
  topPrice: number;
  bottomPrice: number;
  colorKey: "sky" | "amber" | "emerald" | "rose" | "violet" | "orange";
};

const trpcMocks = vi.hoisted(() => ({
  barsState: {
    data: undefined as { bars: TestBar[] } | undefined,
    isLoading: false
  },
  chartAreasState: {
    data: [] as TestChartArea[],
    isLoading: false,
    error: null as Error | null
  },
  createArea: vi.fn(),
  deleteArea: vi.fn(),
  invalidateAreas: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/components/providers/trpc-provider", () => ({
  api: {
    useUtils: () => ({
      chartAreas: {
        list: {
          invalidate: trpcMocks.invalidateAreas
        }
      }
    }),
    marketData: {
      bars: {
        useQuery: () => trpcMocks.barsState
      }
    },
    chartAreas: {
      list: {
        useQuery: () => trpcMocks.chartAreasState
      },
      create: {
        useMutation: (options?: { onSuccess?: (area: TestChartArea, input: Record<string, unknown>) => void }) => ({
          mutate: (input: Record<string, unknown>) => {
            trpcMocks.createArea(input);
            options?.onSuccess?.(
              {
                id: "created-area",
                ticker: String(input.ticker),
                timeframe: String(input.timeframe),
                startTime: `${String(input.startTime)}T00:00:00.000Z`,
                endTime: `${String(input.endTime)}T00:00:00.000Z`,
                topPrice: Number(input.topPrice),
                bottomPrice: Number(input.bottomPrice),
                colorKey: String(input.colorKey) as TestChartArea["colorKey"]
              },
              input
            );
          },
          isPending: false,
          error: null
        })
      },
      delete: {
        useMutation: (options?: { onSuccess?: (result: undefined, input: Record<string, unknown>) => void }) => ({
          mutate: (input: Record<string, unknown>) => {
            trpcMocks.deleteArea(input);
            options?.onSuccess?.(undefined, input);
          },
          isPending: false,
          error: null
        })
      }
    }
  }
}));

vi.mock("@/components/nvcharts/nightvision-candlestick-chart", () => ({
  NightVisionCandlestickChart: ({
    bars,
    ticker,
    areas,
    selectedAreaId,
    draftArea,
    drawingEnabled,
    drawingColorKey,
    onRectangleDrawn
  }: {
    bars: TestBar[];
    ticker: string;
    areas?: TestChartArea[];
    selectedAreaId?: string | null;
    draftArea?: { startTime: string; endTime: string; topPrice: number; bottomPrice: number; colorKey: TestChartArea["colorKey"] } | null;
    drawingEnabled?: boolean;
    drawingColorKey?: TestChartArea["colorKey"];
    onRectangleDrawn?: (area: {
      startTime: string;
      endTime: string;
      topPrice: number;
      bottomPrice: number;
      colorKey: TestChartArea["colorKey"];
    }) => void;
  }) => (
    <div
      data-testid="nightvision-chart"
      data-bars={bars.length}
      data-ticker={ticker}
      data-areas={JSON.stringify(areas ?? [])}
      data-selected-area={selectedAreaId ?? ""}
      data-draft={JSON.stringify(draftArea ?? null)}
      data-drawing={String(Boolean(drawingEnabled))}
      data-drawing-color={drawingColorKey}
    >
      {bars.at(-1)?.time ?? "empty"}
      <button
        type="button"
        onClick={() =>
          onRectangleDrawn?.({
            startTime: "2026-01-02",
            endTime: "2026-01-06",
            topPrice: 109.75,
            bottomPrice: 101.25,
            colorKey: drawingColorKey ?? "sky"
          })
        }
      >
        Complete rectangle drag
      </button>
    </div>
  )
}));

const { NightVisionMarketChartPanel } = await import("@/components/nvcharts/nightvision-market-chart-panel");

describe("NightVisionMarketChartPanel", () => {
  beforeEach(() => {
    trpcMocks.barsState.data = { bars: makeBars(10) };
    trpcMocks.barsState.isLoading = false;
    trpcMocks.chartAreasState.data = [];
    trpcMocks.chartAreasState.isLoading = false;
    trpcMocks.chartAreasState.error = null;
    trpcMocks.createArea.mockClear();
    trpcMocks.deleteArea.mockClear();
    trpcMocks.invalidateAreas.mockClear();
  });

  it("hides the requested tail days and steps visible days with the arrows", () => {
    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-bars", "10");

    fireEvent.change(screen.getByLabelText("Days go back"), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-bars", "5");
    expect(screen.getByLabelText("Buy price")).toHaveValue(105);
    expect(screen.getByText("5 hidden")).toBeInTheDocument();
    expect(screen.getByText("Monday JAN 5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add one visible day" }));
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-bars", "6");
    expect(screen.getByLabelText("Days go back")).toHaveValue(4);
    expect(screen.getByLabelText("Buy price")).toHaveValue(106);
    expect(screen.getByText("Tuesday JAN 6")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add one visible day" }));
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-bars", "7");
    expect(screen.getByLabelText("Days go back")).toHaveValue(3);
    expect(screen.getByLabelText("Buy price")).toHaveValue(107);
    expect(screen.getByText("Wednesday JAN 7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove one visible day" }));
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-bars", "6");
    expect(screen.getByLabelText("Days go back")).toHaveValue(4);
    expect(screen.getByLabelText("Buy price")).toHaveValue(106);
    expect(screen.getByText("Tuesday JAN 6")).toBeInTheDocument();
  });

  it("tracks a trade from the current visible bar and rewinds rows with the chart", () => {
    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    fireEvent.change(screen.getByLabelText("Days go back"), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    fireEvent.change(screen.getByLabelText("Buy price"), {
      target: { value: "104.50" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Track Trade" }));

    expect(screen.getByText("Trade Buy Price:")).toBeInTheDocument();
    expect(screen.getByText("$104.50")).toBeInTheDocument();
    expect(screen.getByText("ON")).toBeInTheDocument();
    expect(screen.getAllByText("Monday JAN 5")).toHaveLength(2);
    expect(screen.queryByText("+1.4%")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add one visible day" }));

    expect(screen.getByLabelText("Buy price")).toHaveValue(106);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Date", "Close", "High", "Low", "P/L %", "Max DD"]);
    expect(screen.getByRole("columnheader", { name: "Date" })).toHaveClass("font-bold");
    expect(screen.getByRole("columnheader", { name: "Date" }).closest("thead")).toHaveClass("bg-violet-600", "text-white");
    expect(screen.getByRole("cell", { name: "Tuesday JAN 6" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$106.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$107.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$103.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "+1.4%" })).toHaveClass("text-emerald-600");
    expect(screen.getByRole("cell", { name: "-1.4%" })).toHaveClass("text-rose-600");

    fireEvent.click(screen.getByRole("button", { name: "Add one visible day" }));

    expect(screen.getByLabelText("Buy price")).toHaveValue(107);
    expect(screen.getByRole("cell", { name: "Wednesday JAN 7" }).closest("tr")).toHaveClass("bg-slate-200");
    expect(screen.getByRole("cell", { name: "$108.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$104.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "+2.4%" })).toHaveClass("text-emerald-600");
    expect(screen.getAllByRole("cell", { name: "-1.4%" })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Remove one visible day" }));

    expect(screen.getByLabelText("Buy price")).toHaveValue(106);
    expect(screen.queryByRole("cell", { name: "Wednesday JAN 7" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Tuesday JAN 6" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Track Trade" }));

    expect(screen.getAllByText("$106.00")).toHaveLength(2);
    expect(screen.getAllByText("Tuesday JAN 6")).toHaveLength(2);
    expect(screen.queryByRole("cell", { name: "+1.4%" })).not.toBeInTheDocument();
  });

  it("highlights Monday trade rows in green", () => {
    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    fireEvent.change(screen.getByLabelText("Days go back"), {
      target: { value: "6" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    fireEvent.click(screen.getByRole("button", { name: "Track Trade" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one visible day" }));

    expect(screen.getByRole("cell", { name: "Monday JAN 5" }).closest("tr")).toHaveClass("bg-emerald-100");
  });

  it("clamps days go back so at least one bar remains visible", () => {
    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    fireEvent.change(screen.getByLabelText("Days go back"), {
      target: { value: "99" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-bars", "1");
    expect(screen.getByLabelText("Days go back")).toHaveValue(9);
    expect(screen.getByRole("button", { name: "Remove one visible day" })).toBeDisabled();
  });

  it("reviews a dragged rectangle as text before saving it", () => {
    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Top price")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bottom price")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Area" })).toBeDisabled();

    expect(screen.getByRole("group", { name: "Draw Area colors" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Draw .* area$/ })).toHaveLength(6);
    expect(screen.queryByRole("button", { name: "Draw Area" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Draw violet area" }));

    expect(screen.getByRole("button", { name: "Draw violet area" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-drawing", "true");
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-drawing-color", "violet");

    fireEvent.click(screen.getByRole("button", { name: "Complete rectangle drag" }));

    expect(trpcMocks.createArea).not.toHaveBeenCalled();
    expect(screen.getByText(/Review the drawn values/)).toBeInTheDocument();
    expect(screen.getByLabelText("Rectangle draft")).toHaveTextContent("Time: 2026-01-02 to 2026-01-06");
    expect(screen.getByLabelText("Rectangle draft")).toHaveTextContent("Price: $101.25–$109.75");
    expect(screen.getByLabelText("Rectangle draft")).toHaveTextContent("Color: Violet");
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-drawing", "false");
    expect(JSON.parse(screen.getByTestId("nightvision-chart").getAttribute("data-draft") ?? "null")).toEqual({
      startTime: "2026-01-02",
      endTime: "2026-01-06",
      topPrice: 109.75,
      bottomPrice: 101.25,
      colorKey: "violet"
    });
    expect(screen.getByRole("button", { name: "Add Area" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Add Area" }));

    expect(trpcMocks.createArea).toHaveBeenCalledWith({
      ticker: "AAPL",
      timeframe: "1d",
      startTime: "2026-01-02",
      endTime: "2026-01-06",
      topPrice: 109.75,
      bottomPrice: 101.25,
      colorKey: "violet"
    });
    expect(screen.queryByRole("button", { name: "Cancel Draft" })).not.toBeInTheDocument();
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-draft", "null");
  });

  it("cancels an unsaved rectangle draft", () => {
    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Draw sky area" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete rectangle drag" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel Draft" }));

    expect(trpcMocks.createArea).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Rectangle draft")).not.toBeInTheDocument();
    expect(screen.getByTestId("nightvision-chart")).toHaveAttribute("data-draft", "null");
    expect(screen.getByRole("button", { name: "Add Area" })).toBeDisabled();
  });

  it("clears drawing and selection when clicking outside the chart", () => {
    trpcMocks.chartAreasState.data = [makeArea("area-1", "2026-01-02", "2026-01-04", 110, 100)];

    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    const chart = screen.getByTestId("nightvision-chart");
    const violetSwatch = screen.getByRole("button", { name: "Draw violet area" });

    fireEvent.click(violetSwatch);
    expect(violetSwatch).toHaveAttribute("aria-pressed", "true");

    fireEvent.pointerDown(chart);
    expect(violetSwatch).toHaveAttribute("aria-pressed", "true");

    fireEvent.pointerDown(document.body);
    expect(violetSwatch).toHaveAttribute("aria-pressed", "false");
    expect(chart).toHaveAttribute("data-drawing", "false");

    fireEvent.click(screen.getByRole("button", { name: /Area 1.*2026-01-02/ }));
    expect(chart).toHaveAttribute("data-selected-area", "area-1");

    fireEvent.pointerDown(chart);
    expect(chart).toHaveAttribute("data-selected-area", "area-1");

    fireEvent.pointerDown(document.body);
    expect(chart).toHaveAttribute("data-selected-area", "");
  });

  it("loads multiple saved areas and deletes only the selected area", () => {
    trpcMocks.chartAreasState.data = [
      makeArea("area-1", "2026-01-02", "2026-01-04", 110, 100),
      makeArea("area-2", "2026-01-05", "2026-01-07", 120, 112)
    ];
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderComponent(<NightVisionMarketChartPanel symbols={[{ id: "aapl", ticker: "AAPL", name: "Apple Inc." }]} />);

    expect(screen.getByText("Area 1")).toBeInTheDocument();
    expect(screen.getByText("Area 2")).toBeInTheDocument();
    expect(screen.getAllByText(/^Area [12]$/).map((areaLabel) => areaLabel.textContent)).toEqual(["Area 2", "Area 1"]);
    expect(JSON.parse(screen.getByTestId("nightvision-chart").getAttribute("data-areas") ?? "[]")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Delete Area" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Area 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete Area 2" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Area 2" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(trpcMocks.deleteArea).toHaveBeenCalledWith({ id: "area-2" });
    expect(trpcMocks.invalidateAreas).toHaveBeenCalledWith({ ticker: "AAPL", timeframe: "1d" });
  });
});

function makeArea(
  id: string,
  startTime: string,
  endTime: string,
  topPrice: number,
  bottomPrice: number,
  colorKey: TestChartArea["colorKey"] = "sky"
): TestChartArea {
  return {
    id,
    ticker: "AAPL",
    timeframe: "1d",
    startTime: `${startTime}T00:00:00.000Z`,
    endTime: `${endTime}T00:00:00.000Z`,
    topPrice,
    bottomPrice,
    colorKey
  };
}

function makeBars(count: number): TestBar[] {
  return Array.from({ length: count }, (_, index) => {
    const price = 100 + index;

    return {
      time: `2026-01-${String(index + 1).padStart(2, "0")}`,
      open: price,
      high: price + 2,
      low: price - 2,
      close: price + 1,
      volume: 1_000_000 + index
    };
  });
}
