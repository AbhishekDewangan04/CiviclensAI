import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import type { UserRepository } from "../domain.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
const credentials = z.object({ email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(8).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(100) });
const publicUser = (user: { id: string; email: string; name: string; role: string }) => ({ id: user.id, email: user.email, name: user.name, role: user.role });
const issue = (response: Response, message = "Invalid request") => response.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
export function authRoutes(config: AppConfig, users: UserRepository): Router { const router = Router(); const durationUnits: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }; const durationMatch = /^(\d+)([smhdw])$/.exec(config.jwtExpiresIn); const cookieMaxAge = durationMatch ? Number(durationMatch[1] ?? 7) * (durationUnits[durationMatch[2] ?? "d"] ?? 86400) : 604800; const cookie = (token: string) => `civiclens_token=${token}; HttpOnly; Path=/; Max-Age=${cookieMaxAge}; SameSite=${config.nodeEnv === "production" ? "Strict" : "Lax"}${config.nodeEnv === "production" ? "; Secure" : ""}`; router.use(rateLimit(config.authRateLimitWindowMs, config.authRateLimitMax));
  const signToken = (userId: string): string => { const expiresIn: NonNullable<jwt.SignOptions["expiresIn"]> = config.jwtExpiresIn as NonNullable<jwt.SignOptions["expiresIn"]>; return jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn }); };
  router.post("/register", async (req, res) => { const parsed = registration.safeParse(req.body); if (!parsed.success) return issue(res); if (await users.findByEmail(parsed.data.email)) return res.status(400).json({ error: { code: "REGISTRATION_FAILED", message: "Unable to register with these details" } }); const user = await users.create({ ...parsed.data, passwordHash: await bcrypt.hash(parsed.data.password, 12) }); res.setHeader("Set-Cookie", cookie(signToken(user.id))); return res.status(201).json({ user: publicUser(user) }); });
  router.post("/login", async (req, res) => { const parsed = credentials.safeParse(req.body); if (!parsed.success) return issue(res); const user = await users.findByEmail(parsed.data.email); if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }); res.setHeader("Set-Cookie", cookie(signToken(user.id))); return res.json({ user: publicUser(user) }); });
  router.post("/logout", (_req, res) => res.setHeader("Set-Cookie", `${cookie("")}; Max-Age=0`).status(204).send());
  router.get("/me", authMiddleware(config.jwtSecret, users), async (req, res) => { const user = await users.findById((req as AuthRequest).userId!); return user ? res.json({ user: publicUser(user) }) : res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }); }); return router; }
