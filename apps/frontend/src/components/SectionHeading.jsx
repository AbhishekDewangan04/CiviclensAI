import React from "react";

export default function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400/80">
          <span className="h-px w-7 bg-emerald-400/50" />
          {eyebrow}
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-white/50">{description}</p>}
      </div>
      {action}
    </div>
  );
}