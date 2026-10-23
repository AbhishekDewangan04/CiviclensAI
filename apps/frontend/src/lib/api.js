import { getReporterKey } from "@/lib/reportMeta";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

const CATEGORY_MAP = {
  pothole: "roads",
  garbage: "waste",
  water_supply: "water",
  streetlight: "streetlights",
  drainage: "water",
  other: "other",
};
const STATUS_MAP = { open: "pending", resolved: "resolved" };

async function request(path, { method = "GET", body } = {}) {
  const headers = { "X-Reporter-Key": getReporterKey() };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

// The backend stores one description. The modal packs title / details / address into it.
export function composeDescription({ title, details, address }) {
  const parts = [title.trim()];
  if (details && details.trim()) parts.push(details.trim());
  parts.push(`Location: ${address.trim()}`);
  return parts.join("\n");
}

function splitDescription(text) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  let address = "";
  const locIndex = lines.findIndex((l) => l.startsWith("Location: "));
  if (locIndex >= 0) {
    address = lines[locIndex].slice("Location: ".length);
    lines.splice(locIndex, 1);
  }
  const first = lines.shift() || "Untitled report";
  const title = first.length > 80 ? `${first.slice(0, 77)}…` : first;
  return { title, details: lines.join("\n"), address };
}

export function toReport(r) {
  const { title, details, address } = splitDescription(r.description);
  return {
    id: r.id,
    title,
    description: details,
    address,
    category: CATEGORY_MAP[r.category] || "other",
    severity: r.severity,
    status: STATUS_MAP[r.status] || "pending",
    lat: r.lat,
    lng: r.lng,
    photo_url: r.image_url || "",
    is_mine: Boolean(r.is_mine),
    reporter_key: r.is_mine ? getReporterKey() : "",
    ml_status: r.ml_status,
    created_at: r.created_at,
    created_date: r.created_at,
    updated_at: r.updated_at,
    resolved_at: r.resolved_at,
  };
}

export async function listReports({ limit = 100, offset = 0, mine = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (mine) params.set("mine", "true");
  const data = await request(`/reports?${params}`);
  return { reports: (data.reports || []).map(toReport), total: data.total ?? 0 };
}

export function getStats() {
  return request("/reports/stats");
}

export async function createReport({ title, details, address, lat, lng }) {
  const data = await request("/reports", {
    method: "POST",
    body: { description: composeDescription({ title, details, address }), lat, lng },
  });
  return toReport(data.report);
}

export async function reportAction(id, action) {
  const data = await request(`/reports/${encodeURIComponent(id)}/action`, {
    method: "POST",
    body: { action },
  });
  return toReport(data.report);
}

// Maps the backend briefing to the shape AIInsightsSection already renders.
export async function getBriefing() {
  const [b, stats] = await Promise.all([request("/briefing"), request("/reports/stats")]);
  if (!stats.total) return { empty: true };

  return {
    total: stats.total,
    generated_at: b.generated_at,
    insight: {
      headline: b.headline,
      summary: b.summary,
      hotspots: (b.hotspots || []).map((h) => ({
        area: `Cluster near ${h.center_lat.toFixed(3)}, ${h.center_lng.toFixed(3)}`,
        issue: `${h.count} reports within ${Math.round(h.radius_m)} m`,
        signal: h.critical_count > 0 ? `${h.critical_count} critical and still open.` : "Repeated reports in one area.",
        severity: h.critical_count > 0 ? "critical" : "medium",
      })),
      recommendations: b.recommendations || [],
    },
  };
}