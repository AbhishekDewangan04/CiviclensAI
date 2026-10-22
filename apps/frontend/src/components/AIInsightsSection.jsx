import React, { useState } from "react";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import Pill from "@/components/Pill";
import { SEVERITY_MAP } from "@/lib/reportMeta";
import { base44 } from "@/api/base44Client";

export default function AIInsightsSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("cityInsights", {});
      setResult(response.data);
    } catch (e) {
      setError("The briefing couldn't be written just now. Give it another try in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const insight = result && !result.empty ? result.insight : null;

  return (
    <section id="ai-insights" className="relative scroll-mt-32 border-t border-white/5 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow="AI Insights"
            title="A briefing written from the reports"
            description="CiviCLens reads every public report and drafts what a city analyst would: the pattern, the hotspots, and what to do next."
            action={
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-[13.5px] font-semibold text-[#04140E] transition-all duration-300 hover:bg-emerald-400 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Reading the city…" : insight ? "Regenerate briefing" : "Generate briefing"}
              </button>
            }
          />
        </ScrollReveal>

        <div className="mt-10">
          {error && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-5 py-4 text-[13px] text-rose-200">
              {error}
            </div>
          )}

          {!result && !loading && !error && (
            <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="mt-5 font-display text-xl text-white/80">No briefing generated yet.</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/45">
                Generate one to turn the newest public reports into a short written read of the city — patterns,
                hotspots and next moves.
              </p>
            </div>
          )}

          {loading && (
            <div className="glass-card rounded-3xl border border-white/10 p-6">
              <div className="h-5 w-2/3 rounded-full shimmer" />
              <div className="mt-5 space-y-3">
                <div className="h-3 w-full rounded-full shimmer" />
                <div className="h-3 w-11/12 rounded-full shimmer" />
                <div className="h-3 w-9/12 rounded-full shimmer" />
              </div>
            </div>
          )}

          {result && result.empty && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <p className="font-display text-lg text-white/80">Nothing to read yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
                A briefing needs at least one public report. File an issue and generate it again.
              </p>
            </div>
          )}

          {insight && (
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="glass-card rounded-3xl border border-white/10 p-6 shadow-panel">
                <h3 className="font-display text-2xl font-semibold leading-snug tracking-tight text-white sm:text-[1.75rem]">
                  {insight.headline}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-white/60">{insight.summary}</p>

                <div className="mt-7 space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">Hotspots</div>
                  {(insight.hotspots || []).map((spot, index) => {
                    const tone = SEVERITY_MAP[String(spot.severity || "").toLowerCase()]?.tone || "muted";
                    return (
                      <div
                        key={`${spot.area}-${index}`}
                        className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-white/90">
                            <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />
                            {spot.area}
                          </span>
                          <Pill tone={tone}>{spot.severity}</Pill>
                        </div>
                        <p className="mt-2 text-[13px] text-white/70">{spot.issue}</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">{spot.signal}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card h-fit rounded-3xl border border-white/10 p-6">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                  Recommended moves
                </div>
                <ol className="mt-5 space-y-4">
                  {(insight.recommendations || []).map((move, index) => (
                    <li key={index} className="flex gap-3.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 font-display text-[11px] font-semibold text-emerald-300">
                        {index + 1}
                      </span>
                      <span className="text-[13.5px] leading-relaxed text-white/65">{move}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-7 border-t border-white/8 pt-4 text-[11px] leading-relaxed text-white/30">
                  Written from {result.total} public report{result.total === 1 ? "" : "s"} · an AI reading of open civic
                  data, not an official statement.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}