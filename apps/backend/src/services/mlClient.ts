import type { z } from "zod";
import {
  classifyResponseSchema,
  duplicatesResponseSchema,
  hotspotsResponseSchema,
  severityResponseSchema,
} from "../schemas";
import type {
  ClassifyResult,
  DuplicateMatch,
  Hotspot,
  HotspotPoint,
  MlCandidate,
  SeverityResult,
} from "../types";

export interface MlClient {
  classify(description: string): Promise<ClassifyResult>;
  severity(description: string): Promise<SeverityResult>;
  duplicates(description: string, candidates: MlCandidate[]): Promise<DuplicateMatch[]>;
  hotspots(points: HotspotPoint[], radiusM: number, minPoints: number): Promise<Hotspot[]>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface HttpMlClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

export class MlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MlError";
  }
}

export function createHttpMlClient(options: HttpMlClientOptions): MlClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));

  async function post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (options.apiKey) headers["X-API-Key"] = options.apiKey;

      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new MlError(`ML ${path} responded with HTTP ${response.status}`);
      }
      const json: unknown = await response.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new MlError(`ML ${path} returned a malformed body`);
      }
      return parsed.data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    classify: (description) => post("/classify", { description }, classifyResponseSchema),
    severity: (description) => post("/severity", { description }, severityResponseSchema),
    duplicates: async (description, candidates) => {
      const result = await post(
        "/duplicates",
        { description, candidates },
        duplicatesResponseSchema,
      );
      return result.candidates;
    },
    hotspots: async (points, radiusM, minPoints) => {
      const result = await post(
        "/hotspots",
        { points, radius_m: radiusM, min_points: minPoints },
        hotspotsResponseSchema,
      );
      return result.hotspots;
    },
  };
}