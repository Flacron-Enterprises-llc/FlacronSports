import { ApiError } from "@/lib/api-auth"

const buckets = new Map<string, { count: number; resetAt: number }>()
const MAX_KEYS = 20_000

/** Per-task fixed window. API Gateway throttling is the global limit in front of this. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  if (buckets.size > MAX_KEYS) buckets.clear()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
  if (bucket.count > limit) throw new ApiError(429, "rate_limited", "Too many requests. Please slow down.")
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
}
