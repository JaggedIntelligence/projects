import { create } from "zustand";

import type { TaskPriority, TaskStatus } from "@/lib/validators";
import type { Task } from "@/server/db/schema";

type TaskFilter = "all";

type TaskState = {
  search: string;
  status: TaskStatus | TaskFilter;
  priority: TaskPriority | TaskFilter;
  editingTask: Task | null;
  isEditorOpen: boolean;
  setSearch: (search: string) => void;
  setStatus: (status: TaskStatus | TaskFilter) => void;
  setPriority: (priority: TaskPriority | TaskFilter) => void;
  openCreate: () => void;
  openEdit: (task: Task) => void;
  closeEditor: () => void;
  resetFilters: () => void;
};

export const useTaskStore = create<TaskState>((set) => ({
  search: "",
  status: "all",
  priority: "all",
  editingTask: null,
  isEditorOpen: false,
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
  setPriority: (priority) => set({ priority }),
  openCreate: () => set({ editingTask: null, isEditorOpen: true }),
  openEdit: (task) => set({ editingTask: task, isEditorOpen: true }),
  closeEditor: () => set({ isEditorOpen: false, editingTask: null }),
  resetFilters: () => set({ search: "", status: "all", priority: "all" })
}));
