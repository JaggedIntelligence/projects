"use client";

import { Plus } from "lucide-react";

import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import { TaskStats } from "@/components/tasks/task-stats";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/store/task-store";

export function TaskPage({ compact = false }: { compact?: boolean }) {
  const openCreate = useTaskStore((state) => state.openCreate);

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{compact ? "Dashboard" : "Tasks"}</h1>
          <p className="text-sm text-muted-foreground">
            {compact ? "Your current task flow at a glance." : "Search, filter, and keep your work moving."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create task
        </Button>
      </div>
      <TaskStats />
      <TaskFilters />
      <TaskList />
    </main>
  );
}
