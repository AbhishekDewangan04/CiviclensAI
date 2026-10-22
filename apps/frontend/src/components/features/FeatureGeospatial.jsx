import React from "react";
import { Crosshair, MapPin } from "lucide-react";
import Reveal from "@/components/Reveal";
import { useParallax } from "@/hooks/useParallax";

export default function FeatureGeospatial() {
  const bg = useParallax(0.12);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden py-24">
      <div
        ref={bg.ref}
        style={{ transform: `translate3d(0, ${bg.offset}px, 0)` }}
        className="pointer-events-none absolute inset-0"
      >
        <div className="grid-backdrop absolute inset-0 opacity-25" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/15" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/10" />
        <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[90px]" />
      </div>

      <Reveal mode="scale" className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
          <Crosshair className="h-3.5 w-3.5" />
          Feature 02 · Geospatial precision
        </span>

        <h2 className="mx-auto mt-6 max-w-2xl font-display text-[2.3rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-[2.9rem]">
          Exact pins. <span className="text-emerald-400 text-glow-emerald">Zero hallucination.</span>
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-white/55">
          Each report drops onto the live 3D city grid at the precise coordinate it was given — no AI-guessed
          locations, no drift. What you see on the map is exactly where the issue is.
        </p>

        <div className="glass-card mx-auto mt-10 max-w-md rounded-2xl border border-white/10 p-5 text-left shadow-panel">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            <span>Coordinate lock</span>
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/35">Latitude</div>
              <div className="mt-1 font-mono text-[15px] text-white">12.9716° N</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/35">Longitude</div>
              <div className="mt-1 font-mono text-[15px] text-white">77.5946° E</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-[12.5px] text-emerald-200">
            <MapPin className="h-4 w-4 shrink-0" />
            Pinned to the live 3D city grid · 1 m precision
          </div>
        </div>
      </Reveal>
    </section>
  );
}