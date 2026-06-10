import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByRole("button", { name: "Sort by id ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by name ascending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by note ascending" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Doe, Jane" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "hello, world" })).toBeInTheDocument();
    expect(screen.queryByText(/id,name,note/)).not.toBeInTheDocument();
  });

  it("toggles column sorting when a header is clicked", () => {
    trpcMocks.mutationState.data = {
      csv: "id,name,price\n2,Beta,10\n1,Alpha,2\n3,Gamma,30\n",
      row_count: 3,
      columns: ["id", "name", "price"]
    };

    renderComponent(<SqlQueryPage />);

    expect(getColumnValues(0)).toEqual(["2", "1", "3"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by id ascending" }));

    expect(getColumnValues(0)).toEqual(["1", "2", "3"]);
    expect(getHeaderForSortButton("Sort by id descending")).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: "Sort by id descending" }));

    expect(getColumnValues(0)).toEqual(["3", "2", "1"]);
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
