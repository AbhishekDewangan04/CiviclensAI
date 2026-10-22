import pg from "pg";
import type { Report } from "../types";
import { cloneReport, type ReportPatch, type ReportRepository } from "./repository";

const SCHEMA = `
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

interface Row {
  id: string;
  description: string;
  category: Report["category"];
  severity: Report["severity"];
  status: Report["status"];
  lat: number;
  lng: number;
  image_url: string | null;
  reporter_key: string;
  ml_status: Report["ml_status"];
  ml_category_score: number | null;
  severity_signals: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

function fromRow(row: Row): Report {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    severity: row.severity,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    ...(row.image_url !== null ? { image_url: row.image_url } : {}),
    reporter_key: row.reporter_key,
    ml_status: row.ml_status,
    ml_category_score: row.ml_category_score,
    severity_signals: row.severity_signals,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
  };
}

function toParams(report: Report): unknown[] {
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
    report.resolved_at,
  ];
}

export class PostgresRepository implements ReportRepository {
  private readonly pool: pg.Pool;
  private ready: Promise<void> | undefined;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 3 });
  }

  /** Creates the table on first use; retries on the next call if it failed. */
  private ensureSchema(): Promise<void> {
    if (!this.ready) {
      const attempt = this.pool.query(SCHEMA).then(() => undefined);
      attempt.catch(() => {
        this.ready = undefined;
      });
      this.ready = attempt;
    }
    return this.ready;
  }

  async list(): Promise<Report[]> {
    await this.ensureSchema();
    const result = await this.pool.query<Row>("SELECT * FROM reports ORDER BY created_at ASC");
    return result.rows.map(fromRow);
  }

  async get(id: string): Promise<Report | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query<Row>("SELECT * FROM reports WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? fromRow(row) : undefined;
  }

  async create(report: Report): Promise<Report> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO reports (id, description, category, severity, status, lat, lng, image_url,
         reporter_key, ml_status, ml_category_score, severity_signals, created_at, updated_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)`,
      toParams(report),
    );
    return cloneReport(report);
  }

  async update(id: string, patch: ReportPatch): Promise<Report | undefined> {
    const existing = await this.get(id);
    if (!existing) return undefined;
    const merged: Report = { ...existing, ...patch, id: existing.id };
    await this.pool.query(
      `UPDATE reports SET description=$2, category=$3, severity=$4, status=$5, lat=$6, lng=$7,
         image_url=$8, reporter_key=$9, ml_status=$10, ml_category_score=$11,
         severity_signals=$12::jsonb, created_at=$13, updated_at=$14, resolved_at=$15
       WHERE id=$1`,
      toParams(merged),
    );
    return cloneReport(merged);
  }
}