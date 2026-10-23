export const CATEGORIES = [
  "pothole",
  "garbage",
  "water_supply",
  "streetlight",
  "drainage",
  "public_safety",
  "parks",
  "traffic",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATUSES = ["open", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export type MlStatus = "ok" | "unavailable";

export interface Logger {
  warn(message: string): void;
  error(message: string): void;
}

export interface Report {
  id: string;
  description: string;
  category: Category;
  severity: Severity;
  status: Status;
  lat: number;
  lng: number;
  image_url?: string;
  /** INTERNAL ONLY. Never include in an API response. */
  reporter_key: string;
  ml_status: MlStatus;
  ml_category_score: number | null;
  severity_signals: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type PublicReport = Omit<Report, "reporter_key"> & { is_mine: boolean };

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface MlCandidate {
  id: string;
  text: string;
}

export interface DuplicateMatch {
  id: string;
  similarity: number;
}

export interface HotspotPoint {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
}

export interface Hotspot {
  center_lat: number;
  center_lng: number;
  count: number;
  radius_m: number;
  report_ids: string[];
  critical_count: number;
}

export interface ClassifyResult {
  category: Category;
  score: number;
  method: string;
}

export interface SeverityResult {
  severity: Severity;
  score: number;
  signals: string[];
}

export interface Stats {
  total: number;
  open: number;
  resolved: number;
  critical_open: number;
  resolution_rate: number;
  by_category: Record<Category, number>;
  by_severity: Record<Severity, number>;
}

export interface HotspotsResult {
  hotspots: Hotspot[];
  source: "ml" | "local";
}

export interface BriefingReport {
  id: string;
  description: string;
  category: Category;
  lat: number;
  lng: number;
  created_at: string;
}

export interface Briefing {
  headline: string;
  summary: string;
  top_categories: { category: Category; count: number }[];
  hotspots: Hotspot[];
  critical_open: BriefingReport[];
  recommendations: string[];
  generated_at: string;
  source: "rules";
}