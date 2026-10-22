import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { reportSchema } from "../schemas";
import type { Logger, Report } from "../types";
import { cloneReport, type ReportPatch, type ReportRepository } from "./repository";

const storedReportsSchema = z.array(reportSchema);

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function readExisting(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function parseStored(raw: string): Report[] | undefined {
  try {
    const json: unknown = JSON.parse(raw);
    const result = storedReportsSchema.safeParse(json);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Keeps every report in memory and persists the whole list after each write.
 * Writes go to a temp file that is renamed over the real file, and are chained
 * on a promise queue so concurrent requests cannot interleave or corrupt it.
 */
export class JsonFileRepository implements ReportRepository {
  private readonly filePath: string;
  private readonly reports: Map<string, Report>;
  private queue: Promise<void> = Promise.resolve();

  private constructor(filePath: string, reports: Map<string, Report>) {
    this.filePath = filePath;
    this.reports = reports;
  }

  static async open(
    filePath: string,
    logger: Pick<Logger, "warn"> = console,
  ): Promise<JsonFileRepository> {
    await mkdir(dirname(filePath), { recursive: true });

    const reports = new Map<string, Report>();
    let needsWrite = false;

    const raw = await readExisting(filePath);
    if (raw === undefined) {
      needsWrite = true;
    } else {
      const parsed = parseStored(raw);
      if (parsed === undefined) {
        const backupPath = `${filePath}.corrupt-${Date.now()}`;
        await rename(filePath, backupPath);
        logger.warn(`Data file was unreadable; moved it to ${backupPath} and started empty`);
        needsWrite = true;
      } else {
        for (const report of parsed) reports.set(report.id, report);
      }
    }

    const repository = new JsonFileRepository(filePath, reports);
    if (needsWrite) await repository.persist();
    return repository;
  }

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
    try {
      await this.persist();
    } catch (error) {
      this.reports.delete(stored.id);
      throw error;
    }
    return cloneReport(stored);
  }

  async update(id: string, patch: ReportPatch): Promise<Report | undefined> {
    const existing = this.reports.get(id);
    if (!existing) return undefined;
    const merged: Report = { ...existing, ...patch, id: existing.id };
    this.reports.set(id, merged);
    try {
      await this.persist();
    } catch (error) {
      this.reports.set(id, existing);
      throw error;
    }
    return cloneReport(merged);
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify([...this.reports.values()], null, 2);
    const run = this.queue.then(() => this.writeAtomic(snapshot));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async writeAtomic(contents: string): Promise<void> {
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, contents, "utf8");
    await rename(tempPath, this.filePath);
  }
}