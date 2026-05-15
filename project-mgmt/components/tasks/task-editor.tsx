"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { api } from "@/components/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { taskCreateSchema, type TaskFormValues } from "@/lib/validators";
import { useTaskStore } from "@/store/task-store";

const defaultValues: TaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  dueDate: null
};

export function TaskEditor() {
  const utils = api.useUtils();
  const { isEditorOpen, editingTask, closeEditor } = useTaskStore();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues
  });

  const createTask = api.tasks.create.useMutation({
    onSuccess: async () => {
      await utils.tasks.list.invalidate();
      closeEditor();
    }
  });

  const updateTask = api.tasks.update.useMutation({
    onSuccess: async () => {
      await utils.tasks.list.invalidate();
      closeEditor();
    }
  });

  useEffect(() => {
    if (editingTask) {
      form.reset({
        title: editingTask.title,
        description: editingTask.description ?? "",
        priority: editingTask.priority,
        status: editingTask.status,
        dueDate: editingTask.dueDate
      });
    } else {
      form.reset(defaultValues);
    }
  }, [editingTask, form, isEditorOpen]);

  const isSaving = createTask.isPending || updateTask.isPending;

  function onSubmit(values: TaskFormValues) {
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, ...values });
      return;
    }

    createTask.mutate(values);
  }

  return (
    <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit task" : "Create task"}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Write the task title" {...form.register("title")} />
            {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Add useful notes" {...form.register("description")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To do</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </div>
          <Controller
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <div className="grid gap-2">
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={(date) => field.onChange(date ?? null)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
