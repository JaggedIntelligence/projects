import { router } from "@/server/api/trpc";
import { imagesRouter } from "@/server/api/routers/images";
import { tasksRouter } from "@/server/api/routers/tasks";

export const appRouter = router({
  images: imagesRouter,
  tasks: tasksRouter
});

export type AppRouter = typeof appRouter;
