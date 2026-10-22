// src/app.ts
import cors from "cors";
import express from "express";
import helmet from "helmet";

// src/middleware/errors.ts
import { ZodError } from "zod";
var ApiError = class extends Error {
  status;
  code;
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
};
function asyncHandler(handler) {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
var notFoundHandler = (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
};
function describeZodError(error) {
  return error.issues.map(
    (issue) => issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message
  ).join("; ");
}
function readBodyParserError(error) {
  if (typeof error !== "object" || error === null) return void 0;
  if (!("status" in error) || !("type" in error)) return void 0;
  const { status, type } = error;
  if (typeof status !== "number" || typeof type !== "string") return void 0;
  return { status, type };
}
function createErrorHandler(logger) {
  return (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        error: { code: "validation_error", message: describeZodError(error) }
      });
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const bodyError = readBodyParserError(error);
    if (bodyError && bodyError.status >= 400 && bodyError.status < 500) {
      if (bodyError.type === "entity.too.large") {
        res.status(413).json({
          error: { code: "payload_too_large", message: "Request body is too large" }
        });
        return;
      }
      if (bodyError.type === "entity.parse.failed") {
        res.status(400).json({
          error: { code: "invalid_json", message: "Request body is not valid JSON" }
        });
        return;
      }
      res.status(400).json({
        error: { code: "invalid_request", message: "The request could not be processed" }
      });
      return;
    }
    logger.error(
      `Unhandled error: ${error instanceof Error ? error.message : "unknown error"}`
    );
    res.status(500).json({
      error: { code: "internal_error", message: "Internal server error" }
    });
  };
}

// src/middleware/rateLimit.ts
var PRUNE_THRESHOLD = 1e3;
function createRateLimiter(options) {
  const clock = options.now ?? (() => Date.now());
  const buckets = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const now = clock();
    if (buckets.size > PRUNE_THRESHOLD) {
      for (const [key2, bucket2] of buckets) {
        if (bucket2.resetAt <= now) buckets.delete(key2);
      }
    }
    const key = req.ip ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1e3));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: { code: "rate_limited", message: "Too many requests, please retry later." }
      });
      return;
    }
    next();
  };
}

// src/schemas.ts
import { z } from "zod";

// src/types.ts
var CATEGORIES = [
  "pothole",
  "garbage",
  "water_supply",
  "streetlight",
  "drainage",
  "other"
];
var SEVERITIES = ["low", "medium", "critical"];
var STATUSES = ["open", "resolved"];

// src/schemas.ts
var DEFAULT_HOTSPOT_RADIUS_M = 300;
var DEFAULT_HOTSPOT_MIN_POINTS = 3;
var categorySchema = z.enum(CATEGORIES);
var severitySchema = z.enum(SEVERITIES);
var statusSchema = z.enum(STATUSES);
var mlStatusSchema = z.enum(["ok", "unavailable"]);
function coerceCategory(value) {
  return CATEGORIES.includes(value) ? value : "other";
}
var reporterKeySchema = z.string().min(16).max(128);
var httpUrlSchema = z.string().max(500).refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "image_url must be an http or https URL" }
);
var createReportBodySchema = z.object({
  description: z.string().trim().min(5).max(2e3),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  image_url: httpUrlSchema.optional()
});
var actionBodySchema = z.object({
  action: z.enum(["resolve", "reopen"])
});
var bboxSchema = z.string().transform((value, ctx) => {
  const parts = value.split(",");
  const invalid = (message) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
  };
  if (parts.length !== 4 || parts.some((part) => part.trim() === "")) {
    return invalid("bbox must be minLng,minLat,maxLng,maxLat");
  }
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => !Number.isFinite(n))) {
    return invalid("bbox values must be numbers");
  }
  const [minLng, minLat, maxLng, maxLat] = numbers;
  if (minLng > maxLng || minLat > maxLat) {
    return invalid("bbox minimums must not exceed maximums");
  }
  return { minLng, minLat, maxLng, maxLat };
});
var listQuerySchema = z.object({
  status: statusSchema.optional(),
  category: categorySchema.optional(),
  severity: severitySchema.optional(),
  mine: z.enum(["true", "false"]).optional(),
  bbox: bboxSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});
var hotspotsQuerySchema = z.object({
  radius_m: z.coerce.number().positive().max(1e4).default(DEFAULT_HOTSPOT_RADIUS_M),
  min_points: z.coerce.number().int().min(1).max(1e3).default(DEFAULT_HOTSPOT_MIN_POINTS)
});
var reportSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: categorySchema,
  severity: severitySchema,
  status: statusSchema,
  lat: z.number(),
  lng: z.number(),
  image_url: z.string().optional(),
  reporter_key: z.string(),
  ml_status: mlStatusSchema,
  ml_category_score: z.number().nullable(),
  severity_signals: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable()
});
var classifyResponseSchema = z.object({
  category: z.string().transform(coerceCategory),
  score: z.number(),
  method: z.string()
});
var severityResponseSchema = z.object({
  severity: severitySchema,
  score: z.number(),
  signals: z.array(z.string())
});
var duplicatesResponseSchema = z.object({
  candidates: z.array(z.object({ id: z.string(), similarity: z.number() }))
});
var hotspotsResponseSchema = z.object({
  hotspots: z.array(
    z.object({
      center_lat: z.number(),
      center_lng: z.number(),
      count: z.number(),
      radius_m: z.number(),
      report_ids: z.array(z.string()),
      critical_count: z.number()
    })
  )
});

// src/services/reportService.ts
import { randomUUID, timingSafeEqual } from "node:crypto";

// src/services/briefing.ts
var MAX_TOP_CATEGORIES = 3;
var MAX_HOTSPOTS = 3;
var MAX_CRITICAL = 5;
var MAX_DESCRIPTION_LENGTH = 140;
var CATEGORY_LABELS = {
  pothole: "potholes",
  garbage: "garbage",
  water_supply: "water supply",
  streetlight: "streetlights",
  drainage: "drainage",
  other: "other issues"
};
function count(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}
function newestFirst(a, b) {
  if (a.created_at < b.created_at) return 1;
  if (a.created_at > b.created_at) return -1;
  return 0;
}
function toBriefingReport(report) {
  const description = report.description.length > MAX_DESCRIPTION_LENGTH ? `${report.description.slice(0, MAX_DESCRIPTION_LENGTH - 3)}...` : report.description;
  return {
    id: report.id,
    description,
    category: report.category,
    lat: report.lat,
    lng: report.lng,
    created_at: report.created_at
  };
}
function buildBriefing(reports, hotspots, now) {
  const total = reports.length;
  const open = reports.filter((report) => report.status === "open");
  const resolved = total - open.length;
  const criticalOpen = open.filter((report) => report.severity === "critical").sort(newestFirst);
  const critical = criticalOpen.length;
  const categoryCounts = /* @__PURE__ */ new Map();
  for (const report of open) {
    categoryCounts.set(report.category, (categoryCounts.get(report.category) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()].map(([category, n]) => ({ category, count: n })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, MAX_TOP_CATEGORIES);
  const topHotspots = [...hotspots].sort((a, b) => b.critical_count - a.critical_count || b.count - a.count).slice(0, MAX_HOTSPOTS);
  let headline;
  let summary;
  if (total === 0) {
    headline = "No reports yet";
    summary = "No civic reports have been filed yet. The map is clear.";
  } else if (open.length === 0) {
    headline = "All reported issues are resolved";
    summary = total === 1 ? "The only report filed has been resolved." : `All ${total} reports filed have been resolved.`;
  } else {
    headline = critical > 0 ? `${count(critical, "critical issue")} ${critical === 1 ? "needs" : "need"} attention` : `${count(open.length, "open report")} to review`;
    const verb = open.length === 1 ? "is" : "are";
    summary = `There ${verb} ${count(open.length, "open report")} (${total} filed in total, ${resolved} resolved).`;
    if (critical > 0) {
      summary += ` ${critical} ${critical === 1 ? "is" : "are"} critical.`;
    }
    const top = topCategories[0];
    if (top) {
      summary += ` Most frequent category: ${CATEGORY_LABELS[top.category]} (${top.count}).`;
    }
  }
  const recommendations = [];
  if (critical > 0) {
    recommendations.push(
      `Prioritise the ${count(critical, "critical report")} before routine work.`
    );
  }
  const firstHotspot = topHotspots[0];
  if (firstHotspot) {
    recommendations.push(
      `Schedule one combined visit per hotspot, starting with the area covering ${count(firstHotspot.count, "report")}.`
    );
  }
  const topCategory = topCategories[0];
  if (topCategory) {
    recommendations.push(
      `Consider a dedicated crew for ${CATEGORY_LABELS[topCategory.category]}, the most reported open category.`
    );
  }
  if (open.length === 0) {
    recommendations.push("No action needed right now; keep monitoring new reports.");
  }
  return {
    headline,
    summary,
    top_categories: topCategories,
    hotspots: topHotspots,
    critical_open: criticalOpen.slice(0, MAX_CRITICAL).map(toBriefingReport),
    recommendations,
    generated_at: now.toISOString(),
    source: "rules"
  };
}

// src/services/geo.ts
var EARTH_RADIUS_M = 63710088e-1;
var METERS_PER_DEGREE_LAT = Math.PI / 180 * EARTH_RADIUS_M;
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}
function withinBbox(lat, lng, bbox) {
  return lng >= bbox.minLng && lng <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat;
}
function localHotspots(points, radiusM, minPoints) {
  if (points.length === 0) return [];
  let minLat = Infinity;
  let minLng = Infinity;
  let latSum = 0;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    latSum += point.lat;
  }
  const meanLat = latSum / points.length;
  const latStep = radiusM / METERS_PER_DEGREE_LAT;
  const lngStep = radiusM / (METERS_PER_DEGREE_LAT * Math.max(Math.cos(toRadians(meanLat)), 0.01));
  const cells = /* @__PURE__ */ new Map();
  for (const point of points) {
    const key = `${Math.floor((point.lat - minLat) / latStep)}:${Math.floor((point.lng - minLng) / lngStep)}`;
    const members = cells.get(key);
    if (members) members.push(point);
    else cells.set(key, [point]);
  }
  const hotspots = [];
  for (const members of cells.values()) {
    if (members.length < minPoints) continue;
    const centerLat = members.reduce((sum, m) => sum + m.lat, 0) / members.length;
    const centerLng = members.reduce((sum, m) => sum + m.lng, 0) / members.length;
    let maxDistance = 0;
    for (const member of members) {
      maxDistance = Math.max(
        maxDistance,
        haversineMeters(centerLat, centerLng, member.lat, member.lng)
      );
    }
    hotspots.push({
      center_lat: centerLat,
      center_lng: centerLng,
      count: members.length,
      radius_m: Math.max(1, Math.round(maxDistance)),
      report_ids: members.map((member) => member.id),
      critical_count: members.filter((member) => member.severity === "critical").length
    });
  }
  return hotspots.sort((a, b) => b.count - a.count || b.critical_count - a.critical_count);
}

// src/services/reportService.ts
var DUPLICATE_RADIUS_M = 200;
var MAX_DUPLICATE_CANDIDATES = 50;
function safeEqual(a, b) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
function isOwner(report, requesterKey) {
  return requesterKey !== void 0 && safeEqual(requesterKey, report.reporter_key);
}
function toPublic(report, requesterKey) {
  return {
    id: report.id,
    description: report.description,
    category: report.category,
    severity: report.severity,
    status: report.status,
    lat: report.lat,
    lng: report.lng,
    ...report.image_url !== void 0 ? { image_url: report.image_url } : {},
    ml_status: report.ml_status,
    ml_category_score: report.ml_category_score,
    severity_signals: [...report.severity_signals],
    created_at: report.created_at,
    updated_at: report.updated_at,
    resolved_at: report.resolved_at,
    is_mine: isOwner(report, requesterKey)
  };
}
function describeError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
}
function zeroRecord(keys) {
  const record = {};
  for (const key of keys) record[key] = 0;
  return record;
}
function byNewest(a, b) {
  if (a.created_at < b.created_at) return 1;
  if (a.created_at > b.created_at) return -1;
  return 0;
}
function nearbyOpenCandidates(reports, lat, lng) {
  return reports.filter((report) => report.status === "open").map((report) => ({ report, distance: haversineMeters(lat, lng, report.lat, report.lng) })).filter((entry) => entry.distance <= DUPLICATE_RADIUS_M).sort((a, b) => a.distance - b.distance).slice(0, MAX_DUPLICATE_CANDIDATES).map((entry) => ({ id: entry.report.id, text: entry.report.description }));
}
var ReportService = class {
  repo;
  ml;
  logger;
  now;
  constructor(deps) {
    this.repo = deps.repo;
    this.ml = deps.ml;
    this.logger = deps.logger;
    this.now = deps.now;
  }
  async createReport(input, reporterKey) {
    const existing = await this.repo.list();
    const candidates = nearbyOpenCandidates(existing, input.lat, input.lng);
    const enrichment = await this.enrich(input.description, candidates);
    const timestamp = this.now().toISOString();
    const report = {
      id: randomUUID(),
      description: input.description,
      category: enrichment.category,
      severity: enrichment.severity,
      status: "open",
      lat: input.lat,
      lng: input.lng,
      ...input.image_url !== void 0 ? { image_url: input.image_url } : {},
      reporter_key: reporterKey,
      ml_status: enrichment.ml_status,
      ml_category_score: enrichment.ml_category_score,
      severity_signals: enrichment.severity_signals,
      created_at: timestamp,
      updated_at: timestamp,
      resolved_at: null
    };
    const saved = await this.repo.create(report);
    return { report: saved, duplicates: enrichment.duplicates, ml_status: saved.ml_status };
  }
  async list(query, requesterKey) {
    const all = await this.repo.list();
    const wantMine = query.mine === "true";
    const filtered = all.filter(
      (report) => (query.status === void 0 || report.status === query.status) && (query.category === void 0 || report.category === query.category) && (query.severity === void 0 || report.severity === query.severity) && (query.bbox === void 0 || withinBbox(report.lat, report.lng, query.bbox)) && (!wantMine || isOwner(report, requesterKey))
    );
    const ordered = filtered.reverse().sort(byNewest);
    const page = ordered.slice(query.offset, query.offset + query.limit);
    return {
      reports: page.map((report) => toPublic(report, requesterKey)),
      total: ordered.length
    };
  }
  async get(id) {
    const report = await this.repo.get(id);
    if (!report) throw new ApiError(404, "not_found", "Report not found");
    return report;
  }
  async stats() {
    const reports = await this.repo.list();
    const byCategory = zeroRecord(CATEGORIES);
    const bySeverity = zeroRecord(SEVERITIES);
    let open = 0;
    let resolved = 0;
    let criticalOpen = 0;
    for (const report of reports) {
      byCategory[report.category] += 1;
      bySeverity[report.severity] += 1;
      if (report.status === "open") {
        open += 1;
        if (report.severity === "critical") criticalOpen += 1;
      } else {
        resolved += 1;
      }
    }
    return {
      total: reports.length,
      open,
      resolved,
      critical_open: criticalOpen,
      resolution_rate: reports.length === 0 ? 0 : resolved / reports.length,
      by_category: byCategory,
      by_severity: bySeverity
    };
  }
  async applyAction(id, action, requesterKey) {
    const report = await this.repo.get(id);
    if (!report) throw new ApiError(404, "not_found", "Report not found");
    if (!isOwner(report, requesterKey)) {
      throw new ApiError(403, "forbidden", "This report belongs to a different reporter");
    }
    const timestamp = this.now().toISOString();
    let patch;
    if (action === "resolve") {
      if (report.status !== "open") {
        throw new ApiError(409, "invalid_transition", "Only open reports can be resolved");
      }
      patch = { status: "resolved", updated_at: timestamp, resolved_at: timestamp };
    } else {
      if (report.status !== "resolved") {
        throw new ApiError(409, "invalid_transition", "Only resolved reports can be reopened");
      }
      patch = { status: "open", updated_at: timestamp, resolved_at: null };
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new ApiError(404, "not_found", "Report not found");
    return updated;
  }
  async getHotspots(radiusM, minPoints) {
    return this.computeHotspots(await this.repo.list(), radiusM, minPoints);
  }
  async getBriefing() {
    const reports = await this.repo.list();
    const { hotspots } = await this.computeHotspots(
      reports,
      DEFAULT_HOTSPOT_RADIUS_M,
      DEFAULT_HOTSPOT_MIN_POINTS
    );
    return buildBriefing(reports, hotspots, this.now());
  }
  async computeHotspots(reports, radiusM, minPoints) {
    const points = reports.filter((report) => report.status === "open").map((report) => ({
      id: report.id,
      lat: report.lat,
      lng: report.lng,
      severity: report.severity
    }));
    try {
      const hotspots = await this.ml.hotspots(points, radiusM, minPoints);
      return { hotspots, source: "ml" };
    } catch (error) {
      this.logger.warn(
        `ML hotspots unavailable, using local clustering (${describeError(error)})`
      );
      return { hotspots: localHotspots(points, radiusM, minPoints), source: "local" };
    }
  }
  /** Any ML failure (error, timeout, malformed body) degrades to safe defaults. */
  async enrich(description, candidates) {
    try {
      const [classification, severity, matches] = await Promise.all([
        this.ml.classify(description),
        this.ml.severity(description),
        candidates.length > 0 ? this.ml.duplicates(description, candidates) : Promise.resolve([])
      ]);
      const knownIds = new Set(candidates.map((candidate) => candidate.id));
      const duplicates = matches.filter((match) => knownIds.has(match.id)).sort((a, b) => b.similarity - a.similarity).map((match) => ({ id: match.id, similarity: match.similarity }));
      return {
        category: classification.category,
        severity: severity.severity,
        ml_status: "ok",
        ml_category_score: classification.score,
        severity_signals: severity.signals,
        duplicates
      };
    } catch (error) {
      this.logger.warn(`ML enrichment unavailable, saving defaults (${describeError(error)})`);
      return {
        category: "other",
        severity: "low",
        ml_status: "unavailable",
        ml_category_score: null,
        severity_signals: [],
        duplicates: []
      };
    }
  }
};

// src/app.ts
function requireReporterKey(req) {
  const parsed = reporterKeySchema.safeParse(req.header("x-reporter-key"));
  if (!parsed.success) {
    throw new ApiError(
      400,
      "validation_error",
      "X-Reporter-Key header is required and must be 16-128 characters"
    );
  }
  return parsed.data;
}
function optionalReporterKey(req) {
  const value = req.header("x-reporter-key");
  return value === void 0 || value === "" ? void 0 : value;
}
function createApp(deps) {
  const app2 = express();
  const service = new ReportService({
    repo: deps.repo,
    ml: deps.ml,
    logger: deps.logger,
    now: deps.now ?? (() => /* @__PURE__ */ new Date())
  });
  const limiter = createRateLimiter(deps.rateLimit ?? { max: 30, windowMs: 6e4 });
  app2.disable("x-powered-by");
  app2.set("trust proxy", 1);
  app2.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app2.use(
    cors({
      origin: deps.corsOrigins,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Reporter-Key"],
      exposedHeaders: ["Retry-After"],
      maxAge: 600
    })
  );
  app2.use(express.json({ limit: "100kb" }));
  app2.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app2.post(
    "/reports",
    limiter,
    asyncHandler(async (req, res) => {
      const key = requireReporterKey(req);
      const input = createReportBodySchema.parse(req.body);
      const { report, duplicates, ml_status } = await service.createReport(input, key);
      res.status(201).json({ report: toPublic(report, key), duplicates, ml_status });
    })
  );
  app2.get(
    "/reports",
    asyncHandler(async (req, res) => {
      const query = listQuerySchema.parse(req.query);
      res.json(await service.list(query, optionalReporterKey(req)));
    })
  );
  app2.get(
    "/reports/stats",
    asyncHandler(async (_req, res) => {
      res.json(await service.stats());
    })
  );
  app2.get(
    "/reports/:id",
    asyncHandler(async (req, res) => {
      const report = await service.get(req.params.id);
      res.json(toPublic(report, optionalReporterKey(req)));
    })
  );
  app2.post(
    "/reports/:id/action",
    limiter,
    asyncHandler(async (req, res) => {
      const key = requireReporterKey(req);
      const { action } = actionBodySchema.parse(req.body);
      const report = await service.applyAction(req.params.id, action, key);
      res.json({ report: toPublic(report, key) });
    })
  );
  app2.get(
    "/hotspots",
    asyncHandler(async (req, res) => {
      const { radius_m, min_points } = hotspotsQuerySchema.parse(req.query);
      res.json(await service.getHotspots(radius_m, min_points));
    })
  );
  app2.get(
    "/briefing",
    asyncHandler(async (_req, res) => {
      res.json(await service.getBriefing());
    })
  );
  app2.use(notFoundHandler);
  app2.use(createErrorHandler(deps.logger));
  return app2;
}

// src/config.ts
import { z as z2 } from "zod";
var envSchema = z2.object({
  PORT: z2.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z2.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z2.string().default("http://localhost:5173"),
  ML_BASE_URL: z2.string().url().default("http://localhost:8000"),
  ML_API_KEY: z2.string().optional(),
  ML_TIMEOUT_MS: z2.coerce.number().int().min(100).max(6e4).default(2e3),
  DATA_FILE: z2.string().min(1).default("./data/reports.json")
});
function loadConfig(env = process.env) {
  const cleaned = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== void 0 && value.trim() !== "") cleaned[key] = value.trim();
  }
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:
${details}`);
  }
  const parsed = result.data;
  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/+$/, "")).filter((origin) => origin.length > 0),
    mlBaseUrl: parsed.ML_BASE_URL,
    mlApiKey: parsed.ML_API_KEY,
    mlTimeoutMs: parsed.ML_TIMEOUT_MS,
    dataFile: parsed.DATA_FILE
  };
}

// src/services/mlClient.ts
var MlError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MlError";
  }
};
function createHttpMlClient(options) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  async function post(path, body, schema) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const headers = { "Content-Type": "application/json" };
      if (options.apiKey) headers["X-API-Key"] = options.apiKey;
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new MlError(`ML ${path} responded with HTTP ${response.status}`);
      }
      const json = await response.json();
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
        duplicatesResponseSchema
      );
      return result.candidates;
    },
    hotspots: async (points, radiusM, minPoints) => {
      const result = await post(
        "/hotspots",
        { points, radius_m: radiusM, min_points: minPoints },
        hotspotsResponseSchema
      );
      return result.hotspots;
    }
  };
}

// src/store/postgresRepository.ts
import pg from "pg";

// src/store/repository.ts
function cloneReport(report) {
  return { ...report, severity_signals: [...report.severity_signals] };
}

// src/store/postgresRepository.ts
var SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  reporter_key TEXT NOT NULL,
  ml_status TEXT NOT NULL,
  ml_category_score DOUBLE PRECISION,
  severity_signals JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
`;
function fromRow(row) {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    severity: row.severity,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    ...row.image_url !== null ? { image_url: row.image_url } : {},
    reporter_key: row.reporter_key,
    ml_status: row.ml_status,
    ml_category_score: row.ml_category_score,
    severity_signals: row.severity_signals,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at
  };
}
function toParams(report) {
  return [
    report.id,
    report.description,
    report.category,
    report.severity,
    report.status,
    report.lat,
    report.lng,
    report.image_url ?? null,
    report.reporter_key,
    report.ml_status,
    report.ml_category_score,
    JSON.stringify(report.severity_signals),
    report.created_at,
    report.updated_at,
    report.resolved_at
  ];
}
var PostgresRepository = class {
  pool;
  ready;
  constructor(connectionString) {
    this.pool = new pg.Pool({ connectionString, max: 3 });
  }
  /** Creates the table on first use; retries on the next call if it failed. */
  ensureSchema() {
    if (!this.ready) {
      const attempt = this.pool.query(SCHEMA).then(() => void 0);
      attempt.catch(() => {
        this.ready = void 0;
      });
      this.ready = attempt;
    }
    return this.ready;
  }
  async list() {
    await this.ensureSchema();
    const result = await this.pool.query("SELECT * FROM reports ORDER BY created_at ASC");
    return result.rows.map(fromRow);
  }
  async get(id) {
    await this.ensureSchema();
    const result = await this.pool.query("SELECT * FROM reports WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? fromRow(row) : void 0;
  }
  async create(report) {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO reports (id, description, category, severity, status, lat, lng, image_url,
         reporter_key, ml_status, ml_category_score, severity_signals, created_at, updated_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)`,
      toParams(report)
    );
    return cloneReport(report);
  }
  async update(id, patch) {
    const existing = await this.get(id);
    if (!existing) return void 0;
    const merged = { ...existing, ...patch, id: existing.id };
    await this.pool.query(
      `UPDATE reports SET description=$2, category=$3, severity=$4, status=$5, lat=$6, lng=$7,
         image_url=$8, reporter_key=$9, ml_status=$10, ml_category_score=$11,
         severity_signals=$12::jsonb, created_at=$13, updated_at=$14, resolved_at=$15
       WHERE id=$1`,
      toParams(merged)
    );
    return cloneReport(merged);
  }
};

// src/vercel.ts
var config = loadConfig();
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
var app = createApp({
  repo: new PostgresRepository(databaseUrl),
  ml: createHttpMlClient({
    baseUrl: config.mlBaseUrl,
    apiKey: config.mlApiKey,
    timeoutMs: config.mlTimeoutMs
  }),
  corsOrigins: config.corsOrigins,
  logger: console
});
var vercel_default = app;
export {
  vercel_default as default
};
