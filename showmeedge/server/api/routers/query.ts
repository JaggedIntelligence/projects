import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "@/server/api/trpc";

const MARKET_API_BASE_URL = (process.env.MARKET_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const sqlQueryInputSchema = z.object({
  sql: z.string().trim().min(1, "SQL query is required")
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
