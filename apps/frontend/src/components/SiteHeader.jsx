import React from "react";
import { Shield, MapPin, BarChart3, Brain, Plus } from "lucide-react";

export default function SiteHeader({
  activeTab = "city_map",
  onTabChange,
  onOpenReportModal,
  onOpenAuthModal,
}) {
  const navItems = [
    { id: "my_reports", label: "My Reports", icon: Shield },
    { id: "city_map", label: "City Map", icon: MapPin },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "ai_insights", label: "AI Insights", icon: Brain },
  ];

  return (
    <header className="sticky top-0 z-[1000] border-b border-white/10 bg-[#04140e]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">CivicLens</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] font-medium text-white/40 tracking-wider uppercase">
              Public Intelligence
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-white/10 bg-black/40 p-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange && onTabChange(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenAuthModal && onOpenAuthModal()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => onOpenReportModal && onOpenReportModal()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-[#04140e] transition hover:bg-emerald-400 shadow-lg shadow-emerald-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>Report an Issue</span>
          </button>
        </div>
      </div>
    </header>
  );
}