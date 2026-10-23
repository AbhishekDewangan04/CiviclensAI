import { randomUUID, timingSafeEqual } from "node:crypto";
import { ApiError } from "../middleware/errors";
import {
  DEFAULT_HOTSPOT_MIN_POINTS,
  DEFAULT_HOTSPOT_RADIUS_M,
  type CreateReportInput,
  type ListQuery,
  type ReportAction,
} from "../schemas";
import type { ReportPatch, ReportRepository } from "../store/repository";
import {
  CATEGORIES,
  SEVERITIES,
  type Briefing,
  type Category,
  type DuplicateMatch,
  type HotspotPoint,
  type HotspotsResult,
  type Logger,
  type MlCandidate,
  type MlStatus,
  type PublicReport,
  type Report,
  type Severity,
  type Stats,
} from "../types";
import { buildBriefing } from "./briefing";
import { haversineMeters, localHotspots, withinBbox } from "./geo";
import { classifiableText, classifyText, findDuplicates, gradeSeverity } from "./localIntelligence";
import type { MlClient } from "./mlClient";

const DUPLICATE_RADIUS_M = 200;
const MAX_DUPLICATE_CANDIDATES = 50;

/** Constant-time comparison that is safe for strings of different length. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isOwner(report: Report, requesterKey: string | undefined): boolean {
  return requesterKey !== undefined && safeEqual(requesterKey, report.reporter_key);
}

/**
 * The only way a Report may leave the server. Fields are copied explicitly so
 * reporter_key can never leak, even if the Report type gains new fields.
 */
export function toPublic(report: Report, requesterKey: string | undefined): PublicReport {
  return {
    id: report.id,
    description: report.description,
    category: report.category,
    severity: report.severity,
    status: report.status,
    lat: report.lat,
    lng: report.lng,
    ...(report.image_url !== undefined ? { image_url: report.image_url } : {}),
    ml_status: report.ml_status,
    ml_category_score: report.ml_category_score,
    severity_signals: [...report.severity_signals],
    created_at: report.created_at,
    updated_at: report.updated_at,
    resolved_at: report.resolved_at,
    is_mine: isOwner(report, requesterKey),
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
}

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const record = {} as Record<K, number>;
  for (const key of keys) record[key] = 0;
  return record;
}

function byNewest(a: Report, b: Report): number {
  if (a.created_at < b.created_at) return 1;
  if (a.created_at > b.created_at) return -1;
  return 0;
}

function nearbyOpenCandidates(reports: readonly Report[], lat: number, lng: number): MlCandidate[] {
  return reports
    .filter((report) => report.status === "open")
    .map((report) => ({ report, distance: haversineMeters(lat, lng, report.lat, report.lng) }))
    .filter((entry) => entry.distance <= DUPLICATE_RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_DUPLICATE_CANDIDATES)
    .map((entry) => ({ id: entry.report.id, text: classifiableText(entry.report.description) }));
}

interface Enrichment {
  category: Category;
  severity: Severity;
  ml_status: MlStatus;
  ml_category_score: number | null;
  severity_signals: string[];
  duplicates: DuplicateMatch[];
}

export interface CreateReportResult {
  report: Report;
  duplicates: DuplicateMatch[];
  ml_status: MlStatus;
}

export interface ReportServiceDeps {
  repo: ReportRepository;
  ml: MlClient;
  logger: Logger;
  now: () => Date;
}

export class ReportService {
  private readonly repo: ReportRepository;
  private readonly ml: MlClient;
  private readonly logger: Logger;
  private readonly now: () => Date;

  constructor(deps: ReportServiceDeps) {
    this.repo = deps.repo;
    this.ml = deps.ml;
    this.logger = deps.logger;
    this.now = deps.now;
  }

  async createReport(input: CreateReportInput, reporterKey: string): Promise<CreateReportResult> {
    const existing = await this.repo.list();
    const candidates = nearbyOpenCandidates(existing, input.lat, input.lng);
    const enrichment = await this.enrich(input, candidates);

    const timestamp = this.now().toISOString();
    const report: Report = {
      id: randomUUID(),
      description: input.description,
      category: enrichment.category,
      severity: enrichment.severity,
      status: "open",
      lat: input.lat,
      lng: input.lng,
      ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
      reporter_key: reporterKey,
      ml_status: enrichment.ml_status,
      ml_category_score: enrichment.ml_category_score,
      severity_signals: enrichment.severity_signals,
      created_at: timestamp,
      updated_at: timestamp,
      resolved_at: null,
    };

    const saved = await this.repo.create(report);
    return { report: saved, duplicates: enrichment.duplicates, ml_status: saved.ml_status };
  }

  async list(
    query: ListQuery,
    requesterKey: string | undefined,
  ): Promise<{ reports: PublicReport[]; total: number }> {
    const all = await this.repo.list();
    const wantMine = query.mine === "true";

    const filtered = all.filter(
      (report) =>
        (query.status === undefined || report.status === query.status) &&
        (query.category === undefined || report.category === query.category) &&
        (query.severity === undefined || report.severity === query.severity) &&
        (query.bbox === undefined || withinBbox(report.lat, report.lng, query.bbox)) &&
        (!wantMine || isOwner(report, requesterKey)),
    );

    // Reverse first so reports created in the same millisecond keep newest-inserted-first.
    const ordered = filtered.reverse().sort(byNewest);
    const page = ordered.slice(query.offset, query.offset + query.limit);
    return {
      reports: page.map((report) => toPublic(report, requesterKey)),
      total: ordered.length,
    };
  }

  async get(id: string): Promise<Report> {
    const report = await this.repo.get(id);
    if (!report) throw new ApiError(404, "not_found", "Report not found");
    return report;
  }

  async stats(): Promise<Stats> {
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
      by_severity: bySeverity,
    };
  }

  async applyAction(id: string, action: ReportAction, requesterKey: string): Promise<Report> {
    const report = await this.repo.get(id);
    if (!report) throw new ApiError(404, "not_found", "Report not found");
    if (!isOwner(report, requesterKey)) {
      throw new ApiError(403, "forbidden", "This report belongs to a different reporter");
    }

    const timestamp = this.now().toISOString();
    let patch: ReportPatch;
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

  async getHotspots(radiusM: number, minPoints: number): Promise<HotspotsResult> {
    return this.computeHotspots(await this.repo.list(), radiusM, minPoints);
  }

  async getBriefing(): Promise<Briefing> {
    const reports = await this.repo.list();
    const { hotspots } = await this.computeHotspots(
      reports,
      DEFAULT_HOTSPOT_RADIUS_M,
      DEFAULT_HOTSPOT_MIN_POINTS,
    );
    return buildBriefing(reports, hotspots, this.now());
  }

  private async computeHotspots(
    reports: readonly Report[],
    radiusM: number,
    minPoints: number,
  ): Promise<HotspotsResult> {
    const points: HotspotPoint[] = reports
      .filter((report) => report.status === "open")
      .map((report) => ({
        id: report.id,
        lat: report.lat,
        lng: report.lng,
        severity: report.severity,
      }));

    try {
      const hotspots = await this.ml.hotspots(points, radiusM, minPoints);
      return { hotspots, source: "ml" };
    } catch (error) {
      this.logger.warn(
        `ML hotspots unavailable, using local clustering (${describeError(error)})`,
      );
      return { hotspots: localHotspots(points, radiusM, minPoints), source: "local" };
    }
  }

  /**
   * Category and severity: what the reporter picked always wins. Otherwise the
   * built-in classifier decides, with the ML service as a second opinion. Each ML
   * call is judged on its own, so one missing or failing endpoint can no longer
   * throw away everything, and a report is never filed as "other / low" just
   * because the ML service is unreachable.
   */
  private async enrich(input: CreateReportInput, candidates: MlCandidate[]): Promise<Enrichment> {
    // Address words ("central park", "street 99") must not steer the classification.
    const text = classifiableText(input.description);
    const local = classifyText(text);
    const grade = gradeSeverity(text);

    const [mlClass, mlSeverity, mlDuplicates] = await Promise.allSettled([
      this.ml.classify(text),
      this.ml.severity(text),
      candidates.length > 0
        ? this.ml.duplicates(text, candidates)
        : Promise.resolve<DuplicateMatch[]>([]),
    ]);

    const failures: string[] = [];
    if (mlClass.status === "rejected") failures.push(`classify: ${describeError(mlClass.reason)}`);
    if (mlSeverity.status === "rejected") failures.push(`severity: ${describeError(mlSeverity.reason)}`);
    if (mlDuplicates.status === "rejected") failures.push(`duplicates: ${describeError(mlDuplicates.reason)}`);
    if (failures.length > 0) {
      this.logger.warn(`ML call(s) failed, using the built-in engine (${failures.join("; ")})`);
    }

    // Category: reporter's pick > built-in classifier > ML classifier > "other".
    let category: Category;
    let score: number | null;
    if (input.category !== undefined && input.category !== "other") {
      category = input.category;
      score = null;
    } else if (local.category !== "other") {
      category = local.category;
      score = local.score;
    } else if (mlClass.status === "fulfilled" && mlClass.value.category !== "other") {
      category = mlClass.value.category;
      score = mlClass.value.score;
    } else {
      category = "other";
      score = mlClass.status === "fulfilled" ? mlClass.value.score : null;
    }

    // Severity: reporter's pick > built-in grader > ML grader > "low".
    const mlSeverityValue = mlSeverity.status === "fulfilled" ? mlSeverity.value : undefined;
    let severity: Severity;
    if (input.severity !== undefined) {
      severity = input.severity;
    } else if (grade.signals.length > 0 || mlSeverityValue === undefined) {
      severity = grade.severity;
    } else {
      severity = mlSeverityValue.severity;
    }
    const signals = grade.signals.length > 0 ? grade.signals : (mlSeverityValue?.signals ?? []);

    // Duplicates: ML when it answers, otherwise the built-in matcher.
    const knownIds = new Set(candidates.map((candidate) => candidate.id));
    const matches = mlDuplicates.status === "fulfilled" ? mlDuplicates.value : findDuplicates(text, candidates);
    const duplicates = matches
      .filter((match) => knownIds.has(match.id))
      .sort((a, b) => b.similarity - a.similarity)
      .map((match) => ({ id: match.id, similarity: match.similarity }));

    return {
      category,
      severity,
      ml_status: mlClass.status === "fulfilled" ? "ok" : "unavailable",
      ml_category_score: score,
      severity_signals: signals,
      duplicates,
    };
  }
}