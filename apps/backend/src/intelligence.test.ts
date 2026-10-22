import { describe, expect, it } from "vitest";
import { loadConfig } from "./config/env.js";
import { FetchIntelligenceClient } from "./intelligence.js";

describe("ML client reliability", () => {
  it("rejects an unavailable ML service within the configured boundary", async () => {
    const config = loadConfig({ NODE_ENV: "test", ML_SERVICE_BASE_URL: "http://127.0.0.1:9", ML_TIMEOUT_MS: "50" });
    await expect(new FetchIntelligenceClient(config).suggest("pothole", [])).rejects.toBeInstanceOf(Error);
  });
});
