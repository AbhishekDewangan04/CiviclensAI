import type { Bbox, Hotspot, HotspotPoint } from "../types";

const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_DEGREE_LAT = (Math.PI / 180) * EARTH_RADIUS_M;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Inclusive on all four edges. */
export function withinBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return lng >= bbox.minLng && lng <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat;
}

/**
 * Fallback clustering used when the ML service is unavailable.
 * Points are binned into square cells of about radius_m, with the grid anchored
 * at the south-west corner of the point set. Cells holding at least minPoints
 * points become hotspots, largest first.
 */
export function localHotspots(
  points: readonly HotspotPoint[],
  radiusM: number,
  minPoints: number,
): Hotspot[] {
  if (points.length === 0) return [];

  let minLat = Infinity;
  let minLng = Infinity;
  let latSum = 0;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    latSum += point.lat;
  }
  const meanLat = latSum / points.length;
  const latStep = radiusM / METERS_PER_DEGREE_LAT;
  const lngStep = radiusM / (METERS_PER_DEGREE_LAT * Math.max(Math.cos(toRadians(meanLat)), 0.01));

  const cells = new Map<string, HotspotPoint[]>();
  for (const point of points) {
    const key = `${Math.floor((point.lat - minLat) / latStep)}:${Math.floor((point.lng - minLng) / lngStep)}`;
    const members = cells.get(key);
    if (members) members.push(point);
    else cells.set(key, [point]);
  }

  const hotspots: Hotspot[] = [];
  for (const members of cells.values()) {
    if (members.length < minPoints) continue;

    const centerLat = members.reduce((sum, m) => sum + m.lat, 0) / members.length;
    const centerLng = members.reduce((sum, m) => sum + m.lng, 0) / members.length;
    let maxDistance = 0;
    for (const member of members) {
      maxDistance = Math.max(
        maxDistance,
        haversineMeters(centerLat, centerLng, member.lat, member.lng),
      );
    }

    hotspots.push({
      center_lat: centerLat,
      center_lng: centerLng,
      count: members.length,
      radius_m: Math.max(1, Math.round(maxDistance)),
      report_ids: members.map((member) => member.id),
      critical_count: members.filter((member) => member.severity === "critical").length,
    });
  }

  return hotspots.sort((a, b) => b.count - a.count || b.critical_count - a.critical_count);
}