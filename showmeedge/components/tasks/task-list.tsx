"use client";

import { format, isPast, isToday } from "date-fns";
import { CalendarDays, CheckCircle2, Circle, Clock3, Pencil, Trash2 } from "lucide-react";

import { api } from "@/components/providers/trpc-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/validators";
import type { Task } from "@/server/db/schema";
import { useTaskStore } from "@/store/task-store";

const priorityTone = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
};

const statusIcon = {
  todo: Circle,
  in_progress: Clock3,
  done: CheckCircle2
};

export function TaskList() {
  const utils = api.useUtils();
  const { search, status, priority, openEdit } = useTaskStore();
  const query = api.tasks.list.useQuery({ search, status, priority });
  const updateTask = api.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate()
  });
  const deleteTask = api.tasks.delete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate()
  });

  if (query.isLoading) {
    return <div className="grid gap-3">{Array.from({ length: 3 }).map((_, index) => <TaskSkeleton key={index} />)}</div>;
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <h2 className="text-lg font-semibold">Tasks could not load</h2>
          <p className="max-w-md text-sm text-muted-foreground">Check your database connection and environment variables, then refresh.</p>
        </CardContent>
      </Card>
    );
  }

  if (!query.data?.length) {
    return (
      <Card>
        <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">No tasks found</h2>
            <p className="text-sm text-muted-foreground">Create a task or loosen the current filters.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {query.data.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onEdit={() => openEdit(task)}
          onDelete={() => deleteTask.mutate({ id: task.id })}
          onStatusChange={(nextStatus) => updateTask.mutate({ id: task.id, status: nextStatus })}
          disabled={deleteTask.isPending || updateTask.isPending}
        />
      ))}
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  disabled
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  disabled: boolean;
}) {
  const StatusIcon = statusIcon[task.status];
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const dueTone = dueDate && task.status !== "done" && isPast(dueDate) && !isToday(dueDate) ? "text-destructive" : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_170px_auto] md:items-center">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-start gap-3">
            <StatusIcon className={cn("mt-0.5 h-5 w-5 shrink-0", task.status === "done" ? "text-primary" : "text-muted-foreground")} />
            <div className="min-w-0">
              <h3 className={cn("truncate font-medium", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</h3>
              {task.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-8">
            <Badge variant="outline" className={priorityTone[task.priority]}>
              {task.priority}
            </Badge>
            {dueDate ? (
              <span className={cn("inline-flex items-center gap-1 text-xs", dueTone)}>
                <CalendarDays className="h-3.5 w-3.5" />
                {format(dueDate, "MMM d, yyyy")}
              </span>
            ) : null}
          </div>
        </div>
        <Select value={task.status} onValueChange={(value) => onStatusChange(value as TaskStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">To do</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Edit task" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Delete task" onClick={onDelete} disabled={disabled}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskSkeleton() {
  return (
    <div className="h-28 animate-pulse rounded-lg border bg-card">
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}
