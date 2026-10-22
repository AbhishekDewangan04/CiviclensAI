import React from "react";
import { Sparkles, MapPin, CheckCircle2 } from "lucide-react";
import Pill from "@/components/Pill";

export default function TriagePreview({ formData }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Review & AI Triage</h3>
        <p className="mt-1 text-sm text-white/60">
          Verify your issue summary before broadcasting it to public routing queues.
        </p>
      </div>

      {/* AI Triage Card */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <Sparkles className="h-4 w-4" />
          Automated AI Triage Signal
        </div>
        <p className="mt-2 text-xs leading-relaxed text-emerald-200/80">
          Based on your description, this report will be routed directly to the{" "}
          <strong className="text-white">Public Works & Municipal Sanitation Department</strong> with high dispatch priority.
        </p>
      </div>

      {/* Report Summary Details */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs">
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-white/50">Title</span>
          <span className="font-medium text-white">{formData.title || "Untitled Issue"}</span>
        </div>
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-white/50">Category</span>
          <span className="font-medium text-emerald-300 capitalize">{formData.category || "General"}</span>
        </div>
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-white/50">Severity</span>
          <Pill tone={formData.severity === "critical" ? "rose" : "emerald"}>
            {formData.severity || "medium"}
          </Pill>
        </div>
        <div className="flex items-start justify-between pt-1">
          <span className="text-white/50">Location</span>
          <span className="inline-flex items-center gap-1 font-medium text-white/80">
            <MapPin className="h-3 w-3 text-emerald-400" />
            {formData.address || "Pinned on Map"}
          </span>
        </div>
      </div>

      {/* Proof Photo Preview */}
      {formData.photo && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3">
          <img src={formData.photo} alt="Proof preview" className="h-12 w-12 rounded-lg object-cover" />
          <div>
            <p className="text-xs font-medium text-white">Image Proof Attached</p>
            <p className="text-[11px] text-white/50">Stored securely for field crew audit</p>
          </div>
          <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" />
        </div>
      )}
    </div>
  );
}