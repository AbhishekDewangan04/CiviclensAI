import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PublicReport } from "../src/types";
import { buildTestApp, KEY_A, KEY_B, makeReport, postAction } from "./helpers";

const OLD = "2024-01-01T00:00:00.000Z";

interface ActionBody {
  report: PublicReport;
}

function errorCode(body: unknown): string {
  return (body as { error: { code: string } }).error.code;
}

describe("POST /reports/:id/action", () => {
  it("resolves an open report and reopens it again", async () => {
    const { app, repo } = buildTestApp();
    const report = await repo.create(
      makeReport({ reporter_key: KEY_A, created_at: OLD, updated_at: OLD }),
    );

    const resolved = await postAction(app, report.id, { action: "resolve" }, KEY_A);
    const resolvedBody = resolved.body as ActionBody;

    expect(resolved.status).toBe(200);
    expect(resolvedBody.report.status).toBe("resolved");
    expect(resolvedBody.report.resolved_at).not.toBeNull();
    expect(resolvedBody.report.updated_at).not.toBe(OLD);
    expect(resolvedBody.report.is_mine).toBe(true);
    expect((await repo.get(report.id))?.status).toBe("resolved");

    const reopened = await postAction(app, report.id, { action: "reopen" }, KEY_A);
    const reopenedBody = reopened.body as ActionBody;

    expect(reopened.status).toBe(200);
    expect(reopenedBody.report.status).toBe("open");
    expect(reopenedBody.report.resolved_at).toBeNull();
    expect((await repo.get(report.id))?.status).toBe("open");
  });

  it("returns 403 for a different reporter key and changes nothing", async () => {
    const { app, repo } = buildTestApp();
    const report = await repo.create(makeReport({ reporter_key: KEY_A }));

    const res = await postAction(app, report.id, { action: "resolve" }, KEY_B);

    expect(res.status).toBe(403);
    expect(errorCode(res.body)).toBe("forbidden");
    expect((await repo.get(report.id))?.status).toBe("open");
  });

  it("returns 403 (not a crash) for a key of a different length", async () => {
    const { app, repo } = buildTestApp();
    const report = await repo.create(makeReport({ reporter_key: KEY_A }));

    const res = await postAction(app, report.id, { action: "resolve" }, "x".repeat(100));

    expect(res.status).toBe(403);
    expect(errorCode(res.body)).toBe("forbidden");
  });

  it("returns 409 for invalid transitions", async () => {
    const { app, repo } = buildTestApp();
    const open = await repo.create(makeReport({ reporter_key: KEY_A }));
    const resolved = await repo.create(
      makeReport({
        reporter_key: KEY_A,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }),
    );

    const reopenOpen = await postAction(app, open.id, { action: "reopen" }, KEY_A);
    const resolveResolved = await postAction(app, resolved.id, { action: "resolve" }, KEY_A);

    expect(reopenOpen.status).toBe(409);
    expect(errorCode(reopenOpen.body)).toBe("invalid_transition");
    expect(resolveResolved.status).toBe(409);
    expect(errorCode(resolveResolved.body)).toBe("invalid_transition");
  });

  it("returns 404 for an unknown report", async () => {
    const { app } = buildTestApp();

    const res = await postAction(app, randomUUID(), { action: "resolve" }, KEY_A);

    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe("not_found");
  });

  it("returns 400 for a missing key or an unknown action", async () => {
    const { app, repo } = buildTestApp();
    const report = await repo.create(makeReport({ reporter_key: KEY_A }));

    const noKey = await postAction(app, report.id, { action: "resolve" }, null);
    const badAction = await postAction(app, report.id, { action: "delete" }, KEY_A);

    expect(noKey.status).toBe(400);
    expect(badAction.status).toBe(400);
    expect(errorCode(badAction.body)).toBe("validation_error");
  });
});

describe("GET /reports/:id", () => {
  it("returns 404 for an unknown id", async () => {
    const { app } = buildTestApp();
    const { default: request } = await import("supertest");

    const res = await request(app).get(`/reports/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe("not_found");
  });
});