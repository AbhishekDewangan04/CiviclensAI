import request from "supertest";
import { describe, expect, it } from "vitest";
import { aggregateAnalytics, HOTSPOT_DISTANCE_METERS } from "./analytics.js";
import type { Incident } from "./domain.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { MemoryIncidentRepository, MemoryUserRepository } from "./repositories/memory.js";

const config = loadConfig({ NODE_ENV: "test", PORT: "3000", CORS_ORIGINS: "http://localhost:5173", JSON_LIMIT: "10kb" });
const incident = (overrides: Partial<Incident> = {}): Incident => ({ id: "id", userId: "user", title: "title", description: "description", category: "pothole", address: "address", status: "reported", createdAt: new Date("2025-01-01T00:00:00Z"), updatedAt: new Date("2025-01-01T00:00:00Z"), ...overrides });

describe("analytics aggregation", () => {
  it("computes filtered metrics and excludes missing coordinates from hotspots", () => {
    const summary = aggregateAnalytics([incident({ latitude: 10, longitude: 20 }), incident({ id: "2", category: "garbage", status: "resolved", latitude: 10.0005, longitude: 20.0005 }), incident({ id: "3", latitude: undefined, longitude: undefined })]);
    expect(summary.totalReports).toBe(3);
    expect(summary.categoryBreakdown.find((item) => item.category === "garbage")?.count).toBe(1);
    expect(summary.statusDistribution.find((item) => item.status === "resolved")?.count).toBe(1);
    expect(summary.coordinateCoverage).toEqual({ withCoordinates: 2, withoutCoordinates: 1 });
    expect(summary.recurringHotspots).toHaveLength(1);
  });

  it("keeps points beyond the documented nearby threshold separate", () => {
    const latitudeDelta = (HOTSPOT_DISTANCE_METERS + 1) / 6_371_000 * 180 / Math.PI;
    expect(aggregateAnalytics([incident({ latitude: 10, longitude: 20 }), incident({ id: "2", latitude: 10 + latitudeDelta, longitude: 20 })]).recurringHotspots).toHaveLength(0);
  });

  it("returns zeroed distributions for an empty dataset", () => {
    const summary = aggregateAnalytics([]);
    expect(summary.totalReports).toBe(0);
    expect(summary.coordinateCoverage).toEqual({ withCoordinates: 0, withoutCoordinates: 0 });
    expect(summary.recurringHotspots).toEqual([]);
  });
});

describe("analytics endpoint", () => {
  it("requires auth, validates filters, applies date/category filters, and isolates owners", async () => {
    const users = new MemoryUserRepository(); const incidents = new MemoryIncidentRepository(); const app = createApp(config, undefined, { users, incidents });
    expect((await request(app).get("/api/analytics/summary")).status).toBe(401);
    const first = request.agent(app); const second = request.agent(app);
    await first.post("/api/auth/register").send({ name: "One", email: "analytics-one@example.com", password: "password123" });
    await second.post("/api/auth/register").send({ name: "Two", email: "analytics-two@example.com", password: "password123" });
    const own = await first.post("/api/incidents").send({ title: "Own", description: "Own", category: "pothole", address: "A", latitude: 10, longitude: 20 });
    const old = await first.post("/api/incidents").send({ title: "Old", description: "Old", category: "garbage", address: "B" });
    await second.post("/api/incidents").send({ title: "Private", description: "Private", category: "pothole", address: "C" });
    const ownRow = (await incidents.findById(own.body.incident.id))!; ownRow.createdAt = new Date("2025-01-15T00:00:00Z");
    const oldRow = (await incidents.findById(old.body.incident.id))!; oldRow.createdAt = new Date("2024-01-01T00:00:00Z");
    const filtered = await first.get("/api/analytics/summary?from=2025-01-01&to=2025-02-01&category=pothole");
    expect(filtered.status).toBe(200); expect(filtered.body.totalReports).toBe(1); expect(filtered.body.categoryBreakdown.find((item: { category: string }) => item.category === "pothole").count).toBe(1);
    expect((await first.get("/api/analytics/summary?from=bad")).status).toBe(400);
    expect((await first.get("/api/analytics/summary?from=2025-03-01&to=2025-02-01")).status).toBe(400);
    expect((await second.get("/api/analytics/summary")).body.totalReports).toBe(1);
  });
});
