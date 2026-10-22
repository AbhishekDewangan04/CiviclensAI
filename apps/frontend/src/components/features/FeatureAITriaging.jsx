import React, { useRef, useState } from "react";
import { Brain, Camera, Copy, AlertTriangle, ShieldCheck } from "lucide-react";
import Reveal from "@/components/Reveal";

const BULLETS = [
  { icon: Camera, label: "Photo-to-category in a single pass" },
  { icon: AlertTriangle, label: "Severity graded from low to critical" },
  { icon: Copy, label: "Duplicates flagged in real time" },
];

export default function FeatureAITriaging() {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const onMove = (event) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -py * 10, ry: px * 14 });
  };
  const reset = () => setTilt({ rx: 0, ry: 0 });

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/3 h-[440px] w-[440px] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute -right-32 bottom-10 h-[360px] w-[360px] rounded-full bg-amber-500/8 blur-[150px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <Reveal mode="left">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
            <Brain className="h-3.5 w-3.5" />
            Feature 01 · AI triage
          </span>

          <h2 className="mt-6 font-display text-[2.3rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-[2.9rem]">
            Every report, triaged
            <br />
            <span className="text-emerald-400 text-glow-emerald">before you blink.</span>
          </h2>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/55">
            The moment a photo lands, CiviCLens scans it — reading the scene, auto-categorizing the issue, grading its
            severity, and matching it against reports already on file so duplicates never flood the map.
          </p>

          <ul className="mt-8 space-y-3">
            {BULLETS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[14px] text-white/70">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal mode="right">
          <div
            ref={cardRef}
            onMouseMove={onMove}
            onMouseLeave={reset}
            style={{
              transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: "transform 220ms ease-out",
            }}
            className="glass-card relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 p-1 shadow-panel"
          >
            <div className="relative h-full w-full overflow-hidden rounded-[1.4rem] bg-[#070b15]">
              <div className="grid-backdrop absolute inset-0 opacity-40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="h-20 w-20 text-white/12" />
              </div>

              {/* sweeping AI scan line */}
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
                <div className="scan-line h-28 w-full bg-gradient-to-b from-transparent via-emerald-400/35 to-transparent" />
              </div>

              {/* corner brackets */}
              {[
                "left-3 top-3 border-l-2 border-t-2",
                "right-3 top-3 border-r-2 border-t-2",
                "left-3 bottom-3 border-l-2 border-b-2",
                "right-3 bottom-3 border-r-2 border-b-2",
              ].map((pos) => (
                <span key={pos} className={`absolute h-6 w-6 border-emerald-400/60 ${pos}`} />
              ))}

              {/* detection chips */}
              <div className="absolute left-5 top-5 flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                <AlertTriangle className="h-3 w-3" /> Severity · High
              </div>
              <div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> Category · Roads
              </div>
              <div className="absolute bottom-5 left-5 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                <Copy className="h-3 w-3" /> Duplicate · Matched
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}