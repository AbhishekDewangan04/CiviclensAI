import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { toPublic } from "../src/services/reportService";
import type { PublicReport } from "../src/types";
import { buildTestApp, KEY_A, KEY_B, makeReport, postReport, validReportBody } from "./helpers";

describe("reporter_key confidentiality", () => {
  it("never appears in any API response", async () => {
    const { app } = buildTestApp();

    const created = await postReport(app, validReportBody, KEY_A);
    const id = (created.body as { report: PublicReport }).report.id;

    const responses = [
      created,
      await request(app).get("/reports").set("X-Reporter-Key", KEY_A),
      await request(app).get("/reports"),
      await request(app).get(`/reports/${id}`).set("X-Reporter-Key", KEY_B),
      await request(app).get(`/reports/${id}`),
      await request(app)
        .post(`/reports/${id}/action`)
        .set("X-Reporter-Key", KEY_B)
        .send({ action: "resolve" }),
      await request(app)
        .post(`/reports/${id}/action`)
        .set("X-Reporter-Key", KEY_A)
        .send({ action: "resolve" }),
      await request(app).get("/reports/stats"),
      await request(app).get("/hotspots"),
      await request(app).get("/briefing"),
      await request(app).get(`/reports/${randomUUID()}`),
    ];

    for (const res of responses) {
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain(KEY_A);
      expect(serialized).not.toContain(KEY_B);
      expect(serialized).not.toContain("reporter_key");
    }
  });

  it("toPublic strips the key and computes is_mine", () => {
    const report = makeReport({ reporter_key: KEY_A });

    const mine = toPublic(report, KEY_A);
    const theirs = toPublic(report, KEY_B);

    expect(Object.keys(mine)).not.toContain("reporter_key");
    expect(Object.keys(theirs)).not.toContain("reporter_key");
    expect(mine.is_mine).toBe(true);
    expect(theirs.is_mine).toBe(false);
  });
});

describe("is_mine", () => {
  it("is true only for the owning reporter key", async () => {
    const { app } = buildTestApp();
    const created = await postReport(app, validReportBody, KEY_A);
    const body = created.body as { report: PublicReport };
    const id = body.report.id;

    expect(body.report.is_mine).toBe(true);

    const asOwner = await request(app).get(`/reports/${id}`).set("X-Reporter-Key", KEY_A);
    const asOther = await request(app).get(`/reports/${id}`).set("X-Reporter-Key", KEY_B);
    const asAnonymous = await request(app).get(`/reports/${id}`);
    const withOddLengthKey = await request(app)
      .get(`/reports/${id}`)
      .set("X-Reporter-Key", "x".repeat(40));

    expect((asOwner.body as PublicReport).is_mine).toBe(true);
    expect((asOther.body as PublicReport).is_mine).toBe(false);
    expect((asAnonymous.body as PublicReport).is_mine).toBe(false);
    expect((withOddLengthKey.body as PublicReport).is_mine).toBe(false);
  });
});