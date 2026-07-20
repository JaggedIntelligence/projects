import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { describe, expect } from "vitest";

import type { AppRouter } from "@/server/api/root";
import type { SavedSqlQuery, Task } from "@/server/db/schema";

dotenv.config({ path: ".env.test" });

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

export const describeApi = testDatabaseUrl ? describe : describe.skip;

type ApiTestHarness = Awaited<ReturnType<typeof createApiTestHarness>>;
type Caller = ReturnType<ApiTestHarness["createCaller"]>;

export async function createApiTestHarness() {
  const [{ appRouter }, { createCallerFactory }, { db }, { chartRectangleAreas, savedSqlQueries, tasks }] = await Promise.all([
    import("@/server/api/root"),
    import("@/server/api/trpc"),
    import("@/server/db"),
    import("@/server/db/schema")
  ]);

  const createCaller = createCallerFactory(appRouter);

  async function clearTasks() {
    await db.delete(tasks);
  }

  async function clearSavedSqlQueries() {
    await db.delete(savedSqlQueries);
  }

  async function clearChartRectangleAreas() {
    await db.delete(chartRectangleAreas);
  }

  async function ensureSavedSqlQueriesTable() {
    await db.execute(sql`
      create table if not exists saved_sql_queries (
        id uuid primary key default gen_random_uuid() not null,
        user_id text not null,
        name text not null,
        sql text not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null
      )
    `);
    await db.execute(sql`create index if not exists saved_sql_queries_user_id_idx on saved_sql_queries (user_id)`);
    await db.execute(sql`create unique index if not exists saved_sql_queries_user_name_unique_idx on saved_sql_queries (user_id, name)`);
  }

  async function ensureChartRectangleAreasTable() {
    await db.execute(sql`
      create table if not exists chart_rectangle_areas (
        id uuid primary key default gen_random_uuid() not null,
        user_id text not null,
        ticker text not null,
        timeframe text default '1d' not null,
        start_time timestamp with time zone not null,
        end_time timestamp with time zone not null,
        top_price numeric(24, 8) not null,
        bottom_price numeric(24, 8) not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        constraint chart_rectangle_areas_valid_time_range check (end_time >= start_time),
        constraint chart_rectangle_areas_valid_price_range check (top_price > bottom_price),
        constraint chart_rectangle_areas_positive_prices check (top_price > 0 and bottom_price > 0)
      )
    `);
    await db.execute(sql`
      create index if not exists chart_rectangle_areas_user_ticker_timeframe_idx
      on chart_rectangle_areas (user_id, ticker, timeframe)
    `);
  }

  async function assertDatabaseIsTestDatabase() {
    const result = await db.execute(sql`select current_database()`);
    const currentDatabase = String(result[0]?.current_database ?? "");

    if (!currentDatabase.endsWith("_test")) {
      throw new Error(`Refusing to run API tests against database without an _test suffix: ${currentDatabase || "unknown"}`);
    }
  }

  return {
    db,
    chartRectangleAreas,
    savedSqlQueries,
    tasks,
    createCaller: (userId: string | null) => createCaller({ userId, organizationId: null }),
    clearTasks,
    clearSavedSqlQueries,
    clearChartRectangleAreas,
    ensureSavedSqlQueriesTable,
    ensureChartRectangleAreasTable,
    assertDatabaseIsTestDatabase
  };
}

export function taskInput(overrides: Partial<Parameters<Caller["tasks"]["create"]>[0]> = {}) {
  return {
    title: "Write API tests",
    description: "Cover tRPC task behavior",
    priority: "medium" as const,
    status: "todo" as const,
    dueDate: null,
    ...overrides
  };
}

export function expectTaskToMatch(task: Task, expected: Partial<Task>) {
  expect(task).toMatchObject(expected);
}

export function expectSavedSqlQueryToMatch(savedQuery: SavedSqlQuery, expected: Partial<SavedSqlQuery>) {
  expect(savedQuery).toMatchObject(expected);
}
