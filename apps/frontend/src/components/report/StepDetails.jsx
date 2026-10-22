import React from "react";
import { CATEGORIES, SEVERITIES } from "@/lib/reportMeta";

export default function StepDetails({ formData, onChange, errors = {} }) {
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-white">Issue Details</h3>
        <p className="mt-1 text-sm text-white/60">
          Describe what you observed so city teams can prioritize it.
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-white/80">Issue Title *</label>
        <input
          type="text"
          value={formData.title || ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., Overflowing garbage bin or deep pothole"
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-500/50"
        />
        {errors.title && <p className="mt-1 text-xs text-rose-400">{errors.title}</p>}
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-xs font-medium text-white/80">Category *</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.Icon;
            const active = formData.category === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => onChange({ category: cat.value })}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/5"
                }`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="text-xs font-medium">{cat.label}</span>
              </button>
            );
          })}
        </div>
        {errors.category && <p className="mt-1 text-xs text-rose-400">{errors.category}</p>}
      </div>

      {/* Severity */}
      <div>
        <label className="block text-xs font-medium text-white/80">Perceived Severity</label>
        <div className="mt-2 flex gap-2">
          {SEVERITIES.map((sev) => {
            const active = formData.severity === sev.value;
            return (
              <button
                key={sev.value}
                type="button"
                onClick={() => onChange({ severity: sev.value })}
                className={`flex-1 rounded-xl border py-2 text-xs font-medium capitalize transition ${
                  active
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {sev.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-white/80">Description</label>
        <textarea
          rows={3}
          value={formData.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Provide context, surrounding landmarks, or immediate hazards…"
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-xs font-medium text-white/80">Attach Photo (Optional)</label>
        <div className="mt-2 flex items-center gap-3">
          {formData.photo ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/15">
              <img src={formData.photo} alt="Upload preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange({ photo: null })}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-1 text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-xs text-white/60 hover:border-emerald-500/50 hover:bg-white/5">
              <Camera className="h-4 w-4 text-emerald-400" />
              <span>Upload image proof</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}