import React, { useEffect, useRef, useState } from "react";
import { CircleDot, Trash2, Lightbulb, Droplets, Zap, AlertTriangle, Gauge } from "lucide-react";

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
const clamp01 = (n) => Math.max(0, Math.min(1, n));

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

// Page-scroll distance (px) the card stays pinned while going Low (0) -> Critical (1).
const TRAVEL_PX = 1400;
// Navbar height, so the card is centred in the visible area below it.
const NAV_OFFSET = 40;

/**
 * Progress (0 -> 1) derived purely from where the section sits in the page.
 *
 * The card is pinned with CSS `position: sticky`, so the browser does all the
 * scrolling itself. Nothing here blocks wheel/touch input or calls scrollTo,
 * which means every scroll method works and can never get stuck: mouse wheel,
 * trackpad momentum, middle-click autoscroll, scrollbar drag, keyboard, touch,
 * and programmatic scrollIntoView.
 */
function useSectionProgress(ref) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let raf = 0;

    const update = () => {
      raf = 0;
      const { top } = node.getBoundingClientRect();
      const next = clamp01(-top / TRAVEL_PX);
      setProgress((prev) => (Math.abs(prev - next) < 0.0005 ? prev : next));
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);

  return progress;
}

export default function SeverityJourney() {
  const ref = useRef(null);
  const progress = useSectionProgress(ref);

  const p = clamp01(progress);
  const accent = accentAt(p);

  // Stage 0 (0 to 0.33), Stage 1 (0.33 to 0.66), Stage 2 (0.66 to 1.0)
  const activeStage = Math.min(2, Math.floor(p * 2.999));

  return (
    <section
      ref={ref}
      className="relative mb-0 mt-28 pb-0 sm:mt-40"
      style={{ height: `calc(100vh + ${TRAVEL_PX}px)` }}
    >
      <div
        className="sticky top-0 flex flex-col items-center justify-center"
        style={{ height: "100vh", paddingTop: NAV_OFFSET * 2 }}
      >
        {/* Glow Backdrop */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${rgba(accent, 0.15)}, transparent 60%)`,
          }}
        />

        {/* Top Header Badge */}
        <div className="mx-auto mb-3 w-full max-w-7xl px-5 sm:px-8">
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

        {/* 3D Glass Card */}
        <div className="relative mx-auto w-[min(90vw,560px)]">
          <div
            className="glass-card relative overflow-hidden rounded-3xl border p-6 shadow-panel sm:p-8"
            style={{
              transform: "perspective(1200px) rotateX(6deg) rotateY(-8deg)",
              borderColor: rgba(accent, 0.35),
              boxShadow: `0 20px 60px -20px ${rgba(accent, 0.4)}, 0 0 40px -15px ${rgba(accent, 0.25)}`,
            }}
          >
            <div className="relative min-h-[300px] sm:min-h-[320px]">
              {STAGES.map((stage, i) => {
                const stageTarget = i / 2;
                const dist = Math.abs(p - stageTarget);
                const opacity = Math.max(0, Math.min(1, 1 - dist * 2.8));

                return (
                  <div
                    key={stage.label}
                    className="absolute inset-0 flex flex-col"
                    style={{
                      opacity,
                      visibility: opacity > 0.01 ? "visible" : "hidden",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
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

                    <h3 className="mt-4 font-display text-[1.5rem] font-semibold leading-tight text-white sm:text-[1.8rem]">
                      {stage.title}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{stage.desc}</p>

                    <div className="mt-5 space-y-2.5">
                      {stage.incidents.map((inc) => {
                        const IncIcon = inc.icon;
                        return (
                          <div
                            key={inc.label}
                            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5"
                          >
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                              style={{ background: rgba(stage.color, 0.12), color: rgb(stage.color) }}
                            >
                              <IncIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium text-white/90">{inc.label}</span>
                              <span className="text-[10.5px] text-white/40">{inc.meta}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mx-auto mt-3 w-[min(90vw,640px)] px-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${p * 100}%`,
                background: rgb(accent),
                boxShadow: `0 0 16px ${rgba(accent, 0.8)}`,
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-[0.18em]">
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
