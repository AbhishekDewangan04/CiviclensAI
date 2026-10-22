import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { EvidenceRepository } from "./domain.js";
import { loadConfig } from "./config/env.js";
import { MemoryEvidenceRepository, MemoryIncidentRepository, MemoryUserRepository } from "./repositories/memory.js";

const config = loadConfig({ NODE_ENV: "test", PORT: "3000", CORS_ORIGINS: "http://localhost:5173", JSON_LIMIT: "10kb" });
const evidencePayload = { imageUrl: "https://images.example/evidence.jpg", description: "Fresh photo of the damaged sign" };

function setup(evidence: EvidenceRepository = new MemoryEvidenceRepository()) {
  return createApp(config, undefined, { users: new MemoryUserRepository(), incidents: new MemoryIncidentRepository(), evidence });
}
async function registeredAgent(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ name: "Reporter", email, password: "password123" });
  return agent;
}
async function createIncident(agent: ReturnType<typeof request.agent>) {
  const response = await agent.post("/api/incidents").send({ title: "Broken sign", description: "Sign is damaged", category: "other", address: "Main St" });
  return response.body.incident.id as string;
}

describe("phase five repair evidence", () => {
  it("requires authentication, validates evidence, and creates pending transparent evidence", async () => {
    const app = setup();
    expect((await request(app).post("/api/incidents/id/evidence").send(evidencePayload)).status).toBe(401);
    const agent = await registeredAgent(app, "evidence@example.com");
    const incidentId = await createIncident(agent);
    expect((await agent.post(`/api/incidents/${incidentId}/evidence`).send({ ...evidencePayload, imageUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await agent.post(`/api/incidents/${incidentId}/evidence`).send({ ...evidencePayload, description: "" })).status).toBe(400);
    const response = await agent.post(`/api/incidents/${incidentId}/evidence`).send(evidencePayload);
    expect(response.status).toBe(201);
    expect(response.body.evidence).toMatchObject({ ...evidencePayload, status: "pending", verification: { method: "rule_based_text_only", assessment: "image_analysis_unavailable" } });
    expect(response.body.evidence.submittedAt).toEqual(expect.any(String));
  });

  it("scopes evidence history and review to the incident owner", async () => {
    const app = setup();
    const owner = await registeredAgent(app, "owner@example.com");
    const other = await registeredAgent(app, "other@example.com");
    const incidentId = await createIncident(owner);
    const submitted = await owner.post(`/api/incidents/${incidentId}/evidence`).send(evidencePayload);
    const evidenceId = submitted.body.evidence.id;
    expect((await owner.get(`/api/incidents/${incidentId}/evidence`)).body.evidence).toHaveLength(1);
    expect((await other.get(`/api/incidents/${incidentId}/evidence`)).status).toBe(404);
    expect((await other.post(`/api/incidents/${incidentId}/evidence/${evidenceId}/review`).send({ status: "approved" })).status).toBe(404);
    const review = await owner.post(`/api/incidents/${incidentId}/evidence/${evidenceId}/review`).send({ status: "approved" });
    expect(review.status).toBe(403);
    expect(review.body.error.code).toBe("REVIEWER_REQUIRED");
  });

  it("returns a server error when the evidence repository fails", async () => {
    const failing: EvidenceRepository = {
      create: async () => { throw new Error("storage unavailable"); },
      listByIncident: async () => { throw new Error("storage unavailable"); },
    };
    const app = setup(failing);
    const agent = await registeredAgent(app, "failure@example.com");
    const incidentId = await createIncident(agent);
    expect((await agent.post(`/api/incidents/${incidentId}/evidence`).send(evidencePayload)).status).toBe(500);
    expect((await agent.get(`/api/incidents/${incidentId}/evidence`)).status).toBe(500);
  });
});
