import React from "react";
import { Plus } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import ReportCard from "@/components/ReportCard";

export default function MyReportsSection({ reports, onOpen, onTrack, onStatusChange, onReport }) {
  return (
    <section id="my-reports" className="relative scroll-mt-32 border-t border-white/5 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Tracking"
            title="My Reports"
            description="Everything filed from this device, with its live status. Mark a report resolved once the issue is fixed — or reopen it if it comes back."
            action={
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-white/55">
                  {reports.length} filed
                </span>
                <button
                  type="button"
                  onClick={onReport}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[12.5px] font-medium text-emerald-300 transition-all duration-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New report
                </button>
              </div>
            }
          />
        </ScrollReveal>

        {reports.length === 0 ? (
          <ScrollReveal delay={80}>
            <div className="mt-10 rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
              <p className="font-display text-xl text-white/80">Nothing filed from this device yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">
                A pothole, a dark streetlight, an overflowing bin — it takes about a minute, and it goes straight onto
                the public city map.
              </p>
              <button
                type="button"
                onClick={onReport}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-[#04140E] transition-all duration-300 hover:bg-emerald-400 hover:shadow-glow"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                Report an issue
              </button>
            </div>
          </ScrollReveal>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map((report, index) => (
              <ScrollReveal key={report.id} delay={Math.min(index, 5) * 70}>
                <ReportCard report={report} onOpen={onOpen} onTrack={onTrack} onStatusChange={onStatusChange} />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}