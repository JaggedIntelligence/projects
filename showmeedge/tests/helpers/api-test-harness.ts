import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { describe, expect } from "vitest";

import type { AppRouter } from "@/server/api/root";
import type { Task } from "@/server/db/schema";

dotenv.config({ path: ".env.test" });

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

export const describeApi = testDatabaseUrl ? describe : describe.skip;

type ApiTestHarness = Awaited<ReturnType<typeof createApiTestHarness>>;
type Caller = ReturnType<ApiTestHarness["createCaller"]>;

export async function createApiTestHarness() {
  const [{ appRouter }, { createCallerFactory }, { db }, { tasks }] = await Promise.all([
    import("@/server/api/root"),
    import("@/server/api/trpc"),
    import("@/server/db"),
    import("@/server/db/schema")
  ]);

  const createCaller = createCallerFactory(appRouter);

  async function clearTasks() {
    await db.delete(tasks);
  }

  async function assertDatabaseIsTestDatabase() {
    const result = await db.execute(sql`select current_database()`);
    const currentDatabase = String(result[0]?.current_database ?? "");

    if (!currentDatabase?.includes("second_brain")) {
      throw new Error(`Refusing to run API tests against non-test database: ${currentDatabase ?? "unknown"}`);
    }
  }

  return {
    db,
    tasks,
    createCaller: (userId: string | null) => createCaller({ userId, organizationId: null }),
    clearTasks,
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
