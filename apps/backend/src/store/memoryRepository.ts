import type { Report } from "../types";
import { cloneReport, type ReportPatch, type ReportRepository } from "./repository";

export class MemoryRepository implements ReportRepository {
  private readonly reports = new Map<string, Report>();

  async list(): Promise<Report[]> {
    return [...this.reports.values()].map((report) => cloneReport(report));
  }

  async get(id: string): Promise<Report | undefined> {
    const report = this.reports.get(id);
    return report ? cloneReport(report) : undefined;
  }

  async create(report: Report): Promise<Report> {
    if (this.reports.has(report.id)) {
      throw new Error(`Report ${report.id} already exists`);
    }
    const stored = cloneReport(report);
    this.reports.set(stored.id, stored);
    return cloneReport(stored);
  }

  async update(id: string, patch: ReportPatch): Promise<Report | undefined> {
    const existing = this.reports.get(id);
    if (!existing) return undefined;
    const merged: Report = { ...existing, ...patch, id: existing.id };
    this.reports.set(id, merged);
    return cloneReport(merged);
  }
}