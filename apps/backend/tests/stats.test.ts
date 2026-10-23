import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Stats } from "../src/types";
import { buildTestApp, makeReport } from "./helpers";

describe("GET /reports/stats", () => {
  it("returns zeros and a 0 resolution rate when there are no reports", async () => {
    const { app } = buildTestApp();

    const res = await request(app).get("/reports/stats");
    const stats = res.body as Stats;

    expect(res.status).toBe(200);
    expect(stats.total).toBe(0);
    expect(stats.open).toBe(0);
    expect(stats.resolved).toBe(0);
    expect(stats.critical_open).toBe(0);
    expect(stats.resolution_rate).toBe(0);
    expect(stats.by_category).toEqual({
      pothole: 0,
      garbage: 0,
      water_supply: 0,
      streetlight: 0,
      drainage: 0,
      public_safety: 0,
      parks: 0,
      traffic: 0,
      other: 0,
    });
    expect(stats.by_severity).toEqual({ low: 0, medium: 0, high: 0, critical: 0 });
  });

  it("computes real counts from the repository", async () => {
    const { app, repo } = buildTestApp();
    const resolvedAt = new Date().toISOString();
    await repo.create(makeReport({ category: "pothole", severity: "critical", status: "open" }));
    await repo.create(makeReport({ category: "garbage", severity: "low", status: "open" }));
    await repo.create(
      makeReport({
        category: "pothole",
        severity: "critical",
        status: "resolved",
        resolved_at: resolvedAt,
      }),
    );
    await repo.create(
      makeReport({
        category: "drainage",
        severity: "medium",
        status: "resolved",
        resolved_at: resolvedAt,
      }),
    );

    const res = await request(app).get("/reports/stats");
    const stats = res.body as Stats;

    expect(res.status).toBe(200);
    expect(stats.total).toBe(4);
    expect(stats.open).toBe(2);
    expect(stats.resolved).toBe(2);
    expect(stats.critical_open).toBe(1);
    expect(stats.resolution_rate).toBeCloseTo(0.5);
    expect(stats.by_category).toEqual({
      pothole: 2,
      garbage: 1,
      water_supply: 0,
      streetlight: 0,
      drainage: 1,
      public_safety: 0,
      parks: 0,
      traffic: 0,
      other: 0,
    });
    expect(stats.by_severity).toEqual({ low: 1, medium: 1, high: 0, critical: 2 });
  });
});