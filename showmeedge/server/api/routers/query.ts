import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "@/server/api/trpc";
import { db } from "@/server/db";
import { savedSqlQueries } from "@/server/db/schema";

const MARKET_API_BASE_URL = (process.env.MARKET_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const sqlQueryInputSchema = z.object({
  sql: z.string().trim().min(5, "SQL query must be at least 5 characters")
});

const savedSqlQueryInputSchema = z.object({
  name: z.string().trim().min(5, "Query name must be at least 5 characters").max(80, "Keep query names under 80 characters"),
  sql: z.string().trim().min(5, "SQL query must be at least 5 characters").max(50000, "Keep saved SQL under 50,000 characters")
});

type SqlQueryResponse = {
  csv: string;
  row_count: number;
  columns: string[];
};

async function fetchFromMarketApi<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const response = await fetch(`${MARKET_API_BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      }
    } catch {
      message = body;
    }
    throw new Error(message || `Market API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const queryRouter = router({
  savedQueries: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.query.savedSqlQueries.findMany({
        where: eq(savedSqlQueries.userId, ctx.userId),
        orderBy: [desc(savedSqlQueries.updatedAt)]
      })
    ),

    save: protectedProcedure.input(savedSqlQueryInputSchema).mutation(async ({ ctx, input }) => {
      const existing = await db.query.savedSqlQueries.findFirst({
        where: and(eq(savedSqlQueries.userId, ctx.userId), eq(savedSqlQueries.name, input.name))
      });

      if (existing) {
        const [savedQuery] = await db
          .update(savedSqlQueries)
          .set({
            sql: input.sql,
            updatedAt: new Date()
          })
          .where(and(eq(savedSqlQueries.id, existing.id), eq(savedSqlQueries.userId, ctx.userId)))
          .returning();

        if (!savedQuery) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Saved query was not found" });
        }

        return { ...savedQuery, action: "updated" as const };
      }

      const [savedQuery] = await db
        .insert(savedSqlQueries)
        .values({
          userId: ctx.userId,
          name: input.name,
          sql: input.sql
        })
        .returning();

      if (!savedQuery) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Saved query could not be created" });
      }

      return { ...savedQuery, action: "created" as const };
    })
  }),

  runSql: protectedProcedure.input(sqlQueryInputSchema).mutation(async ({ input }) => {
    try {
      return await fetchFromMarketApi<SqlQueryResponse>("/query/sql", {
        method: "POST",
        body: JSON.stringify({ sql: input.sql })
      });
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "QuestDB query failed"
      });
    }
  })
});
