import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpMlClient } from "../src/services/mlClient";
import type { MlCandidate, PublicReport } from "../src/types";
import {
  buildTestApp,
  CENTER,
  createFailingMl,
  createFakeMl,
  KEY_A,
  makeReport,
  postReport,
  validReportBody,
} from "./helpers";

interface CreateBody {
  report: PublicReport;
  duplicates: { id: string; similarity: number }[];
  ml_status: string;
}

// Neutral text that matches no category keywords, so the backend's local
// classifier returns "other" and the ML result / safe defaults are what we test.
const NEUTRAL_DESCRIPTION = "Something unusual happened near the corner shop";

describe("POST /reports", () => {
  it("creates a report enriched by the ML service", async () => {
    const ml = createFakeMl({
      classify: async () => ({ category: "water_supply", score: 0.82, method: "fake" }),
      severity: async () => ({ severity: "critical", score: 0.9, signals: ["flooding"] }),
    });
    const { app } = buildTestApp({ ml });

    const res = await postReport(app, {
      ...validReportBody,
      description: NEUTRAL_DESCRIPTION,
      image_url: "https://example.com/photo.jpg",
    });
    const body = res.body as CreateBody;

    expect(res.status).toBe(201);
    expect(body.ml_status).toBe("ok");
    expect(body.duplicates).toEqual([]);
    expect(body.report.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(body.report.category).toBe("water_supply");
    expect(body.report.severity).toBe("critical");
    expect(body.report.severity_signals).toEqual(["flooding"]);
    expect(body.report.ml_status).toBe("ok");
    expect(body.report.ml_category_score).toBeCloseTo(0.82);
    expect(body.report.status).toBe("open");
    expect(body.report.resolved_at).toBeNull();
    expect(body.report.image_url).toBe("https://example.com/photo.jpg");
    expect(body.report.is_mine).toBe(true);
  });

  it("still returns 201 with safe defaults when the ML service throws", async () => {
    const { app, repo } = buildTestApp({ ml: createFailingMl() });

    const res = await postReport(app, {
      ...validReportBody,
      description: NEUTRAL_DESCRIPTION,
    });
    const body = res.body as CreateBody;

    expect(res.status).toBe(201);
    expect(body.ml_status).toBe("unavailable");
    expect(body.duplicates).toEqual([]);
    expect(body.report.category).toBe("other");
    expect(body.report.severity).toBe("low");
    expect(body.report.ml_category_score).toBeNull();
    expect(body.report.severity_signals).toEqual([]);
    expect(await repo.list()).toHaveLength(1);
  });

  it("still returns 201 when the ML service times out", async () => {
    const hangingFetch = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const ml = createHttpMlClient({
      baseUrl: "http://ml.invalid",
      timeoutMs: 25,
      fetchImpl: hangingFetch,
    });
    const { app } = buildTestApp({ ml });

    const res = await postReport(app, {
      ...validReportBody,
      description: NEUTRAL_DESCRIPTION,
    });
    const body = res.body as CreateBody;

    expect(res.status).toBe(201);
    expect(body.ml_status).toBe("unavailable");
    expect(body.report.category).toBe("other");
  });

  it("returns and flags duplicates among nearby open reports", async () => {
    const ml = createFakeMl({
      duplicates: async (_description, candidates) =>
        candidates.map((candidate) => ({ id: candidate.id, similarity: 0.9 })),
    });
    const { app } = buildTestApp({ ml });

    const first = await postReport(app, validReportBody);
    const firstId = (first.body as CreateBody).report.id;

    const second = await postReport(app, { ...validReportBody, lat: CENTER.lat + 0.0005 });
    const body = second.body as CreateBody;

    expect(second.status).toBe(201);
    expect(body.duplicates).toEqual([{ id: firstId, similarity: 0.9 }]);
  });

  it("only sends open reports within 200 m as duplicate candidates", async () => {
    const seen: MlCandidate[][] = [];
    const ml = createFakeMl({
      duplicates: async (_description, candidates) => {
        seen.push(candidates);
        return [];
      },
    });
    const { app, repo } = buildTestApp({ ml });

    const near = await repo.create(makeReport({ lat: CENTER.lat + 0.001 }));
    await repo.create(makeReport({ lat: CENTER.lat + 0.02 }));
    await repo.create(
      makeReport({ status: "resolved", resolved_at: new Date().toISOString() }),
    );

    const res = await postReport(app, validReportBody);

    expect(res.status).toBe(201);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.map((candidate) => candidate.id)).toEqual([near.id]);
    expect(seen[0]?.[0]?.text).toBe("Sample report description");
  });

  it("sends at most 50 candidates, nearest first", async () => {
    const seen: MlCandidate[][] = [];
    const ml = createFakeMl({
      duplicates: async (_description, candidates) => {
        seen.push(candidates);
        return [];
      },
    });
    const { app, repo } = buildTestApp({ ml });

    const ids: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      const created = await repo.create(makeReport({ lat: CENTER.lat + i * 0.00001 }));
      ids.push(created.id);
    }

    await postReport(app, validReportBody);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(50);
    expect(seen[0]?.map((candidate) => candidate.id)).toEqual(ids.slice(0, 50));
  });

  it.each([
    ["latitude above 90", { ...validReportBody, lat: 91 }],
    ["longitude below -180", { ...validReportBody, lng: -181 }],
    ["latitude that is not a number", { ...validReportBody, lat: "abc" }],
    ["a too-short description", { ...validReportBody, description: "hey" }],
    ["a too-long description", { ...validReportBody, description: "x".repeat(2001) }],
    ["missing coordinates", { description: "Large pothole near the market" }],
    ["a javascript: image_url", { ...validReportBody, image_url: "javascript:alert(1)" }],
    ["an ftp image_url", { ...validReportBody, image_url: "ftp://example.com/a.jpg" }],
    [
      "an overlong image_url",
      { ...validReportBody, image_url: `https://example.com/${"a".repeat(500)}` },
    ],
  ])("rejects %s with 400", async (_name, body) => {
    const { app, repo } = buildTestApp();

    const res = await postReport(app, body);
    const error = (res.body as { error: { code: string; message: string } }).error;

    expect(res.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(typeof error.message).toBe("string");
    expect(await repo.list()).toHaveLength(0);
  });

  it.each([
    ["missing", null],
    ["too short", "short-key"],
    ["too long", "k".repeat(129)],
  ])("rejects a reporter key that is %s with 400", async (_name, key) => {
    const { app, repo } = buildTestApp();

    const res = await postReport(app, validReportBody, key);

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe("validation_error");
    expect(await repo.list()).toHaveLength(0);
  });

  it("rejects malformed JSON with a 400 error envelope", async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post("/reports")
      .set("X-Reporter-Key", KEY_A)
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe("invalid_json");
  });
});