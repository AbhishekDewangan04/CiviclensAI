import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3001);
    expect(config.corsOrigins).toEqual(["http://localhost:5173"]);
    expect(config.mlBaseUrl).toBe("http://localhost:8000");
    expect(config.mlApiKey).toBeUndefined();
    expect(config.mlTimeoutMs).toBe(2000);
    expect(config.dataFile).toBe("./data/reports.json");
  });

  it("parses lists, trims trailing slashes and treats empty values as unset", () => {
    const config = loadConfig({
      CORS_ORIGINS: "http://a.test/, http://b.test",
      ML_API_KEY: "",
      PORT: "4000",
    });

    expect(config.corsOrigins).toEqual(["http://a.test", "http://b.test"]);
    expect(config.mlApiKey).toBeUndefined();
    expect(config.port).toBe(4000);
  });

  it("fails fast with a message naming the bad variable", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(/PORT/);
    expect(() => loadConfig({ ML_BASE_URL: "nonsense" })).toThrow(/ML_BASE_URL/);
  });
});