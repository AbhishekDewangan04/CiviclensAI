import React from "react";
import { cn } from "@/lib/utils";
import { TONES } from "@/lib/reportMeta";

export default function Pill({ tone = "muted", children, pulse = false, className = "" }) {
  const t = TONES[tone] || TONES.muted;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]",
        t.bg,
        t.border,
        t.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot, pulse && "animate-pulse")} />
      {children}
    </span>
  );
}