import React from "react";
import { Route, Send, Droplets, Zap, Trees, Building2, ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { useParallax } from "@/hooks/useParallax";

const TEAMS = [
  { icon: Building2, label: "Roads", tone: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" },
  { icon: Zap, label: "Streetlights", tone: "text-amber-300 border-amber-500/25 bg-amber-500/10" },
  { icon: Droplets, label: "Water", tone: "text-sky-300 border-sky-500/25 bg-sky-500/10" },
  { icon: Trees, label: "Parks", tone: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" },
];

export default function FeatureDispatch() {
  const bg = useParallax(0.08);
  const graphic = useParallax(0.16);

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden py-24">
      <div
        ref={bg.ref}
        style={{ transform: `translate3d(0, ${bg.offset}px, 0)` }}
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-40 top-1/4 h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute -left-32 bottom-0 h-[380px] w-[380px] rounded-full bg-sky-500/8 blur-[150px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        {/* Glass graphic — slower parallax layer behind the text */}
        <div ref={graphic.ref} style={{ transform: `translate3d(0, ${graphic.offset}px, 0)` }}>
          <Reveal mode="left">
            <div className="glass-card relative overflow-hidden rounded-3xl border border-white/10 p-6 shadow-panel sm:p-8">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                <Route className="h-3.5 w-3.5 text-emerald-400" />
                Dispatch routing
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] font-medium text-emerald-200">
                  <Send className="h-4 w-4" />
                  Filed report
                </div>
                <ArrowRight className="h-4 w-4 text-white/30" />
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] font-medium text-white/70">
                  Auto-route
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {TEAMS.map(({ icon: Icon, label, tone }) => (
                  <div key={label} className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-[12.5px] font-medium ${tone}`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-2.5 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                {[
                  { label: "Filed", value: "12:04", tone: "bg-white/30" },
                  { label: "Routed · Roads team", value: "12:04", tone: "bg-amber-400" },
                  { label: "In review", value: "12:21", tone: "bg-sky-400" },
                  { label: "Resolved", value: "—", tone: "bg-emerald-400" },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-3 text-[12px] text-white/65">
                    <span className={`h-1.5 w-1.5 rounded-full ${step.tone}`} />
                    <span className="flex-1">{step.label}</span>
                    <span className="font-mono text-white/40">{step.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Text in front — moves with the scroll, faster than the graphic */}
        <Reveal mode="right">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
            <Send className="h-3.5 w-3.5" />
            Feature 03 · Municipal dispatch
          </span>

          <h2 className="mt-6 font-display text-[2.3rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-[2.9rem]">
            From your street to the right team,
            <br />
            <span className="text-emerald-400 text-glow-emerald">automatically.</span>
          </h2>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/55">
            Filed reports route straight to the official city teams that own them — roads, lights, water, parks — and
            citizens get live status updates as the work moves from filed to reviewed to resolved.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12.5px] text-white/70">
              <span className="font-semibold text-white">Auto-routing</span> to the owning team
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12.5px] text-white/70">
              <span className="font-semibold text-white">Live status</span> back to the reporter
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}