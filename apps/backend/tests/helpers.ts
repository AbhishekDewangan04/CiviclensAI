import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import type { MlClient } from "../src/services/mlClient";
import { MemoryRepository } from "../src/store/memoryRepository";
import type { ReportRepository } from "../src/store/repository";
import type { Logger, Report } from "../src/types";

export const KEY_A = "reporter-key-aaaaaaaa-0001";
export const KEY_B = "reporter-key-bbbbbbbb-0002";
export const CENTER = { lat: 21.2514, lng: 81.6296 };

export const silentLogger: Logger = {
  warn: () => undefined,
  error: () => undefined,
};

export const validReportBody = {
  description: "Large pothole near the market",
  lat: CENTER.lat,
  lng: CENTER.lng,
};

export function createFakeMl(overrides: Partial<MlClient> = {}): MlClient {
  return {
    classify: async () => ({ category: "pothole", score: 0.9, method: "fake" }),
    severity: async () => ({ severity: "medium", score: 0.5, signals: ["fake-signal"] }),
    duplicates: async () => [],
    hotspots: async () => [],
    ...overrides,
  };
}

export function createFailingMl(): MlClient {
  const fail = async (): Promise<never> => {
    throw new Error("ml unavailable");
  };
  return { classify: fail, severity: fail, duplicates: fail, hotspots: fail };
}

interface TestAppOptions {
  ml?: MlClient;
  repo?: ReportRepository;
  corsOrigins?: string[];
  rateLimit?: { max: number; windowMs: number };
}

export function buildTestApp(options: TestAppOptions = {}): {
  app: Express;
  repo: ReportRepository;
} {
  const repo = options.repo ?? new MemoryRepository();
  const app = createApp({
    repo,
    ml: options.ml ?? createFakeMl(),
    corsOrigins: options.corsOrigins ?? ["http://localhost:5173"],
    logger: silentLogger,
    rateLimit: options.rateLimit,
  });
  return { app, repo };
}

export function makeReport(overrides: Partial<Report> = {}): Report {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    description: "Sample report description",
    category: "pothole",
    severity: "low",
    status: "open",
    lat: CENTER.lat,
    lng: CENTER.lng,
    reporter_key: KEY_A,
    ml_status: "ok",
    ml_category_score: 0.5,
    severity_signals: [],
    created_at: now,
    updated_at: now,
    resolved_at: null,
    ...overrides,
  };
}

export function postReport(
  app: Express,
  body: Record<string, unknown>,
  key: string | null = KEY_A,
) {
  const req = request(app).post("/reports");
  if (key !== null) req.set("X-Reporter-Key", key);
  return req.send(body);
}

export function postAction(
  app: Express,
  id: string,
  body: Record<string, unknown>,
  key: string | null = KEY_A,
) {
  const req = request(app).post(`/reports/${id}/action`);
  if (key !== null) req.set("X-Reporter-Key", key);
  return req.send(body);
}