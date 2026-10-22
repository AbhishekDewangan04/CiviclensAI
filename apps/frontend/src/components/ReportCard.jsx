import React from "react";
import { ArrowUpRight, Check, Clock, MapPin, RotateCcw, Waypoints } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Pill from "@/components/Pill";
import { CATEGORY_MAP, SEVERITY_MAP, STATUS_MAP, isCritical, severityTone, statusTone } from "@/lib/reportMeta";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

export default function ReportCard({ report, onOpen, onTrack, onStatusChange }) {
  const meta = CATEGORY_MAP[report.category] || CATEGORY_MAP.other;
  const Icon = meta.Icon;
  const critical = isCritical(report);
  const resolved = report.status === "resolved";

  return (
    <article
      className={cn(
        "glass-card group relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1",
        critical ? "border-rose-500/30" : "border-white/10 hover:border-emerald-500/25"
      )}
    >
      {critical && (
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/70 to-transparent" />
      )}

      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-400">
          <Icon className="h-4 w-4" />
        </span>
        <Pill tone={statusTone(report)} pulse={critical}>
          {STATUS_MAP[report.status]?.label || report.status}
        </Pill>
      </div>

      <button type="button" onClick={() => onOpen(report)} className="mt-4 text-left">
        <h3 className="font-display text-[17px] font-medium leading-snug tracking-tight text-white transition-colors group-hover:text-emerald-300">
          {report.title}
        </h3>
      </button>

      {report.description ? (
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/45">{report.description}</p>
      ) : null}

      {report.photo_url ? (
        <div className="mt-4 h-36 w-full overflow-hidden rounded-xl border border-white/10">
          <Image src={report.photo_url} alt={report.title} className="h-full w-full object-cover" fittingType="fill" />
        </div>
      ) : null}

      <div className="mt-4 space-y-2 text-[12px] text-white/45">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-white/30" />
          <span className="truncate">{report.address || "Pinned location"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-white/30" />
          <span>{formatDistanceToNow(new Date(report.created_date), { addSuffix: true })}</span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/8 pt-4">
        <Pill tone={severityTone(report)}>{SEVERITY_MAP[report.severity]?.label || "Medium"}</Pill>

        <div className="flex items-center gap-2">
          {onTrack && (
            <button
              type="button"
              onClick={() => onTrack(report)}
              title="Show on the city map"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55 transition hover:border-emerald-500/30 hover:text-white"
            >
              <Waypoints className="h-3.5 w-3.5" />
              Map
            </button>
          )}
          {onStatusChange && (
            <button
              type="button"
              onClick={() => onStatusChange(report)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55 transition hover:border-emerald-500/30 hover:text-white"
            >
              {resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {resolved ? "Reopen" : "Resolve"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(report)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55 transition hover:border-emerald-500/30 hover:text-white"
          >
            Details
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </article>
  );
}