import path from "node:path";
import { createApp } from "./app";
import { loadConfig, loadDotEnvFile, type Config } from "./config";
import { createHttpMlClient } from "./services/mlClient";
import { JsonFileRepository } from "./store/jsonFileRepository";

loadDotEnvFile(path.resolve(".env"));

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const repo = await JsonFileRepository.open(path.resolve(config.dataFile), console);
const ml = createHttpMlClient({
  baseUrl: config.mlBaseUrl,
  apiKey: config.mlApiKey,
  timeoutMs: config.mlTimeoutMs,
});
const app = createApp({ repo, ml, corsOrigins: config.corsOrigins, logger: console });

const server = app.listen(config.port, () => {
  console.log(`CivicLens backend listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${config.port} is already in use`
      : `Server error: ${error.message}`,
  );
  process.exit(1);
});