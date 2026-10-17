import { beforeEach, describe, expect, it } from "vitest";

import type { Task } from "@/server/db/schema";
import { useTaskStore } from "@/store/task-store";

const initialState = useTaskStore.getInitialState();

const task: Task = {
  id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a",
  userId: "user_123",
  title: "Write store tests",
  description: "Keep task UI state predictable",
  priority: "high",
  status: "todo",
  dueDate: null,
  createdAt: new Date("2026-05-16T10:00:00.000Z"),
  updatedAt: new Date("2026-05-16T10:00:00.000Z")
};

describe("useTaskStore", () => {
  beforeEach(() => {
    useTaskStore.setState(initialState, true);
  });

  it("starts with empty filters and a closed editor", () => {
    const state = useTaskStore.getState();

    expect(state.search).toBe("");
    expect(state.status).toBe("all");
    expect(state.priority).toBe("all");
    expect(state.editingTask).toBeNull();
    expect(state.isEditorOpen).toBe(false);
  });

  it("updates search, status, and priority filters", () => {
    useTaskStore.getState().setSearch("docs");
    useTaskStore.getState().setStatus("in_progress");
    useTaskStore.getState().setPriority("high");

    const state = useTaskStore.getState();

    expect(state.search).toBe("docs");
    expect(state.status).toBe("in_progress");
    expect(state.priority).toBe("high");
  });

  it("resets filters", () => {
    useTaskStore.getState().setSearch("docs");
    useTaskStore.getState().setStatus("done");
    useTaskStore.getState().setPriority("low");

    useTaskStore.getState().resetFilters();

    const state = useTaskStore.getState();

    expect(state.search).toBe("");
    expect(state.status).toBe("all");
    expect(state.priority).toBe("all");
  });

  it("opens the editor for task creation", () => {
    useTaskStore.getState().openCreate();

    const state = useTaskStore.getState();

    expect(state.isEditorOpen).toBe(true);
    expect(state.editingTask).toBeNull();
  });

  it("opens the editor for task editing", () => {
    useTaskStore.getState().openEdit(task);

    const state = useTaskStore.getState();

    expect(state.isEditorOpen).toBe(true);
    expect(state.editingTask).toEqual(task);
  });

  it("closes the editor and clears the editing task", () => {
    useTaskStore.getState().openEdit(task);

    useTaskStore.getState().closeEditor();

    const state = useTaskStore.getState();

    expect(state.isEditorOpen).toBe(false);
    expect(state.editingTask).toBeNull();
  });
});
