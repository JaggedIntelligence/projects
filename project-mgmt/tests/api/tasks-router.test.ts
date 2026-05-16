import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApiTestHarness, describeApi, expectTaskToMatch, taskInput } from "@/tests/helpers/api-test-harness";

describeApi("tasksRouter", () => {
  let harness: Awaited<ReturnType<typeof createApiTestHarness>>;

  beforeAll(async () => {
    harness = await createApiTestHarness();
    await harness.assertDatabaseIsTestDatabase();
  });

  beforeEach(async () => {
    await harness.clearTasks();
  });

  it("creates and lists tasks for the authenticated user", async () => {
    const caller = harness.createCaller("user_a");

    const created = await caller.tasks.create(taskInput({ title: "Create API test" }));
    const tasks = await caller.tasks.list({ status: "all", priority: "all" });

    expect(created.id).toEqual(expect.any(String));
    expectTaskToMatch(created, {
      userId: "user_a",
      title: "Create API test",
      description: "Cover tRPC task behavior",
      priority: "medium",
      status: "todo",
      dueDate: null
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe(created.id);
  });

  it("keeps each user's tasks isolated", async () => {
    const userA = harness.createCaller("user_a");
    const userB = harness.createCaller("user_b");

    await userA.tasks.create(taskInput({ title: "User A task" }));
    await userB.tasks.create(taskInput({ title: "User B task" }));

    const userATasks = await userA.tasks.list({ status: "all", priority: "all" });
    const userBTasks = await userB.tasks.list({ status: "all", priority: "all" });

    expect(userATasks.map((task) => task.title)).toEqual(["User A task"]);
    expect(userBTasks.map((task) => task.title)).toEqual(["User B task"]);
  });

  it("filters by status, priority, and search", async () => {
    const caller = harness.createCaller("user_a");

    await caller.tasks.create(taskInput({ title: "Write docs", priority: "high", status: "todo" }));
    await caller.tasks.create(taskInput({ title: "Review tests", priority: "medium", status: "in_progress" }));
    await caller.tasks.create(taskInput({ title: "Ship feature", priority: "high", status: "done" }));

    const filtered = await caller.tasks.list({
      search: "ship",
      status: "done",
      priority: "high"
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Ship feature");
  });

  it("orders tasks by createdAt descending", async () => {
    const caller = harness.createCaller("user_a");

    await caller.tasks.create(taskInput({ title: "First task" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await caller.tasks.create(taskInput({ title: "Second task" }));

    const tasks = await caller.tasks.list({ status: "all", priority: "all" });

    expect(tasks.map((task) => task.title)).toEqual(["Second task", "First task"]);
  });

  it("updates only tasks owned by the authenticated user", async () => {
    const userA = harness.createCaller("user_a");
    const userB = harness.createCaller("user_b");
    const userATask = await userA.tasks.create(taskInput({ title: "Owned by A" }));

    const userBUpdate = await userB.tasks.update({
      id: userATask.id,
      status: "done"
    });
    const userAUpdate = await userA.tasks.update({
      id: userATask.id,
      status: "in_progress"
    });

    expect(userBUpdate).toBeUndefined();
    expect(userAUpdate?.status).toBe("in_progress");
  });

  it("deletes only tasks owned by the authenticated user", async () => {
    const userA = harness.createCaller("user_a");
    const userB = harness.createCaller("user_b");
    const userATask = await userA.tasks.create(taskInput({ title: "Delete me" }));

    const userBDelete = await userB.tasks.delete({ id: userATask.id });
    const userADelete = await userA.tasks.delete({ id: userATask.id });
    const remaining = await userA.tasks.list({ status: "all", priority: "all" });

    expect(userBDelete).toBeUndefined();
    expect(userADelete).toEqual({ id: userATask.id });
    expect(remaining).toHaveLength(0);
  });
});
