import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation } from "lucide-react";

const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_CENTER = [21.2109, 81.3135];

function createDraggablePinIcon() {
  const html = `
    <div class="relative flex items-center justify-center w-8 h-8">
      <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-500/30 animate-ping"></span>
      <span class="relative inline-flex rounded-full h-5 w-5 bg-emerald-400 border-2 border-white shadow-xl"></span>
    </div>
  `;
  return L.divIcon({
    html,
    className: "custom-draggable-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function LocationPickerEvents({ onPositionChange }) {
  useMapEvents({
    click(e) {
      if (onPositionChange) {
        onPositionChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function StepLocation({ formData, onChange, errors = {} }) {
  const lat = formData.lat || DEFAULT_CENTER[0];
  const lng = formData.lng || DEFAULT_CENTER[1];

  const markerIcon = useMemo(() => createDraggablePinIcon(), []);

  const handleMarkerDragEnd = (e) => {
    const newPos = e.target.getLatLng();
    onChange({ lat: newPos.lat, lng: newPos.lng });
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Geolocation permission denied:", err);
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Where is it?</h3>
        <p className="mt-1 text-sm text-white/60">
          Click on the map or drag the green pin to mark the exact location.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[12.5px] font-medium text-white/80">Street address or landmark</label>
        <div className="relative">
          <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={formData.address || ""}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Search or enter location address…"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none transition focus:border-emerald-500/50"
          />
        </div>
        {errors.address && <p className="text-xs text-rose-400">{errors.address}</p>}
      </div>

      <div className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#081410]">
        <MapContainer
          center={[lat, lng]}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full z-0"
        >
          <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
          <LocationPickerEvents
            onPositionChange={(newLat, newLng) => onChange({ lat: newLat, lng: newLng })}
          />
          <Marker
            draggable={true}
            eventHandlers={{ dragend: handleMarkerDragEnd }}
            position={[lat, lng]}
            icon={markerIcon}
          />
        </MapContainer>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#061410]/90 px-3 py-2 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur-md transition hover:bg-white/10"
        >
          <Navigation className="h-3.5 w-3.5 text-emerald-400" />
          Use my location
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/60">
        <span>Pinned location:</span>
        <span className="font-mono text-emerald-400">
          {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
        </span>
      </div>
    </div>
  );
}