import React, { useRef } from "react";
import { ArrowDown, MapPin, Plus, Signal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Pill from "@/components/Pill";
import CityGlobe from "@/components/CityGlobe";
import { CATEGORY_MAP, isCritical } from "@/lib/reportMeta";

export default function HeroSection({ 
  counts = {}, 
  latest = [], 
  onReport, 
  onExplore, 
  onOpenReport 
}) {
  const sectionRef = useRef(null);

  // Safe numeric fallbacks to prevent NaN console warnings
  const safeCounts = {
    total: typeof counts?.total === "number" ? counts.total : 0,
    open: typeof counts?.open === "number" ? counts.open : 0,
    critical: typeof counts?.critical === "number" ? counts.critical : 0,
    resolved: typeof counts?.resolved === "number" ? counts.resolved : 0,
  };

  const stats = [
    { label: "Reports filed", value: safeCounts.total },
    { label: "Still open", value: safeCounts.open },
    { label: "Critical signals", value: safeCounts.critical },
    { label: "Resolved", value: safeCounts.resolved },
  ];

  // Helper function to safely format dates
  const safeFormatDate = (dateString) => {
    if (!dateString) return "Just now";
    const parsedDate = new Date(dateString);
    if (isNaN(parsedDate.getTime())) return "Recently";
    return formatDistanceToNow(parsedDate, { addSuffix: true });
  };

  return (
    <section id="overview" ref={sectionRef} className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-backdrop grid-fade absolute inset-x-0 top-0 h-[760px]" />
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-emerald-500/12 blur-[130px]" />
        <div className="absolute -right-24 top-32 h-[380px] w-[380px] rounded-full bg-rose-500/10 blur-[140px]" />
        <div className="absolute inset-x-0 top-0 h-[600px] overflow-hidden">
          <div className="scan-line h-28 w-full bg-gradient-to-b from-transparent via-emerald-400/6 to-transparent" />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Pill tone="success" pulse>
              Live civic intelligence
            </Pill>

            <h1 className="mt-7 font-display text-[2.7rem] font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-[4.15rem]">
              Your city, in
              <br />
              <span className="text-emerald-400 text-glow-emerald">sharp focus.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/55 sm:text-base">
              CiviCLens turns scattered local complaints into one public picture. File what you see on your street, watch
              it land on the live city map, and let AI read the pattern underneath the noise.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onReport}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-[13.5px] font-semibold text-[#04140E] transition-all duration-300 hover:bg-emerald-400 hover:shadow-glow-lg"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                Report an Issue
              </button>
              <button
                type="button"
                onClick={onExplore}
                className="glass-card inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-[13.5px] font-medium text-white/75 transition-all duration-300 hover:border-emerald-500/30 hover:text-white"
              >
                Explore the live map
              </button>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-[#0B1120]/50 px-5 py-5">
                  <div className="font-display text-3xl font-semibold tracking-tight text-white">{stat.value}</div>
                  <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onExplore}
              className="mt-12 hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/30 transition hover:text-white/60 lg:flex"
            >
              <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
              Scroll to explore
            </button>
          </div>

          <div className="space-y-6 lg:space-y-7">
            <div className="glass-card relative overflow-hidden rounded-3xl border border-white/10 p-3 shadow-panel sm:p-4">
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">Live city mesh</span>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </div>
              <div className="relative h-[300px] sm:h-[380px] lg:h-[420px]">
                <CityGlobe sectionRef={sectionRef} className="h-full w-full" />
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-white/10 p-5 shadow-panel sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  <Signal className="h-3.5 w-3.5 text-emerald-400" />
                  Latest signals
                </div>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {(!latest || latest.length === 0) ? (
                  <div className="rounded-2xl border border-dashed border-white/12 px-4 py-10 text-center">
                    <p className="text-sm text-white/45">No reports yet — the lens is clear.</p>
                    <button
                      type="button"
                      onClick={onReport}
                      className="mt-3 text-[13px] font-medium text-emerald-400 transition hover:text-emerald-300"
                    >
                      File the first one →
                    </button>
                  </div>
                ) : (
                  latest.map((report) => {
                    const meta = CATEGORY_MAP[report?.category] || CATEGORY_MAP.other;
                    const Icon = meta.Icon;
                    return (
                      <button
                        key={report.id || Math.random()}
                        type="button"
                        onClick={() => onOpenReport?.(report)}
                        className="group flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left transition-all duration-300 hover:border-emerald-500/25 hover:bg-white/[0.05]"
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-400">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium text-white/90">{report.title || "Untitled Issue"}</span>
                            {isCritical(report) && (
                              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-400" />
                            )}
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{report.address || "Location pinned"}</span>
                            <span className="text-white/20">·</span>
                            <span className="shrink-0">
                              {safeFormatDate(report.created_date)}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-4 text-[9.5px] uppercase tracking-[0.16em] text-white/35">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active / Resolved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Pending / In review
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Critical alert
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}