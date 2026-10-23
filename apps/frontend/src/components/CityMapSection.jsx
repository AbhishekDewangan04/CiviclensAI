import React, { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Check, ChevronDown, Search, X } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import Pill from "@/components/Pill";
import { markerColor, SEVERITY_MAP } from "@/lib/reportMeta";

// Free, keyless basemap layer
const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_CENTER = [21.2109, 81.3135];

const STATUS_OPTIONS = [
  { value: "all", label: "Any status", dot: "bg-white/30" },
  { value: "pending", label: "Pending", dot: "bg-amber-400" },
  { value: "in_review", label: "In Review", dot: "bg-sky-400" },
  { value: "active", label: "Active", dot: "bg-emerald-400" },
  { value: "resolved", label: "Resolved", dot: "bg-teal-300" },
];

const STATUS_LIST_ID = "city-map-status-list";

// Reports may store coordinates as lat/lng, latitude/longitude or lat/lon.
function getCoords(report) {
  const lat = Number(report?.lat ?? report?.latitude);
  const lng = Number(report?.lng ?? report?.lon ?? report?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return [lat, lng];
  return null;
}

function createCustomIcon(color, isCritical) {
  const html = `
    <div class="relative flex items-center justify-center w-6 h-6">
      ${isCritical ? `<span class="absolute inline-flex h-full w-full rounded-full bg-rose-500/40 animate-ping"></span>` : ""}
      <span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white/80 shadow-lg" style="background-color: ${color};"></span>
    </div>
  `;
  return L.divIcon({
    html,
    className: "custom-map-pin",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

// Fits the map to the visible reports when the set of reports changes.
function MapViewController({ points, suppressUntil }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");

  useEffect(() => {
    if (!points.length) return;
    // Don't fight a "Track on map" zoom that just started.
    if (Date.now() < suppressUntil.current) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

// Zooms to the focused report and opens its popup.
function FocusController({ focus, markerRefs, suppressUntil }) {
  const map = useMap();
  const handled = useRef(null);

  useEffect(() => {
    if (!focus || handled.current === focus.stamped) return;
    const coords = getCoords(focus);
    if (!coords) return;
    handled.current = focus.stamped;

    suppressUntil.current = Date.now() + 4000;
    map.flyTo(coords, 16, { duration: 1.2 });

    // The marker may not exist yet if the reports are still reloading, so retry briefly.
    let tries = 0;
    const timer = setInterval(() => {
      const marker = markerRefs.current[focus.id];
      tries += 1;
      if (marker) {
        marker.openPopup();
        clearInterval(timer);
      } else if (tries > 15) {
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [focus, map, markerRefs, suppressUntil]);

  return null;
}

// Custom, themed replacement for the native <select> (whose open list the browser
// draws itself and CSS cannot style). Keyboard: Arrow keys, Home/End, Enter/Space, Esc, Tab.
function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);

  const selectedIndex = Math.max(
    0,
    STATUS_OPTIONS.findIndex((option) => option.value === value)
  );
  const selected = STATUS_OPTIONS[selectedIndex];
  const filtering = value !== "all";

  // Close when clicking or tapping anywhere outside the control.
  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [open]);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index) => {
    onChange(STATUS_OPTIONS[index].value);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    const last = STATUS_OPTIONS.length - 1;

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => (index >= last ? 0 : index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => (index <= 0 ? last : index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={STATUS_LIST_ID}
        aria-activedescendant={open ? `status-opt-${STATUS_OPTIONS[active].value}` : undefined}
        aria-label="Filter by status"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          // Stops Space from also firing a click on keyup (which would re-close the list).
          if (event.key === " ") event.preventDefault();
        }}
        className={`flex min-w-[168px] items-center gap-2.5 rounded-xl border bg-black/40 px-3.5 py-2.5 text-left text-[13px] outline-none transition hover:border-white/20 focus-visible:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/15 ${
          filtering || open ? "border-emerald-500/40 text-white" : "border-white/10 text-white/80"
        }`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        <span className="flex-1">{selected.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          id={STATUS_LIST_ID}
          role="listbox"
          aria-label="Status"
          className="absolute right-0 z-30 mt-2 w-full min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#0a1411]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          {STATUS_OPTIONS.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === active;
            return (
              <li
                key={option.value}
                id={`status-opt-${option.value}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  isActive ? "bg-emerald-500/15 text-white" : "text-white/70"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
                <span className="flex-1">{option.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CityMapSection({ reports = [], onSelect, onSelectReport, focus = null }) {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const markerRefs = useRef({});
  const suppressUntil = useRef(0);
  const searchRef = useRef(null);

  // Home passes `onSelect`; older code used `onSelectReport`. Accept both.
  const handleSelect = onSelect || onSelectReport;

  const clearSearch = () => {
    setSearchQuery("");
    searchRef.current?.focus();
  };

  const filteredReports = useMemo(() => {
    // Every typed word must match somewhere in the report (title, address, details or category).
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return reports.filter((report) => {
      if (selectedStatus !== "all" && report.status !== selectedStatus) return false;
      if (!terms.length) return true;
      const haystack = [report.title, report.address, report.description, report.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [reports, selectedStatus, searchQuery]);

  // Reports without coordinates are pinned to the city centre so they still show up.
  const placed = useMemo(
    () => filteredReports.map((report) => ({ report, coords: getCoords(report) || DEFAULT_CENTER })),
    [filteredReports]
  );
  const points = useMemo(() => placed.map((p) => p.coords), [placed]);

  return (
    <section className="relative scroll-mt-32 border-t border-white/5 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow="City Map"
            title="Every report, plotted live"
            description="Emerald means active or resolved, amber means waiting, rose means an emergency signal. Tap any point to open the full report."
            action={null}
          />
        </ScrollReveal>

        {/* z-20 keeps the dropdown list above the map below it */}
        <div className="relative z-20 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchQuery) {
                  e.preventDefault();
                  setSearchQuery("");
                }
              }}
              placeholder="Search reports, streets, issues…"
              aria-label="Search reports"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-10 text-[13px] text-white placeholder-white/40 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span aria-live="polite" className="hidden whitespace-nowrap text-[12px] text-white/40 sm:inline">
              {filteredReports.length} of {reports.length} reports
            </span>
            <StatusSelect value={selectedStatus} onChange={setSelectedStatus} />
          </div>
        </div>

        <div className="relative isolate mt-6 h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-[#081410] shadow-panel">
          <MapContainer center={DEFAULT_CENTER} zoom={13} scrollWheelZoom={false} className="z-0 h-full w-full">
            <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
            <MapViewController points={points} suppressUntil={suppressUntil} />
            <FocusController focus={focus} markerRefs={markerRefs} suppressUntil={suppressUntil} />

            {placed.map(({ report, coords }) => {
              const color = markerColor(report);
              const isCritical = report.severity === "critical" && report.status !== "resolved";
              const tone = SEVERITY_MAP[report.severity]?.tone || "muted";

              return (
                <Marker
                  key={report.id}
                  position={coords}
                  icon={createCustomIcon(color, isCritical)}
                  ref={(marker) => {
                    if (marker) markerRefs.current[report.id] = marker;
                    else delete markerRefs.current[report.id];
                  }}
                >
                  <Popup className="custom-leaflet-popup">
                    <div className="min-w-[220px] rounded-2xl border border-white/15 bg-[#081812]/95 p-4 text-white shadow-2xl backdrop-blur-md">
                      <div className="flex items-center justify-between gap-2">
                        <Pill tone={tone}>{report.severity}</Pill>
                        <span className="text-[11px] capitalize text-white/50">
                          {report.status ? report.status.replace("_", " ") : "Pending"}
                        </span>
                      </div>
                      <h4 className="mt-2 text-[14px] font-semibold text-white">{report.title}</h4>
                      <p className="mt-1 text-[12px] text-white/60">{report.address}</p>
                      {handleSelect && (
                        <button
                          type="button"
                          onClick={() => handleSelect(report)}
                          className="mt-3 w-full rounded-xl bg-emerald-500/20 py-2 text-center text-[12px] font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                        >
                          View full report
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {filteredReports.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center">
              <div className="rounded-2xl border border-white/10 bg-[#081410]/90 px-5 py-3 text-center backdrop-blur-md">
                <p className="text-[13px] font-medium text-white">
                  {reports.length === 0 ? "No reports yet" : "No reports match"}
                </p>
                <p className="mt-0.5 text-[12px] text-white/50">
                  {reports.length === 0 ? "New reports will appear here." : "Try a different search or status."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
