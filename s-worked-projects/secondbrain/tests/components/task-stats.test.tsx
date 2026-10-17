import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/server/db/schema";
import { useTaskStore } from "@/store/task-store";
import { renderComponent, resetTaskStore } from "@/tests/helpers/render";

const trpcMocks = vi.hoisted(() => ({
  useQuery: vi.fn()
}));

vi.mock("@/components/providers/trpc-provider", () => ({
  api: {
    tasks: {
      list: {
        useQuery: trpcMocks.useQuery
      }
    }
  }
}));

const { TaskStats } = await import("@/components/tasks/task-stats");

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    userId: "user_123",
    title: "Task",
    description: null,
    priority: "medium",
    status: "todo",
    dueDate: null,
    createdAt: new Date("2026-05-16T10:00:00.000Z"),
    updatedAt: new Date("2026-05-16T10:00:00.000Z"),
    ...overrides
  };
}

describe("TaskStats", () => {
  beforeEach(() => {
    resetTaskStore();
    trpcMocks.useQuery.mockReset();
  });

  it("renders counts from task query data", () => {
    trpcMocks.useQuery.mockReturnValue({
      data: [
        task({ status: "todo", priority: "high" }),
        task({ status: "in_progress", priority: "medium" }),
        task({ status: "done", priority: "high" })
      ]
    });

    renderComponent(<TaskStats />);

    expect(screen.getByText("To do")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("High priority")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(3);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("queries with the current filter state", () => {
    useTaskStore.getState().setSearch("ship");
    useTaskStore.getState().setStatus("done");
    useTaskStore.getState().setPriority("high");

    trpcMocks.useQuery.mockReturnValue({ data: [] });

    renderComponent(<TaskStats />);

    expect(trpcMocks.useQuery).toHaveBeenCalledWith({
      search: "ship",
      status: "done",
      priority: "high"
    });
  });
});
