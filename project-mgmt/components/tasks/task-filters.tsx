"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskStore } from "@/store/task-store";

export function TaskFilters() {
  const { search, status, priority, setSearch, setStatus, setPriority, resetFilters } = useTaskStore();

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_180px_180px_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title" className="pl-9" />
      </div>
      <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="todo">To do</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
        <SelectTrigger aria-label="Filter by priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={resetFilters}>
        <X className="h-4 w-4" />
        <span className="md:hidden lg:inline">Clear</span>
        <SlidersHorizontal className="hidden h-4 w-4 md:inline lg:hidden" />
      </Button>
    </div>
  );
}
