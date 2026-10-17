import { describe, expect, it } from "vitest";

import { taskCreateSchema, taskDeleteSchema, taskListSchema, taskUpdateSchema } from "@/lib/validators";

describe("taskCreateSchema", () => {
  it("accepts the smallest valid task and applies defaults", () => {
    const result = taskCreateSchema.parse({
      title: "Write tests"
    });

    expect(result).toEqual({
      title: "Write tests",
      priority: "medium",
      status: "todo"
    });
  });

  it("trims title and description values", () => {
    const result = taskCreateSchema.parse({
      title: "  Polish docs  ",
      description: "  Add unit test instructions  "
    });

    expect(result.title).toBe("Polish docs");
    expect(result.description).toBe("Add unit test instructions");
  });

  it("rejects an empty title", () => {
    const result = taskCreateSchema.safeParse({
      title: "   "
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Title is required");
  });

  it("rejects titles longer than 120 characters", () => {
    const result = taskCreateSchema.safeParse({
      title: "a".repeat(121)
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Keep titles under 120 characters");
  });

  it("coerces dueDate values into Date objects", () => {
    const result = taskCreateSchema.parse({
      title: "Schedule review",
      dueDate: "2026-05-20T12:00:00.000Z"
    });

    expect(result.dueDate).toBeInstanceOf(Date);
    expect(result.dueDate?.toISOString()).toBe("2026-05-20T12:00:00.000Z");
  });

  it("accepts null optional fields", () => {
    const result = taskCreateSchema.parse({
      title: "Nullable fields",
      description: null,
      dueDate: null
    });

    expect(result.description).toBeNull();
    expect(result.dueDate).toBeNull();
  });
});

describe("taskUpdateSchema", () => {
  it("requires a UUID id", () => {
    const result = taskUpdateSchema.safeParse({
      id: "not-a-uuid",
      title: "Update task"
    });

    expect(result.success).toBe(false);
  });

  it("accepts partial task updates", () => {
    const result = taskUpdateSchema.parse({
      id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a",
      status: "done"
    });

    expect(result).toEqual({
      id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a",
      status: "done"
    });
  });
});

describe("taskDeleteSchema", () => {
  it("requires a UUID id", () => {
    expect(taskDeleteSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(taskDeleteSchema.safeParse({ id: "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a" }).success).toBe(true);
  });
});

describe("taskListSchema", () => {
  it("applies all-filter defaults", () => {
    const result = taskListSchema.parse({});

    expect(result).toEqual({
      status: "all",
      priority: "all"
    });
  });

  it("trims search values", () => {
    const result = taskListSchema.parse({
      search: "  docs  "
    });

    expect(result.search).toBe("docs");
  });
});
