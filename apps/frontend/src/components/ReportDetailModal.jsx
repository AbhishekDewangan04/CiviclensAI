import React from "react";
import { format } from "date-fns";
import { Check, Clock, MapPin, RotateCcw, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Pill from "@/components/Pill";
import { CATEGORY_MAP, SEVERITY_MAP, STATUS_MAP, isCritical, severityTone, statusTone } from "@/lib/reportMeta";
import { Image } from "@/components/ui/image";

export default function ReportDetailModal({ report, open, onOpenChange, isMine, onStatusChange }) {
  if (!report) return null;

  const meta = CATEGORY_MAP[report.category] || CATEGORY_MAP.other;
  const Icon = meta.Icon;
  const resolved = report.status === "resolved";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0A0F1A]/95 backdrop-blur-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-semibold leading-snug tracking-tight text-white">
            {report.title}
          </DialogTitle>
        </DialogHeader>

        {report.photo_url ? (
          <div className="mt-2 h-52 w-full overflow-hidden rounded-2xl border border-white/10">
            <Image src={report.photo_url} alt={report.title} className="h-full w-full object-cover" fittingType="fill" />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Pill tone={statusTone(report)} pulse={isCritical(report)}>
            {STATUS_MAP[report.status]?.label || report.status}
          </Pill>
          <Pill tone={severityTone(report)}>{SEVERITY_MAP[report.severity]?.label || "Medium"}</Pill>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55">
            <Icon className="h-3 w-3 text-emerald-400" />
            {meta.label}
          </span>
          {isMine && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              Filed from this device
            </span>
          )}
        </div>

        {report.description ? (
          <p className="mt-5 text-[14px] leading-relaxed text-white/60">{report.description}</p>
        ) : (
          <p className="mt-5 text-[14px] italic text-white/30">No extra details were added.</p>
        )}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
            <dt className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
              <MapPin className="h-3 w-3" />
              Location
            </dt>
            <dd className="mt-2 text-[13px] text-white/70">{report.address || "Pinned location"}</dd>
            {typeof report.lat === "number" && typeof report.lng === "number" && (
              <dd className="mt-1 text-[11.5px] text-white/35">
                {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
              </dd>
            )}
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
            <dt className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
              <Clock className="h-3 w-3" />
              Filed
            </dt>
            <dd className="mt-2 text-[13px] text-white/70">
              {format(new Date(report.created_date), "d MMM yyyy, HH:mm")}
            </dd>
            <dd className="mt-1 text-[11.5px] text-white/35">Last updated {format(new Date(report.updated_date || report.created_date), "d MMM yyyy, HH:mm")}</dd>
          </div>
        </dl>

        {isMine && onStatusChange && (
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/8 pt-5">
            <span className="text-[12px] text-white/40">
              {resolved ? "The issue is fixed? Leave it closed, or reopen if it returns." : "Once the issue is fixed, close it here."}
            </span>
            <button
              type="button"
              onClick={() => onStatusChange(report)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[12.5px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
            >
              {resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {resolved ? "Reopen report" : "Mark as resolved"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}