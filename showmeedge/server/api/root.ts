import { router } from "@/server/api/trpc";
import { tasksRouter } from "@/server/api/routers/tasks";
import { tradingRouter } from "@/server/api/routers/trading";

export const appRouter = router({
  tasks: tasksRouter,
  trading: tradingRouter
});

export type AppRouter = typeof appRouter;
