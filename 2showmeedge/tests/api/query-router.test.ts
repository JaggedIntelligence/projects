import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiTestHarness, describeApi, expectSavedSqlQueryToMatch } from "@/tests/helpers/api-test-harness";

describeApi("queryRouter savedQueries", () => {
  let harness: Awaited<ReturnType<typeof createApiTestHarness>>;

  beforeAll(async () => {
    harness = await createApiTestHarness();
    await harness.assertDatabaseIsTestDatabase();
    await harness.ensureSavedSqlQueriesTable();
  });

  beforeEach(async () => {
    await harness.clearSavedSqlQueries();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and lists saved SQL queries for the authenticated user", async () => {
    const caller = harness.createCaller("user_a");

    const saved = await caller.query.savedQueries.save({
      name: "Friday movers",
      sql: "SELECT * FROM assets_eod LIMIT 10"
    });
    const savedQueries = await caller.query.savedQueries.list();

    expect(saved.action).toBe("created");
    expect(saved.id).toEqual(expect.any(String));
    expectSavedSqlQueryToMatch(saved, {
      userId: "user_a",
      name: "Friday movers",
      sql: "SELECT * FROM assets_eod LIMIT 10"
    });
    expect(savedQueries.map((query) => query.name)).toEqual(["Friday movers"]);
  });

  it("updates a same-name saved query for the same user", async () => {
    const caller = harness.createCaller("user_a");

    const first = await caller.query.savedQueries.save({
      name: "Friday movers",
      sql: "SELECT 1"
    });
    const second = await caller.query.savedQueries.save({
      name: "Friday movers",
      sql: "SELECT 2"
    });
    const savedQueries = await caller.query.savedQueries.list();

    expect(second.action).toBe("updated");
    expect(second.id).toBe(first.id);
    expect(second.sql).toBe("SELECT 2");
    expect(savedQueries).toHaveLength(1);
    expect(savedQueries[0]?.sql).toBe("SELECT 2");
  });

  it("keeps saved queries isolated by user", async () => {
    const userA = harness.createCaller("user_a");
    const userB = harness.createCaller("user_b");

    await userA.query.savedQueries.save({
      name: "Shared name",
      sql: "SELECT 1"
    });
    await userB.query.savedQueries.save({
      name: "Shared name",
      sql: "SELECT 2"
    });

    const userAQueries = await userA.query.savedQueries.list();
    const userBQueries = await userB.query.savedQueries.list();

    expect(userAQueries.map((query) => query.sql)).toEqual(["SELECT 1"]);
    expect(userBQueries.map((query) => query.sql)).toEqual(["SELECT 2"]);
  });

  it("validates minimum saved query name and SQL lengths", async () => {
    const caller = harness.createCaller("user_a");

    await expect(
      caller.query.savedQueries.save({
        name: "abcd",
        sql: "SELECT 1"
      })
    ).rejects.toThrow();
    await expect(
      caller.query.savedQueries.save({
        name: "Valid name",
        sql: "abcd"
      })
    ).rejects.toThrow();
  });

  it("forwards SQL parameters to the market API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          csv: "symbol\nAAPL\n",
          row_count: 1,
          columns: ["symbol"]
        }),
        { status: 200 }
      )
    );
    const caller = harness.createCaller("user_a");

    const result = await caller.query.runSql({
      sql: " SELECT * FROM equity_ohlcv_daily WHERE symbol = $1 ",
      params: [" AAPL "]
    });
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(result.row_count).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/query/sql",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      sql: "SELECT * FROM equity_ohlcv_daily WHERE symbol = $1",
      params: ["AAPL"]
    });
  });
});
