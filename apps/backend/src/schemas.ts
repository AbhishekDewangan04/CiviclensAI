import { z } from "zod";
import { CATEGORIES, SEVERITIES, STATUSES, type Bbox, type Category } from "./types";

export const DEFAULT_HOTSPOT_RADIUS_M = 300;
export const DEFAULT_HOTSPOT_MIN_POINTS = 3;

export const categorySchema = z.enum(CATEGORIES);
export const severitySchema = z.enum(SEVERITIES);
export const statusSchema = z.enum(STATUSES);
export const mlStatusSchema = z.enum(["ok", "unavailable"]);

/** Unknown categories coming back from the ML service become "other". */
export function coerceCategory(value: string): Category {
  return (CATEGORIES as readonly string[]).includes(value) ? (value as Category) : "other";
}

export const reporterKeySchema = z.string().min(16).max(128);

const httpUrlSchema = z
  .string()
  .max(500)
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "image_url must be an http or https URL" },
  );

export const createReportBodySchema = z.object({
  description: z.string().trim().min(5).max(2000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  image_url: httpUrlSchema.optional(),
  /** What the reporter picked. When present it wins over automatic classification. */
  category: categorySchema.optional(),
  severity: severitySchema.optional(),
});
export type CreateReportInput = z.infer<typeof createReportBodySchema>;

export const actionBodySchema = z.object({
  action: z.enum(["resolve", "reopen"]),
});
export type ReportAction = z.infer<typeof actionBodySchema>["action"];

const bboxSchema = z.string().transform((value, ctx): Bbox => {
  const parts = value.split(",");
  const invalid = (message: string): typeof z.NEVER => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
  };
  if (parts.length !== 4 || parts.some((part) => part.trim() === "")) {
    return invalid("bbox must be minLng,minLat,maxLng,maxLat");
  }
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => !Number.isFinite(n))) {
    return invalid("bbox values must be numbers");
  }
  const [minLng, minLat, maxLng, maxLat] = numbers as [number, number, number, number];
  if (minLng > maxLng || minLat > maxLat) {
    return invalid("bbox minimums must not exceed maximums");
  }
  return { minLng, minLat, maxLng, maxLat };
});

export const listQuerySchema = z.object({
  status: statusSchema.optional(),
  category: categorySchema.optional(),
  severity: severitySchema.optional(),
  mine: z.enum(["true", "false"]).optional(),
  bbox: bboxSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const hotspotsQuerySchema = z.object({
  radius_m: z.coerce.number().positive().max(10_000).default(DEFAULT_HOTSPOT_RADIUS_M),
  min_points: z.coerce.number().int().min(1).max(1000).default(DEFAULT_HOTSPOT_MIN_POINTS),
});

/** Shape of a report as stored on disk. */
export const reportSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: categorySchema,
  severity: severitySchema,
  status: statusSchema,
  lat: z.number(),
  lng: z.number(),
  image_url: z.string().optional(),
  reporter_key: z.string(),
  ml_status: mlStatusSchema,
  ml_category_score: z.number().nullable(),
  severity_signals: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
});

/** ML service response schemas (see the contract in the README). */
export const classifyResponseSchema = z.object({
  category: z.string().transform(coerceCategory),
  score: z.number(),
  method: z.string(),
});

export const severityResponseSchema = z.object({
  severity: severitySchema,
  score: z.number(),
  signals: z.array(z.string()),
});

export const duplicatesResponseSchema = z.object({
  candidates: z.array(z.object({ id: z.string(), similarity: z.number() })),
});

export const hotspotsResponseSchema = z.object({
  hotspots: z.array(
    z.object({
      center_lat: z.number(),
      center_lng: z.number(),
      count: z.number(),
      radius_m: z.number(),
      report_ids: z.array(z.string()),
      critical_count: z.number(),
    }),
  ),
});