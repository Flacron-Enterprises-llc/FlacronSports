import { ApiError } from "@/lib/api-auth"

const buckets = new Map<string, { count: number; resetAt: number }>()
const MAX_KEYS = 20_000

/** Per-task fixed window. API Gateway throttling is the global limit in front of this. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  if (buckets.size > MAX_KEYS) {
    for (const [stored, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(stored)
    if (buckets.size > MAX_KEYS) buckets.clear()
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
  if (bucket.count > limit) throw new ApiError(429, "rate_limited", "Too many requests. Please slow down.")
}

function forwardedChain(request: Request): string[] {
  return (request.headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean)
}

/** API Gateway appends the address it saw, so only the last entry cannot be forged by the caller. */
export function clientIp(request: Request): string {
  return forwardedChain(request).at(-1) ?? "unknown"
}

/**
 * Amplify proxies browser calls and renders pages, so API Gateway sees a few Amplify
 * addresses for almost everyone. Each of those gets a shared ceiling nobody can forge
 * around. The entry before it is the visitor Amplify passed along and gets the normal
 * limit, scoped to that address so a forged entry cannot use up a real visitor's budget.
 */
export function rateLimitClient(request: Request, scope: string, limits: { visitor: number; shared: number }, windowMs: number, now = Date.now()): void {
  const chain = forwardedChain(request)
  const peer = chain.at(-1) ?? "unknown"
  const visitor = chain.at(-2)
  rateLimit(`${scope}:${peer}`, limits.shared, windowMs, now)
  if (visitor) rateLimit(`${scope}:${peer}:${visitor}`, limits.visitor, windowMs, now)
}
