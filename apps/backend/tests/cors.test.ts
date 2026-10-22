import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers";

describe("CORS", () => {
  it("allows a configured origin", async () => {
    const { app } = buildTestApp({ corsOrigins: ["http://localhost:5173"] });

    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not add CORS headers for a disallowed origin", async () => {
    const { app } = buildTestApp({ corsOrigins: ["http://localhost:5173"] });

    const res = await request(app).get("/health").set("Origin", "http://evil.example");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers preflight requests allowing X-Reporter-Key and the documented methods", async () => {
    const { app } = buildTestApp({ corsOrigins: ["http://localhost:5173"] });

    const res = await request(app)
      .options("/reports")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-reporter-key");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-headers"]).toMatch(/x-reporter-key/i);
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,OPTIONS");
  });
});