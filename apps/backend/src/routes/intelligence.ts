import { Router, type Response } from "express";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { categories, type Category, type IncidentRepository, type UserRepository } from "../domain.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { unavailableSuggestion, type IntelligenceClient } from "../intelligence.js";

const requestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  category: z.enum(categories),
  address: z.string().trim().min(1).max(500),
}).strict();

type PublicSuggestion = {
  predictedCategory?: Category;
  categoryConfidence?: number;
  duplicateReports: Array<{ id: string; title: string; similarityScore: number; address: string; status: string }>;
};

const invalid = (response: Response) => response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request" } });

export function intelligenceRoutes(config: AppConfig, users: UserRepository, incidents: IncidentRepository, intelligence: IntelligenceClient): Router {
  const router = Router();
  router.use(authMiddleware(config.jwtSecret, users));
  router.post("/suggestions", async (request, response) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return invalid(response);
    const userId = (request as AuthRequest).userId!;
    try {
      const ownIncidents = await incidents.listByUser(userId);
      const raw = await intelligence.suggest(parsed.data.description, ownIncidents.map((item) => ({ id: item.id, text: `${item.title} ${item.description} ${item.address}` })));
      const byId = new Map(ownIncidents.map((item) => [item.id, item]));
      const suggestions: PublicSuggestion = {
        ...(raw.category ? { predictedCategory: raw.category.category, categoryConfidence: raw.category.score } : {}),
        duplicateReports: raw.duplicates.flatMap((match) => {
          const incident = byId.get(match.id);
          return incident ? [{ id: incident.id, title: incident.title, similarityScore: match.similarity, address: incident.address, status: incident.status }] : [];
        }),
      };
      return response.json({ suggestions });
    } catch {
      const fallback = unavailableSuggestion();
      return response.json({ suggestions: { duplicateReports: fallback.duplicates } });
    }
  });
  return router;
}
