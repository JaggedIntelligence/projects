import { router } from "@/server/api/trpc";
import { tasksRouter } from "@/server/api/routers/tasks";

export const appRouter = router({
  tasks: tasksRouter
});

export type AppRouter = typeof appRouter;
