import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers";

describe("GET /health", () => {
  it("returns ok", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "not_found", message: "Route not found" } });
  });
});