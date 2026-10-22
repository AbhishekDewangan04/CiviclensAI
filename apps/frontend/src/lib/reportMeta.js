import {
  Construction,
  Lamp,
  Trash2,
  Droplets,
  ShieldAlert,
  Trees,
  TrafficCone,
  CircleAlert,
} from "lucide-react";

export const CATEGORIES = [
  { value: "roads", label: "Roads & Potholes", Icon: Construction },
  { value: "streetlights", label: "Street Lighting", Icon: Lamp },
  { value: "waste", label: "Waste & Sanitation", Icon: Trash2 },
  { value: "water", label: "Water & Drainage", Icon: Droplets },
  { value: "safety", label: "Public Safety", Icon: ShieldAlert },
  { value: "parks", label: "Parks & Trees", Icon: Trees },
  { value: "traffic", label: "Traffic & Signals", Icon: TrafficCone },
  { value: "other", label: "Other", Icon: CircleAlert },
];

export const STATUSES = [
  { value: "pending", label: "Pending", tone: "warning" },
  { value: "in_review", label: "In Review", tone: "warning" },
  { value: "active", label: "Active", tone: "success" },
  { value: "resolved", label: "Resolved", tone: "success" },
];

export const SEVERITIES = [
  { value: "low", label: "Low", tone: "muted" },
  { value: "medium", label: "Medium", tone: "muted" },
  { value: "high", label: "High", tone: "warning" },
  { value: "critical", label: "Critical", tone: "critical" },
];

export const TONES = {
  success: {
    hex: "#10B981",
    text: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  warning: {
    hex: "#F59E0B",
    text: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  critical: {
    hex: "#F43F5E",
    text: "text-rose-400",
    bg: "bg-rose-500/12",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
  },
  muted: {
    hex: "#94A3B8",
    text: "text-slate-300",
    bg: "bg-white/5",
    border: "border-white/10",
    dot: "bg-slate-400",
  },
};

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.value, s]));
export const SEVERITY_MAP = Object.fromEntries(SEVERITIES.map((s) => [s.value, s]));
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export function statusTone(report) {
  return STATUS_MAP[report?.status]?.tone || "warning";
}

export function severityTone(report) {
  return SEVERITY_MAP[report?.severity]?.tone || "muted";
}

// Marker colour: emergency alerts shout in rose, live work glows emerald,
// everything still waiting reads amber.
export function markerColor(report) {
  if (report?.status === "resolved" || report?.status === "active") return TONES.success.hex;
  if (report?.severity === "critical") return TONES.critical.hex;
  return TONES.warning.hex;
}

export function isCritical(report) {
  return report?.severity === "critical" && report?.status !== "resolved";
}

const KEY_STORAGE = "civiclens.reporter.v1";

// Each device gets one long random key: it is how "My Reports" finds this
// reporting device again, and the only proof accepted when closing a report.
export function getReporterKey() {
  try {
    let key = window.localStorage.getItem(KEY_STORAGE);
    if (!key) {
      key = window.crypto?.randomUUID ? window.crypto.randomUUID() : `civic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY_STORAGE, key);
    }
    return key;
  } catch (e) {
    return "anonymous-device";
  }
}