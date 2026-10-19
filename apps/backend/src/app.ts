import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "./config/env.js";
import { errorHandler, malformedJson, notFound } from "./middleware/errors.js";
import { requestLogger } from "./middleware/logging.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { incidentRoutes } from "./routes/incidents.js";
import type { IncidentRepository, UserRepository } from "./domain.js";
import { MemoryIncidentRepository, MemoryUserRepository } from "./repositories/memory.js";

export type AppRepositories = { users: UserRepository; incidents: IncidentRepository };
export function createApp(config: AppConfig, isReady: () => boolean = () => true, repositories: AppRepositories = { users: new MemoryUserRepository(), incidents: new MemoryIncidentRepository() }): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: [...config.corsOrigins], optionsSuccessStatus: 204 }));
  app.use(express.json({ limit: config.jsonLimit }));
  app.use(requestLogger);
  app.use("/api", healthRoutes(isReady));
  app.use("/api/auth", authRoutes(config, repositories.users));
  app.use("/api/incidents", incidentRoutes(config, repositories.users, repositories.incidents));
  app.use(malformedJson);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
