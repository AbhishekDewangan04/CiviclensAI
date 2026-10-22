import type { Report } from "../types";

export type ReportPatch = Partial<Omit<Report, "id">>;

export interface ReportRepository {
  list(): Promise<Report[]>;
  get(id: string): Promise<Report | undefined>;
  create(report: Report): Promise<Report>;
  update(id: string, patch: ReportPatch): Promise<Report | undefined>;
}

export function cloneReport(report: Report): Report {
  return { ...report, severity_signals: [...report.severity_signals] };
}