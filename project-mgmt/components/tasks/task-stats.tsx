"use client";

import { CheckCircle2, Circle, Clock3, Flame } from "lucide-react";

import { api } from "@/components/providers/trpc-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task } from "@/server/db/schema";
import { useTaskStore } from "@/store/task-store";

export function TaskStats() {
  const { search, status, priority } = useTaskStore();
  const { data = [] } = api.tasks.list.useQuery({ search, status, priority });
  const stats = buildStats(data);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="To do" value={stats.todo} icon={Circle} />
      <StatCard title="In progress" value={stats.inProgress} icon={Clock3} />
      <StatCard title="Done" value={stats.done} icon={CheckCircle2} />
      <StatCard title="High priority" value={stats.high} icon={Flame} />
    </div>
  );
}

function buildStats(tasks: Task[]) {
  return {
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    done: tasks.filter((task) => task.status === "done").length,
    high: tasks.filter((task) => task.priority === "high").length
  };
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Circle }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
