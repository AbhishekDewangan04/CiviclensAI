import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "./config/env.js";
import { errorHandler, malformedJson, notFound } from "./middleware/errors.js";
import { requestLogger } from "./middleware/logging.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { incidentRoutes } from "./routes/incidents.js";
import type { IncidentRepository, UserRepository } from "./domain.js";
import { MemoryEvidenceRepository, MemoryIncidentRepository, MemoryUserRepository } from "./repositories/memory.js";
import { FetchIntelligenceClient, type IntelligenceClient } from "./intelligence.js";
import { intelligenceRoutes } from "./routes/intelligence.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { EvidenceService } from "./evidence.js";
import type { EvidenceRepository } from "./domain.js";

export type AppRepositories = { users: UserRepository; incidents: IncidentRepository; evidence?: EvidenceRepository };
export function createApp(config: AppConfig, isReady: () => boolean = () => true, repositories: AppRepositories = { users: new MemoryUserRepository(), incidents: new MemoryIncidentRepository(), evidence: new MemoryEvidenceRepository() }, intelligence: IntelligenceClient = new FetchIntelligenceClient(config)): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({
    origin: [...config.corsOrigins],
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Content-Type"],
    optionsSuccessStatus: 204,
  }));
  app.use(express.json({ limit: config.jsonLimit }));
  app.use(requestLogger);
  app.use("/api", healthRoutes(isReady));
  app.use("/api/auth", authRoutes(config, repositories.users));
  app.use("/api/incidents", incidentRoutes(config, repositories.users, repositories.incidents, intelligence, new EvidenceService(repositories.evidence ?? new MemoryEvidenceRepository())));
  app.use("/api/intelligence", intelligenceRoutes(config, repositories.users, repositories.incidents, intelligence));
  app.use("/api/analytics", analyticsRoutes(config, repositories.users, repositories.incidents));
  app.use(malformedJson);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
