import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createHttpMlClient } from "../src/services/mlClient";
import { PostgresRepository } from "../src/store/postgresRepository";

const config = loadConfig();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const app = createApp({
  repo: new PostgresRepository(databaseUrl),
  ml: createHttpMlClient({
    baseUrl: config.mlBaseUrl,
    apiKey: config.mlApiKey,
    timeoutMs: config.mlTimeoutMs,
  }),
  corsOrigins: config.corsOrigins,
  logger: console,
});

export default app;