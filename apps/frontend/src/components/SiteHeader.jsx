import React, { useCallback, useState } from "react";
import { Shield, MapPin, BarChart3, Brain, Plus, LogOut } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const SESSION_KEY = "civiclens_session";

function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable; session lives in memory only.
  }
}

export default function SiteHeader({
  activeTab = "city_map",
  onTabChange,
  onOpenReportModal,
  onAuthChange,
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const [session, setSession] = useState(() => readSession());

  const navItems = [
    { id: "my_reports", label: "My Reports", icon: Shield },
    { id: "city_map", label: "City Map", icon: MapPin },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "ai_insights", label: "AI Insights", icon: Brain },
  ];

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const handleAuthSuccess = useCallback(
    (user) => {
      setSession(user);
      writeSession(user);
      if (onAuthChange) onAuthChange(user);
    },
    [onAuthChange]
  );

  const handleSignOut = () => {
    setSession(null);
    writeSession(null);
    if (onAuthChange) onAuthChange(null);
  };

  const initial = session?.name ? session.name.charAt(0).toUpperCase() : "U";

  return (
    <>
      <header className="sticky top-0 z-[1000] border-b border-white/10 bg-[#04140e]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">CivicLens</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  LIVE
                </span>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Public Intelligence
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-black/40 p-1.5 md:flex">
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
                      ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
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
            {session ? (
              <>
                <span
                  className="hidden items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-emerald-300 sm:inline-flex"
                  title={session.email}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-[11px] font-bold text-[#04140e]">
                    {initial}
                  </span>
                  <span className="max-w-[120px] truncate">{session.name}</span>
                  {session.role === "admin" && (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                      Admin
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                aria-haspopup="dialog"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenReportModal && onOpenReportModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-[#04140E] shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              <span>Report an Issue</span>
            </button>
          </div>
        </div>
      </header>

      <AuthLayout isOpen={authOpen} onClose={closeAuth} onAuthSuccess={handleAuthSuccess} />
    </>
  );
}