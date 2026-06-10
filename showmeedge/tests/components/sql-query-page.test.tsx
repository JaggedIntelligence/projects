import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderComponent } from "@/tests/helpers/render";

const trpcMocks = vi.hoisted(() => ({
  invalidateSavedQueries: vi.fn(),
  mutate: vi.fn(),
  saveMutate: vi.fn(),
  saveMutationState: {
    error: null,
    isPending: false
  } as {
    error: Error | null;
    isPending: boolean;
  },
  savedQueriesState: {
    data: [] as Array<{
      id: string;
      userId: string;
      name: string;
      sql: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
    error: null,
    isLoading: false
  },
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
    useUtils: () => ({
      query: {
        savedQueries: {
          list: {
            invalidate: trpcMocks.invalidateSavedQueries
          }
        }
      }
    }),
    query: {
      savedQueries: {
        list: {
          useQuery: () => trpcMocks.savedQueriesState
        },
        save: {
          useMutation: () => ({
            mutate: trpcMocks.saveMutate,
            error: trpcMocks.saveMutationState.error,
            isPending: trpcMocks.saveMutationState.isPending
          })
        }
      },
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
    trpcMocks.invalidateSavedQueries.mockReset();
    trpcMocks.mutate.mockReset();
    trpcMocks.saveMutate.mockReset();
    trpcMocks.mutationState.data = undefined;
    trpcMocks.mutationState.error = null;
    trpcMocks.mutationState.isPending = false;
    trpcMocks.saveMutationState.error = null;
    trpcMocks.saveMutationState.isPending = false;
    trpcMocks.savedQueriesState.data = [];
    trpcMocks.savedQueriesState.error = null;
    trpcMocks.savedQueriesState.isLoading = false;
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

  it("saves the current SQL with a query name", () => {
    renderComponent(<SqlQueryPage />);

    fireEvent.change(screen.getByLabelText("Query name"), {
      target: { value: "Friday winners" }
    });
    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "  SELECT * FROM assets_eod LIMIT 10  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save query as" }));

    expect(trpcMocks.saveMutate).toHaveBeenCalledWith({
      name: "Friday winners",
      sql: "SELECT * FROM assets_eod LIMIT 10"
    });
  });

  it("validates saved query name and SQL length before saving", () => {
    renderComponent(<SqlQueryPage />);

    fireEvent.change(screen.getByLabelText("Query name"), {
      target: { value: "abc" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save query as" }));

    expect(screen.getByText("Query name must be at least 5 characters")).toBeInTheDocument();
    expect(trpcMocks.saveMutate).not.toHaveBeenCalled();
  });

  it("renders CSV results as a parsed table", () => {
    trpcMocks.mutationState.data = {
      csv: 'ts,id,name,note,price,pct_gain\n"2026-06-10 13:45:22",1,"Doe, Jane","hello, world",123.456," 5.42 "\n"2026-06-09T09:30:00Z",2,Sam,"plain value",-4.5,-1.2%\n',
      row_count: 2,
      columns: ["ts", "id", "name", "note", "price", "pct_gain"]
    };

    renderComponent(<SqlQueryPage />);

    expect(screen.getByText("2 rows")).toBeInTheDocument();
    expect(screen.getByText("6 columns")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by ts ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by id ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by name ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by note ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by price ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by pct_gain ascending" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2026-06-10" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2026-06-09" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Doe, Jane" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "hello, world" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "123.46" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "-4.50" })).toBeInTheDocument();
    expect(screen.getByText("5.42%")).toHaveClass("text-emerald-600");
    expect(screen.getByText("5.42%")).toHaveAttribute("data-column-kind", "percent");
    expect(screen.getByText("5.42%")).toHaveAttribute("data-value-sign", "positive");
    expect(screen.getByText("-1.20%")).toHaveClass("text-rose-600");
    expect(screen.getByText("-1.20%")).toHaveAttribute("data-column-kind", "percent");
    expect(screen.getByText("-1.20%")).toHaveAttribute("data-value-sign", "negative");
    expect(screen.queryByText("2026-06-10 13:45:22")).not.toBeInTheDocument();
    expect(screen.queryByText(/id,name,note/)).not.toBeInTheDocument();
  });

  it("toggles column sorting when a header is clicked", () => {
    trpcMocks.mutationState.data = {
      csv: "id,name,price\n2,Beta,10\n1,Alpha,2\n3,Gamma,30\n",
      row_count: 3,
      columns: ["id", "name", "price"]
    };

    renderComponent(<SqlQueryPage />);

    expect(getColumnValues(0)).toEqual(["2.00", "1.00", "3.00"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by id ascending" }));

    expect(getColumnValues(0)).toEqual(["1.00", "2.00", "3.00"]);
    expect(getHeaderForSortButton("Sort by id descending")).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: "Sort by id descending" }));

    expect(getColumnValues(0)).toEqual(["3.00", "2.00", "1.00"]);
    expect(getHeaderForSortButton("Sort by id ascending")).toHaveAttribute("aria-sort", "descending");
  });
});

function getColumnValues(columnIndex: number) {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[columnIndex].textContent);
}

function getHeaderForSortButton(name: string) {
  const header = screen.getByRole("button", { name }).closest("th");

  if (!header) {
    throw new Error(`Could not find header for ${name}`);
  }

  return header;
}
