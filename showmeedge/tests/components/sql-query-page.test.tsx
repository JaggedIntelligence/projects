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
    data:
      | {
          csv: string;
          row_count: number;
          columns: string[];
        }
      | undefined;
    error: Error | null;
    isPending: boolean;
  }
}));

vi.mock("@/components/providers/trpc-provider", () => ({
  api: {
    query: {
      runSql: {
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

const { SqlQueryPage } = await import("@/components/query/sql-query-page");

describe("SqlQueryPage", () => {
  beforeEach(() => {
    trpcMocks.mutate.mockReset();
    trpcMocks.mutationState.data = undefined;
    trpcMocks.mutationState.error = null;
    trpcMocks.mutationState.isPending = false;
  });

  it("runs SQL with the trimmed query", async () => {
    renderComponent(<SqlQueryPage />);

    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "  SELECT 1  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));

    await waitFor(() => {
      expect(trpcMocks.mutate).toHaveBeenCalledWith({ sql: "SELECT 1" });
    });
  });

  it("renders CSV results as a parsed table", () => {
    trpcMocks.mutationState.data = {
      csv: 'id,name,note\n1,"Doe, Jane","hello, world"\n2,Sam,"plain value"\n',
      row_count: 2,
      columns: ["id", "name", "note"]
    };

    renderComponent(<SqlQueryPage />);

    expect(screen.getByText("2 rows")).toBeInTheDocument();
    expect(screen.getByText("3 columns")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "id" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "note" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Doe, Jane" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "hello, world" })).toBeInTheDocument();
    expect(screen.queryByText(/id,name,note/)).not.toBeInTheDocument();
  });
});
