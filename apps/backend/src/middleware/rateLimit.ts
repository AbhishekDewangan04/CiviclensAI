import type { RequestHandler } from "express";

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const PRUNE_THRESHOLD = 1000;

/** Fixed-window, in-memory limiter keyed by client IP. */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const clock = options.now ?? (() => Date.now());
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = clock();

    if (buckets.size > PRUNE_THRESHOLD) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    const key = req.ip ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: { code: "rate_limited", message: "Too many requests, please retry later." },
      });
      return;
    }

    next();
  };
}