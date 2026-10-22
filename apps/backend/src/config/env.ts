import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  CORS_ORIGINS: z.string().default("http://localhost:5176,http://localhost:5173"),
  JSON_LIMIT: z.string().default("100kb"),
  JWT_SECRET: z.string().min(16).default("local-development-jwt-secret-change-me"),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhdw]$/, "JWT_EXPIRES_IN must use a duration such as 15m or 7d").default("7d"),
  MONGODB_URI: z.string().optional(),
  ML_SERVICE_BASE_URL: z.string().url().default("http://localhost:8000"),
  ML_TIMEOUT_MS: z.coerce.number().int().min(50).max(30000).default(1000),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(86400000).default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(100),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigins: readonly string[];
  jsonLimit: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  mongodbUri?: string;
  mlServiceBaseUrl: string;
  mlTimeoutMs: number;
  authRateLimitWindowMs: number;
  authRateLimitMax: number;
};

export class ConfigError extends Error {
  public readonly issues: z.ZodIssue[];

  public constructor(issues: z.ZodIssue[]) {
    super("Invalid application configuration");
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) throw new ConfigError(parsed.error.issues);
  const origins = parsed.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) throw new ConfigError([{ code: "custom", path: ["CORS_ORIGINS"], message: "At least one origin is required" }]);
  if (parsed.data.NODE_ENV === "production" && parsed.data.JWT_SECRET === "local-development-jwt-secret-change-me") throw new ConfigError([{ code: "custom", path: ["JWT_SECRET"], message: "JWT_SECRET must be set in production" }]);
  return { nodeEnv: parsed.data.NODE_ENV, port: parsed.data.PORT, corsOrigins: origins, jsonLimit: parsed.data.JSON_LIMIT, jwtSecret: parsed.data.JWT_SECRET, jwtExpiresIn: parsed.data.JWT_EXPIRES_IN, mlServiceBaseUrl: parsed.data.ML_SERVICE_BASE_URL, mlTimeoutMs: parsed.data.ML_TIMEOUT_MS, authRateLimitWindowMs: parsed.data.AUTH_RATE_LIMIT_WINDOW_MS, authRateLimitMax: parsed.data.AUTH_RATE_LIMIT_MAX, ...(parsed.data.MONGODB_URI ? { mongodbUri: parsed.data.MONGODB_URI } : {}) };
}
