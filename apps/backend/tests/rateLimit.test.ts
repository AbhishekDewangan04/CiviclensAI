import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp, KEY_A, postReport, validReportBody } from "./helpers";

describe("rate limiting", () => {
  it("returns 429 with Retry-After once the limit is exceeded", async () => {
    const { app } = buildTestApp({ rateLimit: { max: 3, windowMs: 60_000 } });

    for (let i = 0; i < 3; i += 1) {
      const ok = await postReport(app, validReportBody);
      expect(ok.status).toBe(201);
    }

    const limited = await postReport(app, validReportBody);

    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toMatch(/^\d+$/);
    expect((limited.body as { error: { code: string } }).error.code).toBe("rate_limited");
  });

  it("shares the limit with the action endpoint and does not limit reads", async () => {
    const { app } = buildTestApp({ rateLimit: { max: 1, windowMs: 60_000 } });

    await postReport(app, validReportBody);
    const action = await request(app)
      .post(`/reports/${randomUUID()}/action`)
      .set("X-Reporter-Key", KEY_A)
      .send({ action: "resolve" });
    const health = await request(app).get("/health");
    const list = await request(app).get("/reports");

    expect(action.status).toBe(429);
    expect(health.status).toBe(200);
    expect(list.status).toBe(200);
  });
});