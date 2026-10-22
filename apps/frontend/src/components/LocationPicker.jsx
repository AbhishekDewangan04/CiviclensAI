import React, { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2 } from "lucide-react";

const DEFAULT_CENTER = [20, 12];
const DEFAULT_ZOOM = 2;
const PICK_ZOOM = 15;

const pinIcon = L.divIcon({
  className: "civic-marker",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px"><span class="civic-dot" style="background:#10B981;box-shadow:0 0 0 7px rgba(16,185,129,0.18), 0 0 20px rgba(16,185,129,0.85);width:10px;height:10px;border-radius:50%"></span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Handles re-measuring container dimensions inside dynamic modal transitions
function MapSettle({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
      if (center) {
        map.setView(center, zoom, { animate: false });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [map, center, zoom]);

  return null;
}

// Intercepts clicks on map tiles cleanly using Leaflet's internal event listener
function ClickCatcher({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

// Smoothly pans the map when user selects a location via button or click
function MapRecenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, PICK_ZOOM, { duration: 1 });
    }
  }, [map, position]);

  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 150);
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
            <MapContainer
              center={center}
              zoom={zoom}
              minZoom={3}
              maxZoom={18}
              scrollWheelZoom={false} // Prevents wheel scroll from auto-zooming inside modal
              className="h-52 w-full sm:h-60"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />
              <MapSettle center={center} zoom={zoom} />
              <ClickCatcher onPick={(lat, lng) => onChange({ lat, lng })} />
              {value && (
                <>
                  <Marker position={[value.lat, value.lng]} icon={pinIcon} />
                  <MapRecenter position={[value.lat, value.lng]} />
                </>
              )}
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