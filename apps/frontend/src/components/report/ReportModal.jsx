import React, { useState } from "react";
import { X, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import StepDetails from "./report/StepDetails";
import StepLocation from "./report/StepLocation";
import TriagePreview from "./report/TriagePreview";

const INITIAL_FORM = {
  title: "",
  category: "roads",
  severity: "medium",
  description: "",
  address: "",
  lat: 21.2109,
  lng: 81.3135,
  photo: null,
};

export default function ReportModal({ isOpen, onClose, onSubmitReport }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleDataChange = (fields) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    setErrors({});
  };

  const validateStep = () => {
    const errs = {};
    if (step === 1) {
      if (!formData.title.trim()) errs.title = "Title is required";
      if (!formData.category) errs.category = "Please select a category";
    } else if (step === 2) {
      if (!formData.address.trim()) errs.address = "Address or landmark is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    if (onSubmitReport) {
      onSubmitReport({
        id: `rep-${Date.now()}`,
        ...formData,
        status: "pending",
        created_at: new Date().toISOString(),
      });
    }
    // Reset modal state
    setFormData(INITIAL_FORM);
    setStep(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#081812] p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-xs font-semibold text-emerald-300">
              {step}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Step {step} of 3
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Step Content */}
        <div className="py-6">
          {step === 1 && (
            <StepDetails formData={formData} onChange={handleDataChange} errors={errors} />
          )}
          {step === 2 && (
            <StepLocation formData={formData} onChange={handleDataChange} errors={errors} />
          )}
          {step === 3 && <TriagePreview formData={formData} />}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-[#04140E] transition hover:bg-emerald-400"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-semibold text-[#04140E] transition hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              Submit Issue Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}