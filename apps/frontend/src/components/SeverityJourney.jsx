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

// Amount of wheel / touch travel (px) needed to go from Low (0) to Critical (1).
const TRAVEL_PX = 1400;
// Navbar height, so the card is centred in the visible area below it.
const NAV_OFFSET = 40;

/**
 * Locks page scroll while the section is centred on screen and converts
 * wheel / touch / keyboard input into 0 → 1 progress. When progress reaches
 * either end the lock releases and the page scrolls normally again.
 */
function useScrollLockProgress(ref) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const s = {
      target: 0,
      current: 0,
      locked: false,
      lockY: 0,
      prevD: null,
      raf: 0,
      touchY: null,
    };

    const tick = () => {
      const diff = s.target - s.current;
      s.current = Math.abs(diff) < 0.0005 ? s.target : s.current + diff * 0.14;
      setProgress(s.current);
      s.raf = s.current !== s.target ? window.requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!s.raf) s.raf = window.requestAnimationFrame(tick);
    };
    const jumpTo = (value) => {
      s.target = value;
      s.current = value;
      setProgress(value);
    };

    // Distance between the section's centre and the target screen centre.
    const measure = () => {
      const r = node.getBoundingClientRect();
      return { r, d: r.top + r.height / 2 - (window.innerHeight / 2 + NAV_OFFSET) };
    };

    const release = () => {
      s.locked = false;
      s.touchY = null;
      s.prevD = measure().d;
    };

    const advance = (delta) => {
      const next = s.target + delta / TRAVEL_PX;
      if (delta > 0 && next >= 1) {
        s.target = 1;
        release();
      } else if (delta < 0 && next <= 0) {
        s.target = 0;
        release();
      } else {
        s.target = clamp01(next);
      }
      kick();
    };

    const engage = (d) => {
      window.scrollTo({ top: window.scrollY + d, behavior: "instant" });
      s.lockY = window.scrollY;
      s.locked = true;
      s.prevD = 0;
    };

    const onScroll = () => {
      if (s.locked) {
        if (window.scrollY !== s.lockY) window.scrollTo({ top: s.lockY, behavior: "instant" });
        return;
      }

      const { r, d } = measure();

      // Fully off-screen: park progress at the matching end.
      if (r.top > window.innerHeight && s.target !== 0) jumpTo(0);
      else if (r.bottom < 0 && s.target !== 1) jumpTo(1);

      const prev = s.prevD;
      s.prevD = d;
      if (prev === null) return;

      const goingDown = prev > d;
      const crossedDown = prev > 0 && d <= 0 && goingDown && s.target < 1;
      const crossedUp = prev < 0 && d >= 0 && !goingDown && s.target > 0;
      if (crossedDown || crossedUp) engage(d);
    };

    const onWheel = (e) => {
      if (!s.locked) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const delta = Math.max(-120, Math.min(120, e.deltaY * unit));
      advance(delta);
    };

    const onTouchStart = (e) => {
      s.touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (!s.locked) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      if (s.touchY !== null) advance((s.touchY - y) * 2.4);
      s.touchY = y;
    };

    const onKeyDown = (e) => {
      if (!s.locked) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = TRAVEL_PX / 6;
      let delta = 0;
      if (e.key === "ArrowDown") delta = step / 2;
      else if (e.key === "ArrowUp") delta = -step / 2;
      else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) delta = step;
      else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) delta = -step;
      else if (e.key === "End") delta = TRAVEL_PX;
      else if (e.key === "Home") delta = -TRAVEL_PX;
      else return;
      e.preventDefault();
      advance(delta);
    };

    // Initial state (handles reloads in the middle of the page).
    const init = measure();
    s.prevD = init.d;
    if (init.r.bottom < 0) jumpTo(1);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (s.raf) window.cancelAnimationFrame(s.raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ref]);

  return progress;
}

export default function SeverityJourney() {
  const ref = useRef(null);
  const progress = useScrollLockProgress(ref);

  const p = clamp01(progress);
  const accent = accentAt(p);

  // Stage 0 (0 to 0.33), Stage 1 (0.33 to 0.66), Stage 2 (0.66 to 1.0)
  const activeStage = Math.min(2, Math.floor(p * 2.999));

  return (
    <section ref={ref} className="relative mb-0 mt-28 pb-0 sm:mt-40">
      <div className="relative flex flex-col items-center justify-center py-0">
        {/* Glow Backdrop */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 transition-all duration-300"
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
            className="glass-card relative overflow-hidden rounded-3xl border p-6 shadow-panel transition-all duration-200 sm:p-8"
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
                    className="absolute inset-0 flex flex-col transition-opacity duration-150"
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