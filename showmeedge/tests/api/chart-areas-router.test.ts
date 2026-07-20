import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApiTestHarness, describeApi } from "@/tests/helpers/api-test-harness";

describeApi("chartAreasRouter", () => {
  let harness: Awaited<ReturnType<typeof createApiTestHarness>>;

  beforeAll(async () => {
    harness = await createApiTestHarness();
    await harness.assertDatabaseIsTestDatabase();
    await harness.ensureChartRectangleAreasTable();
  });

  beforeEach(async () => {
    await harness.clearChartRectangleAreas();
  });

  it("creates and lists areas only for the requested user and symbol", async () => {
    const userA = harness.createCaller("user_a");
    const userB = harness.createCaller("user_b");

    const created = await userA.chartAreas.create({
      ticker: "aapl",
      timeframe: "1d",
      startTime: "2026-01-03",
      endTime: "2026-01-07",
      topPrice: 110,
      bottomPrice: 104
    });
    await userA.chartAreas.create({
      ticker: "MSFT",
      timeframe: "1d",
      startTime: "2026-02-01",
      endTime: "2026-02-03",
      topPrice: 430,
      bottomPrice: 420
    });
    await userB.chartAreas.create({
      ticker: "AAPL",
      timeframe: "1d",
      startTime: "2026-03-01",
      endTime: "2026-03-02",
      topPrice: 125,
      bottomPrice: 120
    });

    const userAAreas = await userA.chartAreas.list({ ticker: "aapl", timeframe: "1d" });
    const userBAreas = await userB.chartAreas.list({ ticker: "AAPL", timeframe: "1d" });

    expect(created).toMatchObject({ ticker: "AAPL", timeframe: "1d", topPrice: 110, bottomPrice: 104 });
    expect(created.startTime).toBe("2026-01-03T00:00:00.000Z");
    expect(userAAreas.map((area) => area.id)).toEqual([created.id]);
    expect(userBAreas).toHaveLength(1);
    expect(userBAreas[0]?.topPrice).toBe(125);
  });

  it("prevents one user from deleting another user's area", async () => {
    const userA = harness.createCaller("user_a");
    const userB = harness.createCaller("user_b");
    const area = await userA.chartAreas.create({
      ticker: "AAPL",
      timeframe: "1d",
      startTime: "2026-01-03",
      endTime: "2026-01-07",
      topPrice: 110,
      bottomPrice: 104
    });

    const userBDelete = await userB.chartAreas.delete({ id: area.id });
    const afterUserBDelete = await userA.chartAreas.list({ ticker: "AAPL", timeframe: "1d" });
    const userADelete = await userA.chartAreas.delete({ id: area.id });

    expect(userBDelete).toBeUndefined();
    expect(afterUserBDelete).toHaveLength(1);
    expect(userADelete).toEqual({ id: area.id });
  });

  it("rejects invalid time and price ranges", async () => {
    const caller = harness.createCaller("user_a");

    await expect(
      caller.chartAreas.create({
        ticker: "AAPL",
        timeframe: "1d",
        startTime: "2026-01-07",
        endTime: "2026-01-03",
        topPrice: 110,
        bottomPrice: 104
      })
    ).rejects.toThrow("Start time must be on or before end time");

    await expect(
      caller.chartAreas.create({
        ticker: "AAPL",
        timeframe: "1d",
        startTime: "2026-01-03",
        endTime: "2026-01-07",
        topPrice: 100,
        bottomPrice: 104
      })
    ).rejects.toThrow("Top price must be greater than bottom price");
  });
});
