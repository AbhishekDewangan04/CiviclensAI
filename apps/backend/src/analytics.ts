import { categories, statuses, type Category, type Incident, type IncidentStatus } from "./domain.js";

export type AnalyticsSummary = {
  totalReports: number;
  categoryBreakdown: Array<{ category: Category; count: number }>;
  statusDistribution: Array<{ status: IncidentStatus; count: number }>;
  coordinateCoverage: { withCoordinates: number; withoutCoordinates: number };
  recurringHotspots: Array<{ label: string; count: number; latitude: number; longitude: number }>;
};

// A 100 m Haversine radius keeps this intentionally lightweight and explainable.
// A hotspot is emitted only when at least two reports are within that radius.
export const HOTSPOT_DISTANCE_METERS = 100;
const radians = (value: number) => value * Math.PI / 180;
const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export function aggregateAnalytics(incidents: readonly Incident[]): AnalyticsSummary {
  const categoryCounts = new Map<Category, number>(categories.map((category) => [category, 0]));
  const statusCounts = new Map<IncidentStatus, number>(statuses.map((status) => [status, 0]));
  const points = incidents.flatMap((incident) => incident.latitude !== undefined && incident.longitude !== undefined ? [{ latitude: incident.latitude, longitude: incident.longitude }] : []);
  for (const incident of incidents) { categoryCounts.set(incident.category, (categoryCounts.get(incident.category) ?? 0) + 1); statusCounts.set(incident.status, (statusCounts.get(incident.status) ?? 0) + 1); }
  const clusters: Array<{ points: Array<{ latitude: number; longitude: number }>; latitude: number; longitude: number }> = [];
  for (const point of points) {
    const cluster = clusters.find((candidate) => distanceMeters(candidate, point) <= HOTSPOT_DISTANCE_METERS);
    if (cluster) { cluster.points.push(point); cluster.latitude = cluster.points.reduce((sum, item) => sum + item.latitude, 0) / cluster.points.length; cluster.longitude = cluster.points.reduce((sum, item) => sum + item.longitude, 0) / cluster.points.length; } else clusters.push({ points: [point], ...point });
  }
  return {
    totalReports: incidents.length,
    categoryBreakdown: categories.map((category) => ({ category, count: categoryCounts.get(category) ?? 0 })),
    statusDistribution: statuses.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    coordinateCoverage: { withCoordinates: points.length, withoutCoordinates: incidents.length - points.length },
    recurringHotspots: clusters.filter((cluster) => cluster.points.length >= 2).map((cluster) => ({ label: `${cluster.latitude.toFixed(5)}, ${cluster.longitude.toFixed(5)}`, count: cluster.points.length, latitude: cluster.latitude, longitude: cluster.longitude })),
  };
}
