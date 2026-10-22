import React, { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2 } from "lucide-react";

const DEFAULT_CENTER = [20, 12];
const DEFAULT_ZOOM = 2;
const PICK_ZOOM = 15;

const pinIcon = L.divIcon({
  className: "civic-marker",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px"><span class="civic-dot" style="background:#10B981;box-shadow:0 0 0 7px rgba(16,185,129,0.18), 0 0 20px rgba(16,185,129,0.85)"></span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Leaflet measures its box the moment it mounts. Inside a dialog that is still
// opening, that measurement is wrong, and every later tap is thrown off by it.
// So: re-measure once the box is real, then pin the view to the centre we meant.
function MapSettle({ center, zoom }) {
  const map = useMap();
  const viewKey = `${center[0]},${center[1]},${zoom}`;

  useEffect(() => {
    const [lat, lng, z] = viewKey.split(",").map(Number);
    const settle = () => {
      map.invalidateSize({ animate: false, pan: false });
      if (map.getSize().y > 0) map.setView([lat, lng], z, { animate: false });
    };
    const timers = [0, 150, 400, 800].map((delay) => window.setTimeout(settle, delay));
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(settle) : null;
    if (observer) observer.observe(map.getContainer());
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (observer) observer.disconnect();
    };
  }, [map, viewKey]);

  return null;
}

function ClickCatcher({ onPick }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    // Work the tapped point out from the map centre and the live box, instead of
    // trusting the map's own mouse maths in a resizing dialog.
    const handleClick = (event) => {
      const box = container.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const zoom = map.getZoom();
      const centrePx = map.project(map.getCenter(), zoom);
      const dx = event.clientX - box.left - box.width / 2;
      const dy = event.clientY - box.top - box.height / 2;
      const latlng = map.unproject([centrePx.x + dx, centrePx.y + dy], zoom);
      onPick(latlng.lat, latlng.lng);
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [map, onPick]);

  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(timer);
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setError("This browser can't share a location — tap the map instead.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't read your location — tap the map instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const center = value ? [value.lat, value.lng] : DEFAULT_CENTER;
  const zoom = value ? PICK_ZOOM : DEFAULT_ZOOM;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="relative z-0">
          {ready ? (
            <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-52 w-full sm:h-60">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                maxZoom={16}
              />
              <MapSettle center={center} zoom={zoom} />
              <ClickCatcher onPick={(lat, lng) => onChange({ lat, lng })} />
              {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
            </MapContainer>
          ) : (
            <div className="grid h-52 w-full place-items-center bg-[#080D18] text-[12px] text-white/35 sm:h-60">
              Preparing the map…
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={locate}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[12px] font-medium text-white/70 transition hover:border-emerald-500/30 hover:text-white"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          Use my location
        </button>
        <span className="text-[11.5px] text-white/40">
          {value ? `Pinned at ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}` : "Tap the map where the issue is."}
        </span>
      </div>

      {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}