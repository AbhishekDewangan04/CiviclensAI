import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig({ NODE_ENV: "test", PORT: "3000", CORS_ORIGINS: "https://allowed.example", JSON_LIMIT: "1kb" });

describe("phase one HTTP service", () => {
  it("reports health and readiness truthfully", async () => {
    let ready = false;
    const app = createApp(config, () => ready);
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ success: true, service: "civiclens-backend", status: "healthy" });
    expect((await request(app).get("/api/ready")).status).toBe(503);
    ready = true;
    expect((await request(app).get("/api/ready")).status).toBe(200);
  });
  it("returns JSON for unknown routes and malformed JSON", async () => {
    const app = createApp(config);
    expect((await request(app).get("/missing")).body.error.code).toBe("NOT_FOUND");
    const response = await request(app).post("/api/health").set("Content-Type", "application/json").send('{"broken":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
  it("sanitizes production errors and enforces CORS", async () => {
    const app = createApp(config);
    const allowed = await request(app).get("/api/health").set("Origin", "https://allowed.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://allowed.example");
    const denied = await request(app).get("/api/health").set("Origin", "https://denied.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    const oversized = await request(app).post("/api/health").set("Content-Type", "application/json").send(JSON.stringify({ value: "x".repeat(2_000) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.message).not.toContain("limit");
  });
  it("rejects invalid configuration", () => {
    expect(() => loadConfig({ CORS_ORIGINS: "", PORT: "0" })).toThrow("Invalid application configuration");
  });
});
