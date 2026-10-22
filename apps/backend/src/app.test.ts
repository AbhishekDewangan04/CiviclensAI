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
  it("allows credentialed requests and preflight only from configured origins", async () => {
    const app = createApp(config);
    const preflight = await request(app).options("/api/auth/register")
      .set("Origin", "https://allowed.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("https://allowed.example");
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");
    expect(preflight.headers["access-control-allow-methods"]).toContain("POST");
    expect((preflight.headers["access-control-allow-headers"] ?? "").toLowerCase()).toContain("content-type");
    const credentialed = await request(app).post("/api/auth/login").set("Origin", "https://allowed.example").send({ email: "x@example.com", password: "password123" });
    expect(credentialed.headers["access-control-allow-origin"]).toBe("https://allowed.example");
    expect(credentialed.headers["access-control-allow-credentials"]).toBe("true");
  });
  it("rejects invalid configuration", () => {
    expect(() => loadConfig({ CORS_ORIGINS: "", PORT: "0" })).toThrow("Invalid application configuration");
    expect(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "local-development-jwt-secret-change-me" })).toThrow("Invalid application configuration");
  });
});
