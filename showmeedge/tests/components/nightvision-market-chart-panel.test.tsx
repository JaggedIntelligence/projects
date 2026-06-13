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

const trpcMocks = vi.hoisted(() => ({
  barsState: {
    data: undefined as { bars: TestBar[] } | undefined,
    isLoading: false
  }
}));

vi.mock("@/components/providers/trpc-provider", () => ({
  api: {
    marketData: {
      bars: {
        useQuery: () => trpcMocks.barsState
      }
    }
  }
}));

vi.mock("@/components/nvcharts/nightvision-candlestick-chart", () => ({
  NightVisionCandlestickChart: ({ bars, ticker }: { bars: TestBar[]; ticker: string }) => (
    <div data-testid="nightvision-chart" data-bars={bars.length} data-ticker={ticker}>
      {bars.at(-1)?.time ?? "empty"}
    </div>
  )
}));

const { NightVisionMarketChartPanel } = await import("@/components/nvcharts/nightvision-market-chart-panel");

describe("NightVisionMarketChartPanel", () => {
  beforeEach(() => {
    trpcMocks.barsState.data = { bars: makeBars(10) };
    trpcMocks.barsState.isLoading = false;
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
    expect(screen.getByRole("cell", { name: "Tuesday JAN 6" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "$106.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "+1.4%" })).toHaveClass("text-emerald-600");
    expect(screen.getByRole("cell", { name: "-1.4%" })).toHaveClass("text-rose-600");

    fireEvent.click(screen.getByRole("button", { name: "Add one visible day" }));

    expect(screen.getByLabelText("Buy price")).toHaveValue(107);
    expect(screen.getByRole("cell", { name: "Wednesday JAN 7" })).toBeInTheDocument();
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
});

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
