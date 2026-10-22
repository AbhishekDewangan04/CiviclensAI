import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildBriefing } from "../src/services/briefing";
import type { Briefing, Hotspot } from "../src/types";
import { buildTestApp, createFailingMl, makeReport } from "./helpers";

const NOW = new Date("2026-01-01T12:00:00.000Z");

function hotspot(count: number, criticalCount = 0): Hotspot {
  return {
    center_lat: 21.25,
    center_lng: 81.63,
    count,
    radius_m: 100,
    report_ids: [],
    critical_count: criticalCount,
  };
}

describe("buildBriefing", () => {
  it("handles zero reports", () => {
    const briefing = buildBriefing([], [], NOW);

    expect(briefing.headline).toBe("No reports yet");
    expect(briefing.summary).toBe("No civic reports have been filed yet. The map is clear.");
    expect(briefing.top_categories).toEqual([]);
    expect(briefing.critical_open).toEqual([]);
    expect(briefing.hotspots).toEqual([]);
    expect(briefing.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(briefing.source).toBe("rules");
    expect(briefing.generated_at).toBe(NOW.toISOString());
  });

  it("uses singular grammar for exactly one report", () => {
    const briefing = buildBriefing([makeReport({ category: "garbage" })], [], NOW);

    expect(briefing.headline).toBe("1 open report to review");
    expect(briefing.summary).toBe(
      "There is 1 open report (1 filed in total, 0 resolved). Most frequent category: garbage (1).",
    );
    expect(briefing.summary).not.toMatch(/1 open reports/);
    expect(briefing.summary).not.toMatch(/There are 1 /);
  });

  it("uses singular grammar for exactly one critical report", () => {
    const briefing = buildBriefing(
      [makeReport({ category: "pothole", severity: "critical" })],
      [],
      NOW,
    );

    expect(briefing.headline).toBe("1 critical issue needs attention");
    expect(briefing.summary).toBe(
      "There is 1 open report (1 filed in total, 0 resolved). 1 is critical. Most frequent category: potholes (1).",
    );
    expect(briefing.recommendations[0]).toBe("Prioritise the 1 critical report before routine work.");
  });

  it("uses plural grammar for many reports", () => {
    const reports = [
      makeReport({ category: "pothole", severity: "critical" }),
      makeReport({ category: "pothole", severity: "critical" }),
      makeReport({ category: "pothole", severity: "low" }),
      makeReport({ category: "garbage", severity: "low" }),
      makeReport({ category: "garbage", severity: "medium" }),
      makeReport({
        category: "garbage",
        status: "resolved",
        resolved_at: NOW.toISOString(),
      }),
    ];

    const briefing = buildBriefing(reports, [], NOW);

    expect(briefing.headline).toBe("2 critical issues need attention");
    expect(briefing.summary).toBe(
      "There are 5 open reports (6 filed in total, 1 resolved). 2 are critical. Most frequent category: potholes (3).",
    );
    expect(briefing.top_categories).toEqual([
      { category: "pothole", count: 3 },
      { category: "garbage", count: 2 },
    ]);
    expect(briefing.critical_open).toHaveLength(2);
  });

  it("says everything is resolved when no report is open", () => {
    const resolved = makeReport({ status: "resolved", resolved_at: NOW.toISOString() });

    const one = buildBriefing([resolved], [], NOW);
    const two = buildBriefing([resolved, resolved], [], NOW);

    expect(one.headline).toBe("All reported issues are resolved");
    expect(one.summary).toBe("The only report filed has been resolved.");
    expect(two.summary).toBe("All 2 reports filed have been resolved.");
    expect(one.recommendations).toEqual([
      "No action needed right now; keep monitoring new reports.",
    ]);
  });

  it("caps critical reports at 5 (newest first) and hotspots at 3", () => {
    const reports = Array.from({ length: 7 }, (_, i) => {
      const createdAt = new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString();
      return makeReport({ severity: "critical", created_at: createdAt, updated_at: createdAt });
    });
    const hotspots = [hotspot(3), hotspot(4), hotspot(5), hotspot(6), hotspot(7)];

    const briefing = buildBriefing(reports, hotspots, NOW);

    expect(briefing.critical_open).toHaveLength(5);
    expect(briefing.critical_open[0]?.created_at).toBe(
      new Date(Date.UTC(2025, 0, 1, 0, 6)).toISOString(),
    );
    expect(briefing.hotspots).toHaveLength(3);
  });

  it("uses singular grammar when a hotspot covers one report", () => {
    const briefing = buildBriefing([makeReport()], [hotspot(1)], NOW);

    expect(briefing.recommendations.some((line) => line.includes("covering 1 report."))).toBe(true);
    expect(briefing.recommendations.join(" ")).not.toContain("1 reports");
  });

  it("truncates long descriptions in critical summaries", () => {
    const briefing = buildBriefing(
      [makeReport({ severity: "critical", description: "d".repeat(500) })],
      [],
      NOW,
    );

    expect(briefing.critical_open[0]?.description.length).toBe(140);
    expect(briefing.critical_open[0]?.description.endsWith("...")).toBe(true);
  });
});

describe("GET /briefing", () => {
  it("returns a briefing for an empty store", async () => {
    const { app } = buildTestApp();

    const res = await request(app).get("/briefing");
    const body = res.body as Briefing;

    expect(res.status).toBe(200);
    expect(body.headline).toBe("No reports yet");
    expect(body.source).toBe("rules");
  });

  it("still works when the ML service is down", async () => {
    const { app, repo } = buildTestApp({ ml: createFailingMl() });
    await repo.create(makeReport({ severity: "critical" }));

    const res = await request(app).get("/briefing");
    const body = res.body as Briefing;

    expect(res.status).toBe(200);
    expect(body.headline).toBe("1 critical issue needs attention");
    expect(body.critical_open).toHaveLength(1);
  });
});