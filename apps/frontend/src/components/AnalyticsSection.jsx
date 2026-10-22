import React from "react";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";

export default function AnalyticsSection({ reports = [] }) {
  // Use passed reports or default local baseline counts
  const total = reports.length > 0 ? reports.length : 14;
  const pending = reports.length > 0 ? reports.filter((r) => r.status === "pending").length : 7;
  const critical = reports.length > 0 ? reports.filter((r) => r.severity === "critical").length : 3;
  const resolutionRate = reports.length > 0 ? Math.round(((total - pending) / total) * 100) : 50;

  return (
    <section id="analytics" className="relative scroll-mt-32 border-t border-white/5 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Analytics"
            title="What the city is telling us"
            description="The shape of the signal: how much is coming in, where it clusters, and how fast it clears."
            action={null}
          />
        </ScrollReveal>

        {/* Top Metric Cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Reports Filed
            </span>
            <p className="mt-3 text-3xl font-bold text-white">{total}</p>
            <p className="mt-1 text-xs text-white/50">All public reports</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Still Open
            </span>
            <p className="mt-3 text-3xl font-bold text-amber-400">{pending}</p>
            <p className="mt-1 text-xs text-white/50">Pending or in review</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Critical Signals
            </span>
            <p className="mt-3 text-3xl font-bold text-rose-400">{critical}</p>
            <p className="mt-1 text-xs text-white/50">Emergency-grade reports</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Resolution Rate
            </span>
            <p className="mt-3 text-3xl font-bold text-emerald-400">{resolutionRate}%</p>
            <p className="mt-1 text-xs text-white/50">Closed by civic response teams</p>
          </div>
        </div>

        {/* Category & Status Mix Preview */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
            <h4 className="text-sm font-semibold text-white">Category Mix</h4>
            <div className="mt-4 space-y-3">
              {[
                { label: "Roads & Potholes", pct: "42%", count: 6, color: "bg-emerald-500" },
                { label: "Waste & Sanitation", pct: "28%", count: 4, color: "bg-amber-500" },
                { label: "Street Lighting", pct: "18%", count: 3, color: "bg-cyan-500" },
                { label: "Water & Drainage", pct: "12%", count: 1, color: "bg-blue-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-white/70 mb-1">
                    <span>{item.label}</span>
                    <span>{item.pct}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full ${item.color}`} style={{ width: item.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
            <h4 className="text-sm font-semibold text-white">Status Distribution</h4>
            <div className="mt-4 space-y-3">
              {[
                { label: "Pending Triage", pct: "50%", color: "bg-amber-400" },
                { label: "In Review", pct: "25%", color: "bg-blue-400" },
                { label: "Resolved", pct: "25%", color: "bg-emerald-400" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-white/70 mb-1">
                    <span>{item.label}</span>
                    <span>{item.pct}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full ${item.color}`} style={{ width: item.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}