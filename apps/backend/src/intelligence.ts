import { z } from "zod";
import type { AppConfig } from "./config/env.js";

const classification = z.object({ category: z.enum(["pothole", "garbage", "water_supply", "streetlight", "drainage", "other"]), score: z.number().min(0).max(1), method: z.literal("keyword") }).strict();
const duplicates = z.object({ candidates: z.array(z.object({ id: z.string(), similarity: z.number().min(0).max(1) }).strict()).max(5) }).strict();
export type IntelligenceSuggestion = { category?: z.infer<typeof classification>; duplicates: Array<{ id: string; similarity: number }> };
export type IntelligenceClient = { suggest(description: string, candidates: Array<{ id: string; text: string }>): Promise<IntelligenceSuggestion> };

export class FetchIntelligenceClient implements IntelligenceClient {
  public constructor(private readonly config: AppConfig) {}
  async suggest(description: string, candidates: Array<{ id: string; text: string }>): Promise<IntelligenceSuggestion> {
    const signal = AbortSignal.timeout(this.config.mlTimeoutMs);
    const base = this.config.mlServiceBaseUrl.replace(/\/$/, "");
    const post = async (path: string, body: unknown) => { const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }); if (!response.ok) throw new Error(`ML service returned ${response.status}`); return response.json(); };
    const [rawClassification, rawDuplicates] = await Promise.all([post("/classify", { description }), post("/duplicates", { description, candidates })]);
    return { category: classification.parse(rawClassification), duplicates: duplicates.parse(rawDuplicates).candidates };
  }
}

export const unavailableSuggestion = (): IntelligenceSuggestion => ({ duplicates: [] });
