import React from "react";

export default function AnalyticsSection({ reports = [], counts = {} }) {
  const total = counts.total ?? reports.length;
  const open = counts.open ?? 0;
  const critical = counts.critical ?? 0;
  const resolved = counts.resolved ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Calculate dynamic category percentages
  const categoryCounts = reports.reduce((acc, r) => {
    if (r.category) acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <section id="analytics" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="mb-8">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400">
          Analytics
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          What the city is telling us
        </h2>
        <p className="mt-1 text-sm text-white/50">
          The shape of the signal: how much is coming in, where it clusters, and how fast it clears.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#061410] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Reports Filed
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{total}</p>
          <p className="mt-1 text-xs text-white/40">All public reports</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#061410] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Still Open
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{open}</p>
          <p className="mt-1 text-xs text-white/40">Pending or in review</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#061410] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Critical Signals
          </p>
          <p className="mt-2 text-3xl font-bold text-rose-400">{critical}</p>
          <p className="mt-1 text-xs text-white/40">Emergency-grade reports</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#061410] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Resolution Rate
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">{resolutionRate}%</p>
          <p className="mt-1 text-xs text-white/40">Closed by civic response teams</p>
        </div>
      </div>
    </section>
  );
}