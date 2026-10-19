import { Router, type Response } from "express";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { categories } from "../domain.js";
import type { IncidentRepository, UserRepository } from "../domain.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
const fields = { title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(5000), category: z.enum(categories), address: z.string().trim().min(1).max(500), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), imageUrl: z.string().url().max(2000).optional() };
const createSchema = z.object(fields).strict();
const updateSchema = z.object(fields).partial().strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");
const invalid = (res: Response) => res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request" } });
export function incidentRoutes(config: AppConfig, users: UserRepository, incidents: IncidentRepository): Router { const router = Router(); router.use(authMiddleware(config.jwtSecret, users));
  router.post("/", async (req, res) => { const parsed = createSchema.safeParse(req.body); if (!parsed.success) return invalid(res); const incident = await incidents.create({ ...parsed.data, userId: (req as AuthRequest).userId!, status: "reported" }); return res.status(201).json({ incident }); });
  router.get("/", async (req, res) => res.json({ incidents: await incidents.listByUser((req as AuthRequest).userId!) }));
  router.get("/:id", async (req, res) => { const item = await incidents.findById(req.params.id); if (!item || item.userId !== (req as AuthRequest).userId) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Incident not found" } }); return res.json({ incident: item }); });
  router.patch("/:id", async (req, res) => { const parsed = updateSchema.safeParse(req.body); if (!parsed.success) return invalid(res); const item = await incidents.update(req.params.id, (req as AuthRequest).userId!, parsed.data); if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Incident not found" } }); return res.json({ incident: item }); });
  router.delete("/:id", async (req, res) => { if (!(await incidents.delete(req.params.id, (req as AuthRequest).userId!))) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Incident not found" } }); return res.status(204).send(); }); return router; }
