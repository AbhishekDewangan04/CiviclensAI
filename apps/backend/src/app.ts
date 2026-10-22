import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import {
  ApiError,
  asyncHandler,
  createErrorHandler,
  notFoundHandler,
} from "./middleware/errors";
import { createRateLimiter } from "./middleware/rateLimit";
import {
  actionBodySchema,
  createReportBodySchema,
  hotspotsQuerySchema,
  listQuerySchema,
  reporterKeySchema,
} from "./schemas";
import type { MlClient } from "./services/mlClient";
import { ReportService, toPublic } from "./services/reportService";
import type { ReportRepository } from "./store/repository";
import type { Logger } from "./types";

export interface AppDeps {
  repo: ReportRepository;
  ml: MlClient;
  corsOrigins: string[];
  logger: Logger;
  /** Defaults to 30 requests per minute per IP. */
  rateLimit?: { max: number; windowMs: number };
  now?: () => Date;
}

function requireReporterKey(req: Request): string {
  const parsed = reporterKeySchema.safeParse(req.header("x-reporter-key"));
  if (!parsed.success) {
    throw new ApiError(
      400,
      "validation_error",
      "X-Reporter-Key header is required and must be 16-128 characters",
    );
  }
  return parsed.data;
}

function optionalReporterKey(req: Request): string | undefined {
  const value = req.header("x-reporter-key");
  return value === undefined || value === "" ? undefined : value;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  const service = new ReportService({
    repo: deps.repo,
    ml: deps.ml,
    logger: deps.logger,
    now: deps.now ?? (() => new Date()),
  });
  const limiter = createRateLimiter(deps.rateLimit ?? { max: 30, windowMs: 60_000 });

  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: deps.corsOrigins,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Reporter-Key"],
      exposedHeaders: ["Retry-After"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post(
    "/reports",
    limiter,
    asyncHandler(async (req, res) => {
      const key = requireReporterKey(req);
      const input = createReportBodySchema.parse(req.body);
      const { report, duplicates, ml_status } = await service.createReport(input, key);
      res.status(201).json({ report: toPublic(report, key), duplicates, ml_status });
    }),
  );

  app.get(
    "/reports",
    asyncHandler(async (req, res) => {
      const query = listQuerySchema.parse(req.query);
      res.json(await service.list(query, optionalReporterKey(req)));
    }),
  );

  // Must be registered before /reports/:id so "stats" is not treated as an id.
  app.get(
    "/reports/stats",
    asyncHandler(async (_req, res) => {
      res.json(await service.stats());
    }),
  );

  app.get(
    "/reports/:id",
    asyncHandler(async (req, res) => {
      const report = await service.get(req.params.id);
      res.json(toPublic(report, optionalReporterKey(req)));
    }),
  );

  app.post(
    "/reports/:id/action",
    limiter,
    asyncHandler(async (req, res) => {
      const key = requireReporterKey(req);
      const { action } = actionBodySchema.parse(req.body);
      const report = await service.applyAction(req.params.id, action, key);
      res.json({ report: toPublic(report, key) });
    }),
  );

  app.get(
    "/hotspots",
    asyncHandler(async (req, res) => {
      const { radius_m, min_points } = hotspotsQuerySchema.parse(req.query);
      res.json(await service.getHotspots(radius_m, min_points));
    }),
  );

  app.get(
    "/briefing",
    asyncHandler(async (_req, res) => {
      res.json(await service.getBriefing());
    }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}