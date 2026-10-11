import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/server/db/schema";
import { useTaskStore } from "@/store/task-store";
import { renderComponent, resetTaskStore } from "@/tests/helpers/render";

const trpcMocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
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
      create: {
        useMutation: () => ({
          mutate: trpcMocks.createMutate,
          isPending: false
        })
      },
      update: {
        useMutation: () => ({
          mutate: trpcMocks.updateMutate,
          isPending: false
        })
      }
    }
  }
}));

const { TaskEditor } = await import("@/components/tasks/task-editor");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a",
    userId: "user_123",
    title: "Existing task",
    description: "Existing notes",
    priority: "high",
    status: "in_progress",
    dueDate: null,
    createdAt: new Date("2026-05-16T10:00:00.000Z"),
    updatedAt: new Date("2026-05-16T10:00:00.000Z"),
    ...overrides
  };
}

describe("TaskEditor", () => {
  beforeEach(() => {
    resetTaskStore();
    trpcMocks.createMutate.mockReset();
    trpcMocks.updateMutate.mockReset();
    trpcMocks.invalidate.mockReset();
  });

  it("renders create mode when the store opens a new task", () => {
    useTaskStore.getState().openCreate();

    renderComponent(<TaskEditor />);

    expect(screen.getByRole("heading", { name: "Create task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save task" })).toBeEnabled();
  });

  it("shows validation when title is missing", async () => {
    useTaskStore.getState().openCreate();

    renderComponent(<TaskEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(trpcMocks.createMutate).not.toHaveBeenCalled();
  });

  it("submits create payloads", async () => {
    useTaskStore.getState().openCreate();

    renderComponent(<TaskEditor />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New task" }
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "New notes" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => {
      expect(trpcMocks.createMutate).toHaveBeenCalledWith({
        title: "New task",
        description: "New notes",
        priority: "medium",
        status: "todo",
        dueDate: null
      });
    });
  });

  it("prefills edit mode and submits update payloads", async () => {
    useTaskStore.getState().openEdit(task());

    renderComponent(<TaskEditor />);

    expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Existing task");
    expect(screen.getByLabelText("Description")).toHaveValue("Existing notes");

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated task" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => {
      expect(trpcMocks.updateMutate).toHaveBeenCalledWith({
        id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a",
        title: "Updated task",
        description: "Existing notes",
        priority: "high",
        status: "in_progress",
        dueDate: null
      });
    });
  });
});
