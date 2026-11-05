import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import type { DecodedIdToken } from "firebase-admin/auth"
import { getAdminAuth } from "@/lib/firebase-admin"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export interface AuthedUser {
  uid: string
  email: string | null
  emailVerified: boolean
  token: DecodedIdToken
}

function bearerToken(authorization: string | null | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)
  return match ? match[1] : null
}

/** Identity always comes from a verified Firebase token, never from the request body. */
export async function authenticate(authorization: string | null | undefined): Promise<AuthedUser> {
  const token = bearerToken(authorization)
  if (!token) throw new ApiError(401, "unauthenticated", "Sign in to continue")

  const auth = getAdminAuth()
  if (!auth) throw new ApiError(503, "auth_unavailable", "Authentication is temporarily unavailable")

  try {
    const decoded = await auth.verifyIdToken(token, true)
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified === true,
      token: decoded,
    }
  } catch {
    throw new ApiError(401, "invalid_token", "Your session has expired. Sign in again.")
  }
}

export function requireUser(request: Request): Promise<AuthedUser> {
  return authenticate(request.headers.get("authorization"))
}

export async function requireVerifiedUser(request: Request): Promise<AuthedUser> {
  const user = await requireUser(request)
  if (!user.emailVerified) {
    throw new ApiError(403, "email_not_verified", "Verify your email address to continue")
  }
  return user
}

/** Admins need the role claim and a session that completed a second factor. */
export function assertAdmin(user: AuthedUser): void {
  if (user.token.role !== "admin") throw new ApiError(403, "forbidden", "Administrator access required")
  if (!user.token.firebase?.sign_in_second_factor) {
    throw new ApiError(403, "mfa_required", "Multi-factor sign-in is required for administrators")
  }
}

export async function requireAdmin(request: Request): Promise<AuthedUser> {
  const user = await requireUser(request)
  assertAdmin(user)
  return user
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Scheduler authentication. Fails closed when CRON_SECRET is not configured. */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const token = bearerToken(request.headers.get("authorization"))
  return Boolean(secret && token && safeEqual(token, secret))
}

export function requireCron(request: Request): void {
  if (!process.env.CRON_SECRET) throw new ApiError(503, "cron_not_configured", "Scheduler is not configured")
  if (!isCronRequest(request)) throw new ApiError(401, "unauthorized", "Unauthorized")
}

export async function requireAdminOrCron(request: Request): Promise<void> {
  if (isCronRequest(request)) return
  await requireAdmin(request)
}

/** Feature flags default to off. */
export function requireFeature(flag: string): void {
  if (process.env[flag] !== "true") throw new ApiError(503, "feature_disabled", "This feature is not enabled")
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
  }
  console.error("Unhandled API error", error instanceof Error ? error.message : "unknown")
  return NextResponse.json({ success: false, code: "server_error", error: "Something went wrong" }, { status: 500 })
}
