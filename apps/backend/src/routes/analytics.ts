import { Router, type Response } from "express";
import { z } from "zod";
import { aggregateAnalytics } from "../analytics.js";
import { categories, type IncidentRepository, type UserRepository } from "../domain.js";
import type { AppConfig } from "../config/env.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const isoDate = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date").refine((value) => { const parsed = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value; }, "Expected a real calendar date")]);
const querySchema = z.object({ from: isoDate.optional(), to: isoDate.optional(), category: z.enum(categories).optional() }).strict().refine((value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to), { message: "from must be before or equal to to" });
const invalid = (res: Response) => res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid analytics filters" } });

/** `from` is inclusive and `to` is exclusive; both are ISO-8601 timestamps. */
const parseDate = (value: string, end = false) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value); const date = new Date(`${value}T00:00:00.000Z`); if (end) date.setUTCDate(date.getUTCDate() + 1); return date; };
/** `from` is inclusive and `to` is exclusive. Date-only values use UTC midnight (and `to` advances one day). */
export function analyticsRoutes(config: AppConfig, users: UserRepository, incidents: IncidentRepository): Router { const router = Router(); router.use(authMiddleware(config.jwtSecret, users)); router.get("/summary", async (req, res) => { const parsed = querySchema.safeParse(req.query); if (!parsed.success) return invalid(res); const query = { ...(parsed.data.from ? { from: parseDate(parsed.data.from) } : {}), ...(parsed.data.to ? { to: parseDate(parsed.data.to, true) } : {}), ...(parsed.data.category ? { category: parsed.data.category } : {}) }; const rows = await incidents.listByUserFiltered((req as AuthRequest).userId!, query); return res.json(aggregateAnalytics(rows)); }); return router; }
