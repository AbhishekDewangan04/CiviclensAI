import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
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
import { getStats, listReports, reportAction } from "@/lib/api";
import AmbientBackground from "@/components/AmbientBackground";

const PAGE_SIZE = 200;
const HEADER_OFFSET = 100;
const EMPTY_PAGE = { reports: [], total: 0 };

export default function Home() {
  const { toast } = useToast();
  const reporterKey = useMemo(() => getReporterKey(), []);

  const [reports, setReports] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, resolved: 0, critical: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);
  const [activeTab, setActiveTab] = useState("city_map");

  const load = useCallback(async () => {
    const warn = (label) => (error) => {
      console.warn(`[CivicLens] ${label} failed:`, error);
      return null;
    };
    const [page, mine, stats] = await Promise.all([
      listReports({ limit: PAGE_SIZE }).catch(warn("list reports")),
      listReports({ mine: true, limit: 60 }).catch(warn("list my reports")),
      getStats().catch(warn("stats")),
    ]);

    const safePage = page || EMPTY_PAGE;
    setReports(safePage.reports);
    setHasMore(safePage.total > safePage.reports.length);
    setMyReports((mine || EMPTY_PAGE).reports);
    setCounts({
      total: stats?.total ?? safePage.total,
      open: stats?.open ?? 0,
      resolved: stats?.resolved ?? 0,
      critical: stats?.critical_open ?? 0,
    });
  }, []);

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

  const loadMore = async () => {
    try {
      const page = await listReports({ limit: PAGE_SIZE, offset: reports.length });
      const next = [...reports, ...page.reports];
      setReports(next);
      setHasMore(page.total > next.length);
    } catch (error) {
      console.warn("[CivicLens] load more failed:", error);
    }
  };

  // Leaves room for the fixed header so the section heading isn't hidden underneath it.
  const goTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    goTo(tabId.replace("_", "-"));
  };

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
      await reportAction(report.id, action);
      toast({
        title: action === "resolve" ? "Marked as resolved" : "Report reopened",
        description: report.title,
      });
      await load();
    } catch (error) {
      console.error("[CivicLens] report action failed:", error);
      if (error?.status === 409) {
        // The report was already in that state (e.g. resolved in another tab): just refresh.
        toast({ title: "Already up to date", description: "Refreshed the latest status." });
        await load();
        return;
      }
      toast({
        title: "That didn't go through",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
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
      <AmbientBackground />

      <SiteHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenReportModal={() => setReportOpen(true)}
      />

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

        <div id="my-reports">
          <MyReportsSection
            reports={myReports}
            onOpen={setSelected}
            onTrack={trackOnMap}
            onStatusChange={handleStatusChange}
            onReport={() => setReportOpen(true)}
          />
        </div>

        <div id="city-map">
          <CityMapSection reports={reports} onSelectReport={setSelected} onSelect={setSelected} focus={focus} />
        </div>

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

        <div id="analytics">
          <AnalyticsSection reports={reports} counts={counts} />
        </div>

        <div id="ai-insights">
          <AIInsightsSection reports={reports} />
        </div>
      </main>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-5 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <Activity className="h-4 w-4 text-emerald-400" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold tracking-tight text-white">CivicLens</div>
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
