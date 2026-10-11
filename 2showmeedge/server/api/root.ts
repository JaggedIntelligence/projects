import { router } from "@/server/api/trpc";
import { chartAreasRouter } from "@/server/api/routers/chart-areas";
import { marketDataRouter } from "@/server/api/routers/market-data";
import { queryRouter } from "@/server/api/routers/query";
import { tasksRouter } from "@/server/api/routers/tasks";
import { tradingRouter } from "@/server/api/routers/trading";

export const appRouter = router({
  chartAreas: chartAreasRouter,
  marketData: marketDataRouter,
  query: queryRouter,
  tasks: tasksRouter,
  trading: tradingRouter
});

export type AppRouter = typeof appRouter;
