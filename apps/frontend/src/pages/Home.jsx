import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import SiteHeader from "@/components/SiteHeader";
import HeroSection from "@/components/HeroSection";
import FeatureAITriaging from "@/components/features/FeatureAITriaging";
import FeatureGeospatial from "@/components/features/FeatureGeospatial";
import FeatureDispatch from "@/components/features/FeatureDispatch";
import SeverityJourney from "@/components/SeverityJourney";
import MyReportsSection from "@/components/MyReportsSection";
import CityMapSection from "@/components/CityMapSection";
import AnalyticsSection from "@/components/AnalyticsSection";
import AIInsightsSection from "@/components/AIInsightsSection";
import ReportModal from "@/components/ReportModal";
import ReportDetailModal from "@/components/ReportDetailModal";
import { getReporterKey } from "@/lib/reportMeta";

const PAGE_SIZE = 200;

export default function Home() {
  const { toast } = useToast();
  const reporterKey = useMemo(() => getReporterKey(), []);

  const [reports, setReports] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, resolved: 0, critical: 0 });
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);

  const load = useCallback(async () => {
    try {
      const [page, totalRes, resolvedRes, criticalRes, mine] = await Promise.all([
        base44.entities.Report.list({ sort: "-created_date", limit: PAGE_SIZE }).catch(() => ({ items: [] })),
        base44.entities.Report.count({}).catch(() => 0),
        base44.entities.Report.count({ status: "resolved" }).catch(() => 0),
        base44.entities.Report.count({ severity: "critical" }).catch(() => 0),
        base44.entities.Report.filter({ reporter_key: reporterKey }, { sort: "-created_date", limit: 60 }).catch(() => ({ items: [] })),
      ]);

      // Extract numeric values safely
      const total = typeof totalRes === "number" ? totalRes : (totalRes?.count ?? page?.items?.length ?? 0);
      const resolved = typeof resolvedRes === "number" ? resolvedRes : (resolvedRes?.count ?? 0);
      const critical = typeof criticalRes === "number" ? criticalRes : (criticalRes?.count ?? 0);
      const open = Math.max(total - resolved, 0);

      setReports(page?.items || []);
      setCursor(page?.next_cursor || null);
      setHasMore(Boolean(page?.has_more));
      setCounts({ total, resolved, open, critical });
      setMyReports(mine?.items || []);
    } catch (e) {
      // Fallback state on error
      setCounts({ total: 0, open: 0, resolved: 0, critical: 0 });
    }
  }, [reporterKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await load();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  useEffect(() => {
    // Disable real-time socket subscription in local development to avoid connection timeouts
    if (import.meta.env.DEV) return;

    if (typeof base44.entities?.Report?.subscribe === "function") {
      try {
        const unsubscribe = base44.entities.Report.subscribe(() => {
          load();
        });
        return () => {
          if (typeof unsubscribe === "function") unsubscribe();
        };
      } catch (e) {
        // Ignored in local offline/mock mode
      }
    }
  }, [load]);

  const loadMore = async () => {
    try {
      const page = await base44.entities.Report.list({ sort: "-created_date", limit: PAGE_SIZE, cursor });
      setReports((previous) => [...previous, ...(page?.items || [])]);
      setCursor(page?.next_cursor || null);
      setHasMore(Boolean(page?.has_more));
    } catch (e) {
      // Fail silently for pagination in mock mode
    }
  };

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleCreated = async (created) => {
    setReportOpen(false);
    toast({ title: "Report filed", description: "It's live on the city map." });
    setFocus({ ...created, stamped: Date.now() });
    await load();
    goTo("city-map");
  };

  const handleStatusChange = async (report) => {
    const action = report.status === "resolved" ? "reopen" : "resolve";
    try {
      await base44.functions.invoke("reportAction", { reportId: report.id, reporterKey, action });
      toast({
        title: action === "resolve" ? "Marked as resolved" : "Report reopened",
        description: report.title,
      });
      await load();
    } catch (e) {
      toast({ title: "That didn't go through", description: "Please try again.", variant: "destructive" });
    }
  };

  const trackOnMap = (report) => {
    setFocus({ ...report, stamped: Date.now() });
    goTo("city-map");
  };

  const latest = loading ? [] : reports.slice(0, 3);
  const selectedLive = selected ? reports.find((item) => item.id === selected.id) || selected : null;

  return (
    <div className="relative min-h-screen" style={{ overflowX: "clip" }}>
      <SiteHeader onReport={() => setReportOpen(true)} />

      <main>
        <HeroSection
          counts={counts}
          latest={latest}
          onReport={() => setReportOpen(true)}
          onExplore={() => goTo("city-map")}
          onOpenReport={setSelected}
        />

        <FeatureAITriaging />
        <FeatureGeospatial />
        <FeatureDispatch />
        <SeverityJourney />

        <MyReportsSection
          reports={myReports}
          onOpen={setSelected}
          onTrack={trackOnMap}
          onStatusChange={handleStatusChange}
          onReport={() => setReportOpen(true)}
        />

        <CityMapSection reports={reports} onSelect={setSelected} focus={focus} />

        {hasMore && (
          <div className="mx-auto max-w-7xl px-5 pb-8 sm:px-8">
            <button
              type="button"
              onClick={loadMore}
              className="mx-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[12.5px] font-medium text-white/60 transition hover:border-emerald-500/30 hover:text-white"
            >
              Load older reports
            </button>
          </div>
        )}

        <AnalyticsSection reports={reports} counts={counts} />
        <AIInsightsSection />
      </main>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-5 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <Activity className="h-4 w-4 text-emerald-400" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold tracking-tight text-white">CiviCLens</div>
              <div className="text-[9.5px] font-medium uppercase tracking-[0.28em] text-white/30">
                Public Intelligence
              </div>
            </div>
          </div>
          <p className="max-w-md text-[12px] leading-relaxed text-white/35">
            Public civic data, filed by residents and readable by anyone. The AI briefing is an interpretation of that
            open data — not an official statement.
          </p>
        </div>
      </footer>

      <ReportModal open={reportOpen} onOpenChange={setReportOpen} onCreated={handleCreated} />

      <ReportDetailModal
        report={selectedLive}
        open={Boolean(selectedLive)}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        isMine={Boolean(selectedLive && selectedLive.reporter_key === reporterKey)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}