import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Hotspot, HotspotPoint } from "../src/types";
import { buildTestApp, createFailingMl, createFakeMl, makeReport } from "./helpers";

interface HotspotsBody {
  hotspots: Hotspot[];
  source: string;
}

describe("GET /hotspots", () => {
  it("uses the ML service and sends only open reports as points", async () => {
    const captured: { points: HotspotPoint[]; radiusM: number; minPoints: number }[] = [];
    const hotspot: Hotspot = {
      center_lat: 21.25,
      center_lng: 81.63,
      count: 3,
      radius_m: 120,
      report_ids: ["a", "b", "c"],
      critical_count: 1,
    };
    const ml = createFakeMl({
      hotspots: async (points, radiusM, minPoints) => {
        captured.push({ points, radiusM, minPoints });
        return [hotspot];
      },
    });
    const { app, repo } = buildTestApp({ ml });
    const first = await repo.create(makeReport({ severity: "critical", lat: 21.25, lng: 81.63 }));
    const second = await repo.create(makeReport({ severity: "low", lat: 21.26, lng: 81.64 }));
    await repo.create(
      makeReport({ status: "resolved", resolved_at: new Date().toISOString() }),
    );

    const res = await request(app).get("/hotspots?radius_m=500&min_points=4");
    const body = res.body as HotspotsBody;

    expect(res.status).toBe(200);
    expect(body.source).toBe("ml");
    expect(body.hotspots).toEqual([hotspot]);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.radiusM).toBe(500);
    expect(captured[0]?.minPoints).toBe(4);
    expect(captured[0]?.points).toEqual([
      { id: first.id, lat: 21.25, lng: 81.63, severity: "critical" },
      { id: second.id, lat: 21.26, lng: 81.64, severity: "low" },
    ]);
  });

  it("applies the documented defaults (300 m, 3 points)", async () => {
    const captured: { radiusM: number; minPoints: number }[] = [];
    const ml = createFakeMl({
      hotspots: async (_points, radiusM, minPoints) => {
        captured.push({ radiusM, minPoints });
        return [];
      },
    });
    const { app } = buildTestApp({ ml });

    await request(app).get("/hotspots");

    expect(captured).toEqual([{ radiusM: 300, minPoints: 3 }]);
  });

  it("falls back to local clustering when the ML service is down", async () => {
    const { app, repo } = buildTestApp({ ml: createFailingMl() });
    const clusterCoordinates: [number, number, "critical" | "low"][] = [
      [21.25, 81.6, "low"],
      [21.2501, 81.6001, "critical"],
      [21.2502, 81.60005, "low"],
      [21.25005, 81.6002, "low"],
    ];
    const clusterIds: string[] = [];
    for (const [lat, lng, severity] of clusterCoordinates) {
      const created = await repo.create(makeReport({ lat, lng, severity }));
      clusterIds.push(created.id);
    }
    // A distant open report and a resolved report next to the cluster must not join it.
    await repo.create(makeReport({ lat: 21.27, lng: 81.63 }));
    await repo.create(
      makeReport({
        lat: 21.25,
        lng: 81.6,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }),
    );

    const res = await request(app).get("/hotspots");
    const body = res.body as HotspotsBody;

    expect(res.status).toBe(200);
    expect(body.source).toBe("local");
    expect(body.hotspots).toHaveLength(1);
    expect(body.hotspots[0]?.count).toBe(4);
    expect(body.hotspots[0]?.critical_count).toBe(1);
    expect([...(body.hotspots[0]?.report_ids ?? [])].sort()).toEqual([...clusterIds].sort());
    expect(body.hotspots[0]?.center_lat).toBeCloseTo(21.250113, 4);
  });

  it("returns an empty list when there is nothing to cluster", async () => {
    const { app } = buildTestApp({ ml: createFailingMl() });

    const res = await request(app).get("/hotspots");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hotspots: [], source: "local" });
  });

  it.each(["radius_m=-5", "radius_m=0", "min_points=0", "min_points=abc"])(
    "rejects invalid query (%s)",
    async (query) => {
      const { app } = buildTestApp();
      const res = await request(app).get(`/hotspots?${query}`);
      expect(res.status).toBe(400);
    },
  );
});