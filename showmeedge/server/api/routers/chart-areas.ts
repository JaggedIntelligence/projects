import { and, asc, eq } from "drizzle-orm";

import { chartAreaCreateSchema, chartAreaDeleteSchema, chartAreaListSchema } from "@/lib/chart-area-validators";
import { protectedProcedure, router } from "@/server/api/trpc";
import { db } from "@/server/db";
import { chartRectangleAreas, type ChartRectangleArea } from "@/server/db/schema";

function serializeArea(area: ChartRectangleArea) {
  return {
    id: area.id,
    ticker: area.ticker,
    timeframe: area.timeframe,
    startTime: area.startTime.toISOString(),
    endTime: area.endTime.toISOString(),
    topPrice: Number(area.topPrice),
    bottomPrice: Number(area.bottomPrice),
    createdAt: area.createdAt,
    updatedAt: area.updatedAt
  };
}

export const chartAreasRouter = router({
  list: protectedProcedure.input(chartAreaListSchema).query(async ({ ctx, input }) => {
    const areas = await db
      .select()
      .from(chartRectangleAreas)
      .where(
        and(
          eq(chartRectangleAreas.userId, ctx.userId),
          eq(chartRectangleAreas.ticker, input.ticker),
          eq(chartRectangleAreas.timeframe, input.timeframe)
        )
      )
      .orderBy(asc(chartRectangleAreas.startTime), asc(chartRectangleAreas.createdAt));

    return areas.map(serializeArea);
  }),

  create: protectedProcedure.input(chartAreaCreateSchema).mutation(async ({ ctx, input }) => {
    const [area] = await db
      .insert(chartRectangleAreas)
      .values({
        userId: ctx.userId,
        ticker: input.ticker,
        timeframe: input.timeframe,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        topPrice: String(input.topPrice),
        bottomPrice: String(input.bottomPrice)
      })
      .returning();

    return serializeArea(area);
  }),

  delete: protectedProcedure.input(chartAreaDeleteSchema).mutation(async ({ ctx, input }) => {
    const [area] = await db
      .delete(chartRectangleAreas)
      .where(and(eq(chartRectangleAreas.id, input.id), eq(chartRectangleAreas.userId, ctx.userId)))
      .returning({ id: chartRectangleAreas.id });

    return area;
  })
});
