import { readFileSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  ML_BASE_URL: z.string().url().default("http://localhost:8000"),
  ML_API_KEY: z.string().optional(),
  ML_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(2000),
  DATA_FILE: z.string().min(1).default("./data/reports.json"),
});

export interface Config {
  port: number;
  nodeEnv: "development" | "production" | "test";
  corsOrigins: string[];
  mlBaseUrl: string;
  mlApiKey?: string;
  mlTimeoutMs: number;
  dataFile: string;
}

/**
 * Minimal .env reader (KEY=VALUE per line, optional quotes, # comment lines).
 * Variables already present in the environment win. A missing file is fine.
 */
export function loadDotEnvFile(filePath: string, env: NodeJS.ProcessEnv = process.env): void {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    if (env[key] === undefined) env[key] = value;
  }
}

/** Validates the environment. Empty values are treated as unset. Throws a readable Error. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value.trim() !== "") cleaned[key] = value.trim();
  }

  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const parsed = result.data;
  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    corsOrigins: parsed.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter((origin) => origin.length > 0),
    mlBaseUrl: parsed.ML_BASE_URL,
    mlApiKey: parsed.ML_API_KEY,
    mlTimeoutMs: parsed.ML_TIMEOUT_MS,
    dataFile: parsed.DATA_FILE,
  };
}