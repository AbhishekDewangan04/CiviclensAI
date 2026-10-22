import React, { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Search } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import Pill from "@/components/Pill";
import { markerColor, SEVERITY_MAP } from "@/lib/reportMeta";

const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Explicit 2-element tuple type for Leaflet center coordinates
const DEFAULT_CENTER = [21.2109, 81.3135];

const LOCAL_PREVIEW_REPORTS = [
  {
    id: "rep-1",
    title: "Pothole on Main Avenue",
    category: "roads",
    status: "pending",
    severity: "critical",
    lat: 21.2109,
    lng: 81.3135,
    address: "Central Avenue, Bhilai",
    created_at: new Date().toISOString(),
  },
];

/**
 * @param {string} color
 * @param {boolean} isCritical
 */
function createCustomIcon(color, isCritical) {
  const html = `
    <div class="relative flex items-center justify-center w-6 h-6">
      ${isCritical ? `<span class="absolute inline-flex h-full w-full rounded-full bg-rose-500/40 animate-ping"></span>` : ''}
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

/**
 * @param {{ reports: any[] }} props
 */
function MapViewController({ reports }) {
  const map = useMap();

  useEffect(() => {
    if (reports && reports.length > 0) {
      const validPoints = reports.filter((/** @type {any} */ r) => r.lat && r.lng);
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map((/** @type {any} */ r) => [r.lat, r.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [reports, map]);

  return null;
}

/**
 * @param {{ reports?: any[], onSelectReport?: (report: any) => void }} props
 */
export default function CityMapSection({ reports = [], onSelectReport }) {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const displayReports = useMemo(() => {
    return reports && reports.length > 0 ? reports : LOCAL_PREVIEW_REPORTS;
  }, [reports]);

  const filteredReports = useMemo(() => {
    return displayReports.filter((/** @type {any} */ report) => {
      const matchStatus = selectedStatus === "all" || report.status === selectedStatus;
      const matchSearch =
        !searchQuery.trim() ||
        (report.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (report.address || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [displayReports, selectedStatus, searchQuery]);

  return (
    <section id="city-map" className="relative scroll-mt-32 border-t border-white/5 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ScrollReveal>
          <SectionHeading
            eyebrow="City Map"
            title="Every report, plotted live"
            description="Emerald means active or resolved, amber means waiting, rose means an emergency signal. Tap any point to open the full report."
            action={null}
          />
        </ScrollReveal>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports, streets, issues…"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-10 pr-4 text-[13px] text-white placeholder-white/40 outline-none transition focus:border-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-[13px] text-white/80 outline-none transition focus:border-emerald-500/50"
            >
              <option value="all" className="bg-[#081410] text-white">Any status</option>
              <option value="pending" className="bg-[#081410] text-white">Pending</option>
              <option value="in_review" className="bg-[#081410] text-white">In Review</option>
              <option value="resolved" className="bg-[#081410] text-white">Resolved</option>
            </select>
          </div>
        </div>

        <div className="relative mt-6 h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-[#081410] shadow-panel">
          <MapContainer
            center={[DEFAULT_CENTER[0], DEFAULT_CENTER[1]]}
            zoom={13}
            scrollWheelZoom={false}
            className="h-full w-full z-0"
          >
            <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
            <MapViewController reports={filteredReports} />

            {filteredReports.map((/** @type {any} */ report) => {
              const color = markerColor ? markerColor(report) : "#10b981";
              const isCritical = report.severity === "critical" && report.status !== "resolved";
              const icon = createCustomIcon(color, isCritical);
              const tone = SEVERITY_MAP[report.severity]?.tone || "muted";
              const reportLat = report.lat || DEFAULT_CENTER[0];
              const reportLng = report.lng || DEFAULT_CENTER[1];

              return (
                <Marker
                  key={report.id || Math.random()}
                  position={[reportLat, reportLng]}
                  icon={icon}
                >
                  <Popup className="custom-leaflet-popup">
                    <div className="min-w-[220px] rounded-2xl border border-white/15 bg-[#081812]/95 p-4 text-white shadow-2xl backdrop-blur-md">
                      <div className="flex items-center justify-between gap-2">
                        <Pill tone={tone}>{report.severity}</Pill>
                        <span className="text-[11px] text-white/50 capitalize">{report.status ? report.status.replace("_", " ") : "Pending"}</span>
                      </div>
                      <h4 className="mt-2 text-[14px] font-semibold text-white">{report.title}</h4>
                      <p className="mt-1 text-[12px] text-white/60">{report.address}</p>
                      {onSelectReport && (
                        <button
                          type="button"
                          onClick={() => onSelectReport(report)}
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
        </div>
      </div>
    </section>
  );
}