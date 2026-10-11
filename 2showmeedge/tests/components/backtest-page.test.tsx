import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderComponent } from "@/tests/helpers/render";

const trpcMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutationState: {
    data: undefined,
    error: null,
    isPending: false
  } as {
    data: unknown;
    error: Error | null;
    isPending: boolean;
  }
}));

vi.mock("@/components/providers/trpc-provider", () => ({
  api: {
    marketData: {
      runBacktest: {
        useMutation: () => ({
          mutate: trpcMocks.mutate,
          data: trpcMocks.mutationState.data,
          error: trpcMocks.mutationState.error,
          isPending: trpcMocks.mutationState.isPending
        })
      }
    }
  }
}));

const { BacktestPage } = await import("@/components/backtest/backtest-page");

describe("BacktestPage", () => {
  beforeEach(() => {
    trpcMocks.mutate.mockReset();
    trpcMocks.mutationState.data = undefined;
    trpcMocks.mutationState.error = null;
    trpcMocks.mutationState.isPending = false;
  });

  it("renders the default dual-SMA inputs", () => {
    renderComponent(<BacktestPage />);

    expect(screen.getByRole("heading", { name: "Backtest" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ticker symbol")).toHaveValue("AAPL");
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("runs a backtest with normalized ticker and vectorbt sample defaults", async () => {
    renderComponent(<BacktestPage />);

    fireEvent.change(screen.getByLabelText("Ticker symbol"), {
      target: { value: "msft" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(trpcMocks.mutate).toHaveBeenCalledWith({
        ticker: "MSFT",
        timeframe: "1d",
        initialCash: 100,
        fastSma: 10,
        slowSma: 50
      });
    });
  });

  it("shows validation when ticker is blank", async () => {
    renderComponent(<BacktestPage />);

    fireEvent.change(screen.getByLabelText("Ticker symbol"), {
      target: { value: " " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Ticker symbol is required")).toBeInTheDocument();
    expect(trpcMocks.mutate).not.toHaveBeenCalled();
  });
});
