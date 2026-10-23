import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import LocationPicker from "@/components/LocationPicker";
import { CATEGORIES, SEVERITIES, TONES } from "@/lib/reportMeta";
import { createReport } from "@/lib/api";
import "leaflet/dist/leaflet.css";

const EMPTY_FORM = { title: "", description: "", category: "", severity: "medium", address: "" };

export default function ReportModal({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [coords, setCoords] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setCoords(null);
      setErrors({});
      setStage("");
    }
  }, [open]);

  const update = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async () => {
    const next = {};
    if (form.title.trim().length < 4) next.title = "Give the issue a short, clear title.";
    if (form.address.trim().length < 3) next.address = "Add the street or area name.";
    if (!coords) next.location = "Drop a pin on the map so it appears on the city map.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setStage("Filing your report…");
    let created = null;

    try {
      // category and severity are sent as real fields (see createReport in api.js),
      // so the backend uses the reporter's picks instead of guessing from the text.
      created = await createReport({
        title: form.title,
        details: form.description.trim(),
        address: form.address,
        lat: coords.lat,
        lng: coords.lng,
        category: form.category,
        severity: form.severity,
      });
    } catch (e) {
      console.error("[CivicLens] filing report failed:", e);
      setErrors({ submit: `That report couldn't be filed: ${e?.message || "please try again."}` });
      return;
    } finally {
      setSubmitting(false);
      setStage("");
    }

    onCreated(created);
  };

  return (
    <Dialog open={open} onOpenChange={submitting ? () => {} : onOpenChange}>
      <DialogContent className="z-[3000] max-h-[85vh] my-auto overflow-y-auto border-white/10 bg-[#0a0f18]/80 p-6 sm:p-8 pt-8 shadow-2xl sm:max-w-2xl">
        <DialogHeader className="pt-2">
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-white">
            Report an issue
          </DialogTitle>
          <DialogDescription className="text-[13px] text-white/45">
            It goes onto the public city map straight away — usually under a minute.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Category <span className="text-white/25">(optional)</span>
            </Label>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((item) => {
                const Icon = item.Icon;
                const active = form.category === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        category: previous.category === item.value ? "" : item.value,
                      }))
                    }
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                      active
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-emerald-400" : "text-white/45")} />
                    <span className={cn("text-[11.5px] leading-tight", active ? "text-white" : "text-white/60")}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="report-title" className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              What's wrong?
            </Label>
            <Input
              id="report-title"
              value={form.title}
              onChange={update("title")}
              placeholder="Deep pothole on the eastbound lane"
              className="mt-3 border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
            />
            {errors.title && <p className="mt-2 text-[12px] text-rose-400">{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor="report-details" className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Details <span className="text-white/25">(optional)</span>
            </Label>
            <Textarea
              id="report-details"
              value={form.description}
              onChange={update("description")}
              rows={3}
              placeholder="How long has it been like this, and who is it affecting?"
              className="mt-3 border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
            />
          </div>

          <div>
            <Label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">How urgent?</Label>
            <div className="mt-3 flex flex-wrap gap-2">
              {SEVERITIES.map((item) => {
                const active = form.severity === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, severity: item.value }))}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all duration-200",
                      active
                        ? cn(TONES[item.tone].bg, TONES[item.tone].border, TONES[item.tone].text)
                        : "border-white/10 text-white/55 hover:border-white/20"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", TONES[item.tone].dot)} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {form.severity === "critical" && (
              <p className="mt-2 text-[12px] text-rose-300/80">
                Critical reports are flagged in rose on the city map. Use it for emergencies only.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="report-address" className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Where is it?
            </Label>
            <Input
              id="report-address"
              value={form.address}
              onChange={update("address")}
              placeholder="Street, landmark or ward"
              className="mt-3 border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
            />
            <div className="mt-3">
              {open && <LocationPicker key="open" value={coords} onChange={setCoords} />}
            </div>
            {errors.address && <p className="mt-2 text-[12px] text-rose-400">{errors.address}</p>}
            {errors.location && <p className="mt-1 text-[12px] text-rose-400">{errors.location}</p>}
          </div>

          {errors.submit && (
            <p className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-[12.5px] text-rose-200">
              {errors.submit}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-5">
            <span className="text-[11.5px] text-white/35">{stage || "Filed from this device · no sign-in needed"}</span>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-[13px] font-semibold text-[#04140E] transition-all duration-300 hover:bg-emerald-400 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Filing…" : "File report"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}