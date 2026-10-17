import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/server/db/schema";
import { useTaskStore } from "@/store/task-store";
import { renderComponent, resetTaskStore } from "@/tests/helpers/render";

const trpcMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock("@/components/providers/trpc-provider", () => ({
  api: {
    useUtils: () => ({
      tasks: {
        list: {
          invalidate: trpcMocks.invalidate
        }
      }
    }),
    tasks: {
      list: {
        useQuery: trpcMocks.useQuery
      },
      update: {
        useMutation: () => ({
          mutate: trpcMocks.updateMutate,
          isPending: false
        })
      },
      delete: {
        useMutation: () => ({
          mutate: trpcMocks.deleteMutate,
          isPending: false
        })
      }
    }
  }
}));

const { TaskList } = await import("@/components/tasks/task-list");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    userId: "user_123",
    title: "Write component tests",
    description: "Cover important task list states",
    priority: "medium",
    status: "todo",
    dueDate: null,
    createdAt: new Date("2026-05-16T10:00:00.000Z"),
    updatedAt: new Date("2026-05-16T10:00:00.000Z"),
    ...overrides
  };
}

describe("TaskList", () => {
  beforeEach(() => {
    resetTaskStore();
    trpcMocks.useQuery.mockReset();
    trpcMocks.updateMutate.mockReset();
    trpcMocks.deleteMutate.mockReset();
    trpcMocks.invalidate.mockReset();
  });

  it("renders loading skeletons while tasks load", () => {
    trpcMocks.useQuery.mockReturnValue({
      isLoading: true
    });

    const { container } = renderComponent(<TaskList />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders an error state when the task query fails", () => {
    trpcMocks.useQuery.mockReturnValue({
      isLoading: false,
      isError: true
    });

    renderComponent(<TaskList />);

    expect(screen.getByText("Tasks could not load")).toBeInTheDocument();
    expect(screen.getByText(/check your database connection/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no tasks", () => {
    trpcMocks.useQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: []
    });

    renderComponent(<TaskList />);

    expect(screen.getByText("No tasks found")).toBeInTheDocument();
    expect(screen.getByText("Create a task or loosen the current filters.")).toBeInTheDocument();
  });

  it("renders task rows", () => {
    trpcMocks.useQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        task({
          title: "Write component tests",
          description: "Cover important task list states",
          priority: "high",
          status: "todo",
          dueDate: new Date("2026-05-20T12:00:00.000Z")
        })
      ]
    });

    renderComponent(<TaskList />);

    expect(screen.getByText("Write component tests")).toBeInTheDocument();
    expect(screen.getByText("Cover important task list states")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("May 20, 2026")).toBeInTheDocument();
  });

  it("opens the store editor when edit is clicked", () => {
    const editableTask = task({ title: "Edit me" });
    trpcMocks.useQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [editableTask]
    });

    renderComponent(<TaskList />);

    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));

    expect(useTaskStore.getState().isEditorOpen).toBe(true);
    expect(useTaskStore.getState().editingTask).toEqual(editableTask);
  });

  it("calls the delete mutation when delete is clicked", () => {
    const deletableTask = task({ id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a" });
    trpcMocks.useQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [deletableTask]
    });

    renderComponent(<TaskList />);

    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));

    expect(trpcMocks.deleteMutate).toHaveBeenCalledWith({
      id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a"
    });
  });
});
