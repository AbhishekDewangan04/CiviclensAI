import request from "supertest";
import { describe, expect, it } from "vitest";
import type { PublicReport } from "../src/types";
import { buildTestApp, KEY_A, KEY_B, makeReport } from "./helpers";

interface ListBody {
  reports: PublicReport[];
  total: number;
}

describe("GET /reports", () => {
  it("filters by status, category and severity", async () => {
    const { app, repo } = buildTestApp();
    await repo.create(makeReport({ category: "pothole", severity: "low", status: "open" }));
    await repo.create(
      makeReport({
        category: "garbage",
        severity: "medium",
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }),
    );
    await repo.create(makeReport({ category: "streetlight", severity: "critical" }));

    const resolved = (await request(app).get("/reports?status=resolved")).body as ListBody;
    const garbage = (await request(app).get("/reports?category=garbage")).body as ListBody;
    const critical = (await request(app).get("/reports?severity=critical")).body as ListBody;
    const combined = (await request(app).get("/reports?status=open&category=pothole"))
      .body as ListBody;

    expect(resolved.total).toBe(1);
    expect(resolved.reports[0]?.status).toBe("resolved");
    expect(garbage.total).toBe(1);
    expect(garbage.reports[0]?.category).toBe("garbage");
    expect(critical.total).toBe(1);
    expect(critical.reports[0]?.severity).toBe("critical");
    expect(combined.total).toBe(1);
  });

  it("rejects invalid filter values with 400", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/reports?status=banana");
    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe("validation_error");
  });

  it("filters by mine=true using the X-Reporter-Key header", async () => {
    const { app, repo } = buildTestApp();
    await repo.create(makeReport({ reporter_key: KEY_A }));
    await repo.create(makeReport({ reporter_key: KEY_A }));
    await repo.create(makeReport({ reporter_key: KEY_B }));

    const mine = (await request(app).get("/reports?mine=true").set("X-Reporter-Key", KEY_A))
      .body as ListBody;
    const noKey = (await request(app).get("/reports?mine=true")).body as ListBody;
    const all = (await request(app).get("/reports").set("X-Reporter-Key", KEY_A)).body as ListBody;

    expect(mine.total).toBe(2);
    expect(mine.reports.every((report) => report.is_mine)).toBe(true);
    expect(noKey.total).toBe(0);
    expect(all.total).toBe(3);
    expect(all.reports.filter((report) => report.is_mine)).toHaveLength(2);
  });

  it("filters by bbox (inclusive) and validates it", async () => {
    const { app, repo } = buildTestApp();
    await repo.create(makeReport({ lat: 21.25, lng: 81.63 }));
    await repo.create(makeReport({ lat: 21.26, lng: 81.64 }));
    await repo.create(makeReport({ lat: 21.2, lng: 81.6 }));
    await repo.create(makeReport({ lat: 22.0, lng: 81.63 }));

    const inside = (await request(app).get("/reports?bbox=81.6,21.2,81.7,21.3")).body as ListBody;
    const malformed = await request(app).get("/reports?bbox=1,2,3");
    const reversed = await request(app).get("/reports?bbox=82,21.2,81,21.3");

    expect(inside.total).toBe(3);
    expect(malformed.status).toBe(400);
    expect(reversed.status).toBe(400);
  });

  it("returns newest first and paginates with limit and offset", async () => {
    const { app, repo } = buildTestApp();
    for (const i of [2, 0, 4, 1, 3]) {
      const createdAt = new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString();
      await repo.create(
        makeReport({ description: `Report number ${i}`, created_at: createdAt, updated_at: createdAt }),
      );
    }

    const all = (await request(app).get("/reports")).body as ListBody;
    const page = (await request(app).get("/reports?limit=2&offset=1")).body as ListBody;
    const beyond = (await request(app).get("/reports?offset=10")).body as ListBody;

    expect(all.reports.map((report) => report.description)).toEqual([
      "Report number 4",
      "Report number 3",
      "Report number 2",
      "Report number 1",
      "Report number 0",
    ]);
    expect(page.total).toBe(5);
    expect(page.reports.map((report) => report.description)).toEqual([
      "Report number 3",
      "Report number 2",
    ]);
    expect(beyond.total).toBe(5);
    expect(beyond.reports).toEqual([]);
  });

  it.each(["limit=0", "limit=501", "offset=-1", "limit=abc"])(
    "rejects invalid pagination (%s)",
    async (query) => {
      const { app } = buildTestApp();
      const res = await request(app).get(`/reports?${query}`);
      expect(res.status).toBe(400);
    },
  );
});