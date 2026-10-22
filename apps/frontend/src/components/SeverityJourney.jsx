import React from "react";
import { CircleDot, Trash2, Lightbulb, Droplets, Zap, AlertTriangle, Gauge } from "lucide-react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

const STAGES = [
  {
    label: "Low · Active",
    color: [16, 185, 129],
    title: "Low severity, actively tracked",
    desc: "Minor community reports move through the system calmly — potholes, missed street cleaning, faded signage — logged and queued for routine review.",
    incidents: [
      { icon: CircleDot, label: "Pothole on 5th Avenue", meta: "Logged 2h ago" },
      { icon: Trash2, label: "Missed street cleaning", meta: "Scheduled tomorrow" },
    ],
  },
  {
    label: "Medium · In review",
    color: [245, 158, 11],
    title: "Medium priority, under review",
    desc: "Issues that disrupt daily life — broken streetlights, water pipe leaks — get flagged for review and routed to the owning team within the hour.",
    incidents: [
      { icon: Lightbulb, label: "Broken streetlight · 12th St", meta: "Routed · Lights" },
      { icon: Droplets, label: "Water pipe leak · Park Rd", meta: "Routed · Water" },
    ],
  },
  {
    label: "Critical · Emergency",
    color: [244, 63, 94],
    title: "Critical alert, emergency dispatch",
    desc: "Urgent hazards — downed power lines, hazardous blockages — trigger an emergency alert and route instantly to the nearest response team.",
    incidents: [
      { icon: Zap, label: "Downed power line · Elm St", meta: "Emergency dispatched" },
      { icon: AlertTriangle, label: "Hazardous road blockage", meta: "Crew en route" },
    ],
  },
];

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const lerp = (a, b, t) => a + (b - a) * t;

function accentAt(p) {
  const cols = STAGES.map((s) => s.color);
  const mix = (a, b, t) => [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
  if (p <= 1 / 6) return cols[0];
  if (p <= 0.5) return mix(cols[0], cols[1], (p - 1 / 6) / (1 / 3));
  if (p <= 5 / 6) return mix(cols[1], cols[2], (p - 0.5) / (1 / 3));
  return cols[2];
}

export default function SeverityJourney() {
  const { ref, progress } = useScrollProgress();
  const accent = accentAt(progress);
  const stageFloat = progress * 3;
  const activeStage = Math.min(2, Math.max(0, Math.floor(stageFloat)));
  const opacities = STAGES.map(
    (_, i) => Math.max(0, Math.min(1, 1 - Math.abs(progress - (i + 0.5) / 3) * 3))
  );

  return (
    <section ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${rgba(accent, 0.14)}, transparent 58%), radial-gradient(circle at 50% 72%, ${rgba(accent, 0.08)}, transparent 52%)`,
          }}
        />
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-20" />

        <div className="absolute inset-x-0 top-16 mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              <Gauge className="h-3.5 w-3.5" />
              Severity & Urgency Journey
            </span>
            <span className="font-mono text-[11px] tracking-[0.2em] text-white/45">
              Stage {String(activeStage + 1).padStart(2, "0")} / 03
            </span>
          </div>
        </div>

        <div className="float-slow relative w-[min(90vw,560px)]">
          <div
            className="glass-card relative overflow-hidden rounded-3xl border p-8 shadow-panel sm:p-10"
            style={{
              transform: "perspective(1200px) rotateX(8deg) rotateY(-10deg)",
              borderColor: rgba(accent, 0.35),
              boxShadow: `0 30px 80px -30px ${rgba(accent, 0.45)}, 0 0 60px -20px ${rgba(accent, 0.3)}`,
            }}
          >
            <div className="relative min-h-[340px] sm:min-h-[360px]">
              {STAGES.map((stage, i) => (
                <div
                  key={stage.label}
                  className="absolute inset-0 flex flex-col"
                  style={{ opacity: opacities[i] }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        borderColor: rgba(stage.color, 0.4),
                        background: rgba(stage.color, 0.12),
                        color: rgb(stage.color),
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: rgb(stage.color) }} />
                      {stage.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="mt-6 font-display text-[1.6rem] font-semibold leading-tight text-white sm:text-[1.9rem]">
                    {stage.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/55">{stage.desc}</p>

                  <div className="mt-6 space-y-2.5">
                    {stage.incidents.map((inc) => {
                      const IncIcon = inc.icon;
                      return (
                        <div
                          key={inc.label}
                          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                        >
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                            style={{ background: rgba(stage.color, 0.12), color: rgb(stage.color) }}
                          >
                            <IncIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-white/90">{inc.label}</span>
                            <span className="text-[11px] text-white/40">{inc.meta}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 w-[min(90vw,640px)] -translate-x-1/2 px-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: rgb(accent), boxShadow: `0 0 16px ${rgba(accent, 0.8)}` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-[0.18em]">
            {STAGES.map((stage, i) => (
              <span
                key={stage.label}
                className="transition-colors duration-200"
                style={{ color: i === activeStage ? rgb(stage.color) : "rgba(255,255,255,0.3)" }}
              >
                {stage.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}