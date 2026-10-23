import type { Briefing, BriefingReport, Category, Hotspot, Report } from "../types";

const MAX_TOP_CATEGORIES = 3;
const MAX_HOTSPOTS = 3;
const MAX_CRITICAL = 5;
const MAX_DESCRIPTION_LENGTH = 140;

// Add friendly labels for the new categories here (keys must match types.ts).
// Any category missing from this map falls back to categoryLabel()'s default.
const CATEGORY_LABELS: Partial<Record<Category, string>> = {
  pothole: "potholes",
  garbage: "garbage",
  water_supply: "water supply",
  streetlight: "streetlights",
  drainage: "drainage",
  other: "other issues",
};

function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? String(category).replace(/_/g, " ");
}

function count(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function newestFirst(a: Report, b: Report): number {
  if (a.created_at < b.created_at) return 1;
  if (a.created_at > b.created_at) return -1;
  return 0;
}

function toBriefingReport(report: Report): BriefingReport {
  const description =
    report.description.length > MAX_DESCRIPTION_LENGTH
      ? `${report.description.slice(0, MAX_DESCRIPTION_LENGTH - 3)}...`
      : report.description;
  return {
    id: report.id,
    description,
    category: report.category,
    lat: report.lat,
    lng: report.lng,
    created_at: report.created_at,
  };
}

/** Pure, deterministic briefing. Never calls any model. */
export function buildBriefing(
  reports: readonly Report[],
  hotspots: readonly Hotspot[],
  now: Date,
): Briefing {
  const total = reports.length;
  const open = reports.filter((report) => report.status === "open");
  const resolved = total - open.length;
  const criticalOpen = open
    .filter((report) => report.severity === "critical")
    .sort(newestFirst);
  const critical = criticalOpen.length;

  const categoryCounts = new Map<Category, number>();
  for (const report of open) {
    categoryCounts.set(report.category, (categoryCounts.get(report.category) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()]
    .map(([category, n]) => ({ category, count: n }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, MAX_TOP_CATEGORIES);

  const topHotspots = [...hotspots]
    .sort((a, b) => b.critical_count - a.critical_count || b.count - a.count)
    .slice(0, MAX_HOTSPOTS);

  let headline: string;
  let summary: string;
  if (total === 0) {
    headline = "No reports yet";
    summary = "No civic reports have been filed yet. The map is clear.";
  } else if (open.length === 0) {
    headline = "All reported issues are resolved";
    summary =
      total === 1
        ? "The only report filed has been resolved."
        : `All ${total} reports filed have been resolved.`;
  } else {
    headline =
      critical > 0
        ? `${count(critical, "critical issue")} ${critical === 1 ? "needs" : "need"} attention`
        : `${count(open.length, "open report")} to review`;

    const verb = open.length === 1 ? "is" : "are";
    summary = `There ${verb} ${count(open.length, "open report")} (${total} filed in total, ${resolved} resolved).`;
    if (critical > 0) {
      summary += ` ${critical} ${critical === 1 ? "is" : "are"} critical.`;
    }
    const top = topCategories[0];
    if (top) {
      summary += ` Most frequent category: ${categoryLabel(top.category)} (${top.count}).`;
    }
  }

  const recommendations: string[] = [];
  if (critical > 0) {
    recommendations.push(
      `Prioritise the ${count(critical, "critical report")} before routine work.`,
    );
  }
  const firstHotspot = topHotspots[0];
  if (firstHotspot) {
    recommendations.push(
      `Schedule one combined visit per hotspot, starting with the area covering ${count(firstHotspot.count, "report")}.`,
    );
  }
  const topCategory = topCategories[0];
  if (topCategory) {
    recommendations.push(
      `Consider a dedicated crew for ${categoryLabel(topCategory.category)}, the most reported open category.`,
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
    source: "rules",
  };
}