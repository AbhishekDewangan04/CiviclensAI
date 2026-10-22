import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JsonFileRepository } from "../src/store/jsonFileRepository";
import { makeReport } from "./helpers";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "civiclens-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("JsonFileRepository", () => {
  it("creates the folder and an empty list when the file is missing", async () => {
    const filePath = join(dir, "nested", "reports.json");

    const repo = await JsonFileRepository.open(filePath);

    expect(await repo.list()).toEqual([]);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual([]);
  });

  it("persists reports across restarts (round trip)", async () => {
    const filePath = join(dir, "reports.json");
    const repo = await JsonFileRepository.open(filePath);
    const first = await repo.create(makeReport({ description: "First persisted report" }));
    const second = await repo.create(
      makeReport({ description: "Second persisted report", image_url: "https://example.com/a.jpg" }),
    );
    await repo.update(first.id, {
      status: "resolved",
      resolved_at: "2025-01-02T00:00:00.000Z",
    });

    const reopened = await JsonFileRepository.open(filePath);

    expect(await reopened.list()).toHaveLength(2);
    expect(await reopened.get(second.id)).toEqual(second);
    const updated = await reopened.get(first.id);
    expect(updated?.status).toBe("resolved");
    expect(updated?.resolved_at).toBe("2025-01-02T00:00:00.000Z");
  });

  it("returns undefined when updating or reading an unknown id", async () => {
    const repo = await JsonFileRepository.open(join(dir, "reports.json"));

    expect(await repo.get("missing")).toBeUndefined();
    expect(await repo.update("missing", { status: "resolved" })).toBeUndefined();
  });

  it("keeps the file valid when many writes happen concurrently", async () => {
    const filePath = join(dir, "reports.json");
    const repo = await JsonFileRepository.open(filePath);

    await Promise.all(Array.from({ length: 20 }, () => repo.create(makeReport())));

    const onDisk: unknown = JSON.parse(await readFile(filePath, "utf8"));
    expect(Array.isArray(onDisk) ? onDisk : []).toHaveLength(20);
    expect(await (await JsonFileRepository.open(filePath)).list()).toHaveLength(20);
    expect(await readdir(dir)).not.toContain("reports.json.tmp");
  });

  it.each([
    ["invalid JSON", "{ not json"],
    ["an empty file", ""],
    ["JSON with the wrong shape", '[{"id": 1}]'],
  ])("recovers from a corrupt file (%s)", async (_name, contents) => {
    const filePath = join(dir, "reports.json");
    await writeFile(filePath, contents, "utf8");
    const warn = vi.fn<(message: string) => void>();

    const repo = await JsonFileRepository.open(filePath, { warn });

    expect(await repo.list()).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const files = await readdir(dir);
    expect(files.some((name) => name.startsWith("reports.json.corrupt-"))).toBe(true);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual([]);

    await repo.create(makeReport());
    expect(await (await JsonFileRepository.open(filePath)).list()).toHaveLength(1);
  });
});