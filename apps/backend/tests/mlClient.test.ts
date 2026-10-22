import { describe, expect, it } from "vitest";
import { createHttpMlClient } from "../src/services/mlClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Recorded {
  url: string;
  init: RequestInit;
}

function recordingFetch(respond: () => Response) {
  const calls: Recorded[] = [];
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return respond();
  };
  return { calls, fetchImpl };
}

describe("createHttpMlClient", () => {
  it("posts JSON to the documented path and sends X-API-Key when configured", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      jsonResponse({ category: "garbage", score: 0.7, method: "keyword" }),
    );
    const client = createHttpMlClient({
      baseUrl: "http://ml.test/",
      apiKey: "secret-test-key",
      timeoutMs: 1000,
      fetchImpl,
    });

    const result = await client.classify("overflowing bin");

    expect(result).toEqual({ category: "garbage", score: 0.7, method: "keyword" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://ml.test/classify");
    expect(calls[0]?.init.method).toBe("POST");
    expect(new Headers(calls[0]?.init.headers).get("x-api-key")).toBe("secret-test-key");
    const sent: unknown = JSON.parse(String(calls[0]?.init.body));
    expect(sent).toEqual({ description: "overflowing bin" });
  });

  it("omits X-API-Key when no key is configured", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      jsonResponse({ severity: "low", score: 0.1, signals: [] }),
    );
    const client = createHttpMlClient({ baseUrl: "http://ml.test", timeoutMs: 1000, fetchImpl });

    await client.severity("minor crack");

    expect(new Headers(calls[0]?.init.headers).get("x-api-key")).toBeNull();
  });

  it("coerces unknown categories to other", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ category: "alien_invasion", score: 0.4, method: "model" }),
    );
    const client = createHttpMlClient({ baseUrl: "http://ml.test", timeoutMs: 1000, fetchImpl });

    expect((await client.classify("strange lights")).category).toBe("other");
  });

  it("unwraps duplicates and sends the documented hotspot body", async () => {
    const duplicates = recordingFetch(() =>
      jsonResponse({ candidates: [{ id: "a", similarity: 0.93 }] }),
    );
    const duplicatesClient = createHttpMlClient({
      baseUrl: "http://ml.test",
      timeoutMs: 1000,
      fetchImpl: duplicates.fetchImpl,
    });
    expect(await duplicatesClient.duplicates("text", [{ id: "a", text: "other text" }])).toEqual([
      { id: "a", similarity: 0.93 },
    ]);

    const hotspots = recordingFetch(() => jsonResponse({ hotspots: [] }));
    const hotspotsClient = createHttpMlClient({
      baseUrl: "http://ml.test",
      timeoutMs: 1000,
      fetchImpl: hotspots.fetchImpl,
    });
    await hotspotsClient.hotspots([{ id: "a", lat: 1, lng: 2, severity: "low" }], 300, 3);
    const sent: unknown = JSON.parse(String(hotspots.calls[0]?.init.body));
    expect(hotspots.calls[0]?.url).toBe("http://ml.test/hotspots");
    expect(sent).toEqual({
      points: [{ id: "a", lat: 1, lng: 2, severity: "low" }],
      radius_m: 300,
      min_points: 3,
    });
  });

  it("rejects non-2xx responses", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ detail: "boom" }, 500));
    const client = createHttpMlClient({ baseUrl: "http://ml.test", timeoutMs: 1000, fetchImpl });

    await expect(client.classify("x")).rejects.toThrow();
  });

  it("rejects malformed bodies", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ nope: true }));
    const client = createHttpMlClient({ baseUrl: "http://ml.test", timeoutMs: 1000, fetchImpl });

    await expect(client.classify("x")).rejects.toThrow(/malformed/);
    await expect(client.severity("x")).rejects.toThrow(/malformed/);
  });

  it("aborts and rejects when the timeout elapses", async () => {
    const hangingFetch = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const client = createHttpMlClient({
      baseUrl: "http://ml.test",
      timeoutMs: 20,
      fetchImpl: hangingFetch,
    });

    await expect(client.classify("x")).rejects.toThrow("aborted");
  });
});