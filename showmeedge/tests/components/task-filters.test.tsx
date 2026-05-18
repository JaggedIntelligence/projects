import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TaskFilters } from "@/components/tasks/task-filters";
import { useTaskStore } from "@/store/task-store";
import { renderComponent, resetTaskStore } from "@/tests/helpers/render";

describe("TaskFilters", () => {
  beforeEach(() => {
    resetTaskStore();
  });

  it("renders the current filter controls", () => {
    renderComponent(<TaskFilters />);

    expect(screen.getByPlaceholderText("Search by title")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by priority")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
  });

  it("updates the store when the search input changes", () => {
    renderComponent(<TaskFilters />);

    fireEvent.change(screen.getByPlaceholderText("Search by title"), {
      target: { value: "docs" }
    });

    expect(useTaskStore.getState().search).toBe("docs");
  });

  it("resets filters when clear is clicked", () => {
    useTaskStore.getState().setSearch("docs");
    useTaskStore.getState().setStatus("done");
    useTaskStore.getState().setPriority("high");

    renderComponent(<TaskFilters />);

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(useTaskStore.getState().search).toBe("");
    expect(useTaskStore.getState().status).toBe("all");
    expect(useTaskStore.getState().priority).toBe("all");
  });
});
