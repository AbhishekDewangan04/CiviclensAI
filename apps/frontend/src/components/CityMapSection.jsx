import React, { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Search } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import Pill from "@/components/Pill";
import { markerColor, SEVERITY_MAP } from "@/lib/reportMeta";

// Free, keyless basemap layer
const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_CENTER = [21.2109, 81.3135];

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

export default function CityMapSection({ reports = [], onSelect, onSelectReport, focus = null }) {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const markerRefs = useRef({});
  const suppressUntil = useRef(0);

  // Home passes `onSelect`; older code used `onSelectReport`. Accept both.
  const handleSelect = onSelect || onSelectReport;

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((report) => {
      const matchStatus = selectedStatus === "all" || report.status === selectedStatus;
      const matchSearch =
        !q ||
        (report.title || "").toLowerCase().includes(q) ||
        (report.address || "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
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
              <option value="active" className="bg-[#081410] text-white">Active</option>
              <option value="resolved" className="bg-[#081410] text-white">Resolved</option>
            </select>
          </div>
        </div>

        <div className="relative mt-6 h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-[#081410] shadow-panel">
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
        </div>
      </div>
    </section>
  );
}