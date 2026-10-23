import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, FileText, TrendingUp, ShieldCheck } from "lucide-react";
import { CATEGORY_MAP } from "@/lib/reportMeta";
import { getBriefing } from "@/lib/api";

const plural = (n, one, many) => (n === 1 ? one : many);
const labelOf = (value) => CATEGORY_MAP[value]?.label || value || "Other";

// Builds the briefing purely from the reports passed in, so it always matches the hero counters.
function buildBriefing(reports = []) {
  const total = reports.length;

  if (total === 0) {
    return {
      summary: "No civic signals have been filed yet, so there is nothing to analyse.",
      topConcern: "No pattern yet.",
      hotspots: "File a report and the briefing will update with what it finds.",
      recommendations: ["Encourage residents to file their first reports so trends can be detected."],
    };
  }

  const open = reports.filter((r) => r.status !== "resolved");
  const critical = open.filter((r) => r.severity === "critical");
  const medium = open.filter((r) => r.severity === "medium");
  const pending = open.filter((r) => r.status === "pending");

  const byCategory = {};
  reports.forEach((r) => {
    const key = r.category || "other";
    byCategory[key] = (byCategory[key] || 0) + 1;
  });
  const ranked = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const [topKey, topCount] = ranked[0];
  const second = ranked[1];

  const recommendations = [];
  if (critical.length) {
    recommendations.push(
      `Send crews to the ${critical.length} critical ${plural(critical.length, "report", "reports")} first.`
    );
  }
  if (medium.length) {
    recommendations.push(
      `Schedule the ${medium.length} medium-severity ${plural(medium.length, "report", "reports")} for this week.`
    );
  }
  if (pending.length) {
    recommendations.push(
      `Review ${pending.length} ${plural(pending.length, "report that is", "reports that are")} still pending and post a status update.`
    );
  }
  if (ranked.length > 1) {
    recommendations.push(`Watch ${labelOf(topKey)}: it is the most reported category (${topCount} of ${total}).`);
  }
  if (!open.length) {
    recommendations.unshift("Every filed report is resolved. No action needed right now.");
  }

  return {
    summary: `Analysed ${total} registered civic ${plural(total, "signal", "signals")}. ${open.length} ${plural(open.length, "issue remains", "issues remain")} open, with ${critical.length} flagged at critical urgency.`,
    topConcern:
      total === 1
        ? `The only report so far is in ${labelOf(topKey).toUpperCase()}.`
        : `The most reported category is ${labelOf(topKey).toUpperCase()}, with ${topCount} of ${total} reports.`,
    hotspots: second
      ? `Next most reported: ${labelOf(second[0])} (${second[1]}).`
      : `All reports so far fall under ${labelOf(topKey)}.`,
    recommendations,
  };
}

// Converts the backend briefing into the shape this section renders.
function fromBackend(result, fallback) {
  if (!result || result.empty || !result.insight) return null;
  const { headline, summary, hotspots, recommendations } = result.insight;
  if (!summary) return null;

  const hotspotText =
    Array.isArray(hotspots) && hotspots.length
      ? hotspots
          .slice(0, 2)
          .map((h) => `${h.area} (${h.issue})`)
          .join(" · ")
      : fallback.hotspots;

  return {
    summary,
    topConcern: headline || fallback.topConcern,
    hotspots: hotspotText,
    recommendations:
      Array.isArray(recommendations) && recommendations.length ? recommendations : fallback.recommendations,
  };
}

export default function AIInsightsSection({ reports = [] }) {
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState(null);

  // Recomputes whenever reports change, so filing a report updates the briefing immediately.
  const local = useMemo(() => buildBriefing(reports), [reports]);

  // A backend briefing is only valid for the reports it was generated from.
  useEffect(() => {
    setRemote(null);
  }, [reports]);

  const briefing = remote || local;

  const regenerate = async () => {
    setLoading(true);
    try {
      const mapped = fromBackend(await getBriefing(), local);
      if (mapped) setRemote(mapped);
    } catch (err) {
      console.warn("[CivicLens] Backend briefing unavailable, using local briefing.", err);
    } finally {
      setLoading(false);
    }
  };

  const recommendations = Array.isArray(briefing.recommendations)
    ? briefing.recommendations
    : [briefing.recommendations];

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="rounded-3xl border border-white/10 bg-[#0a0f18]/80 p-6 shadow-2xl sm:p-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              AI INSIGHTS
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              A briefing written from the reports
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              CivicLens reads every public report and drafts what a city analyst would: the pattern, the hotspots, and
              what to do next.
            </p>
          </div>

          <button
            type="button"
            onClick={regenerate}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-semibold text-[#04140e] shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Reading the city…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Regenerate briefing</span>
              </>
            )}
          </button>
        </div>

        {!loading && (
          <div className="mt-8 space-y-6 border-t border-white/10 pt-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <FileText className="h-4 w-4" />
                  Executive Summary
                </div>
                <p className="text-xs leading-relaxed text-white/80">{briefing.summary}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <TrendingUp className="h-4 w-4" />
                  Primary Trend &amp; Hotspots
                </div>
                <p className="text-xs leading-relaxed text-white/80">{briefing.topConcern}</p>
                <p className="mt-2 text-xs leading-relaxed text-white/60">{briefing.hotspots}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <ShieldCheck className="h-4 w-4" />
                  Recommended Action
                </div>
                <ul className="list-inside list-disc space-y-1.5 text-xs text-white/80">
                  {recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}