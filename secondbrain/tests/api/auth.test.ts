import { beforeAll, describe, expect, it } from "vitest";

import { createApiTestHarness, describeApi } from "@/tests/helpers/api-test-harness";

describeApi("protected tRPC procedures", () => {
  let harness: Awaited<ReturnType<typeof createApiTestHarness>>;

  beforeAll(async () => {
    harness = await createApiTestHarness();
  });

  it("rejects unauthenticated task list calls", async () => {
    const caller = harness.createCaller(null);

    await expect(caller.tasks.list({ status: "all", priority: "all" })).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
  });

  it("rejects unauthenticated task creation calls", async () => {
    const caller = harness.createCaller(null);

    await expect(
      caller.tasks.create({
        title: "Should not be created",
        priority: "medium",
        status: "todo",
        dueDate: null
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
  });
});

describe("API test database configuration", () => {
  it.runIf(!process.env.TEST_DATABASE_URL)("skips API integration tests unless TEST_DATABASE_URL is set", () => {
    expect(process.env.TEST_DATABASE_URL).toBeUndefined();
  });
});
