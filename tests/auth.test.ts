import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verifyIdToken = vi.fn()
const adminAuth = { current: { verifyIdToken } as unknown }

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => adminAuth.current }))

import { ApiError, authenticate, isCronRequest, requireAdmin, requireAdminOrCron, requireCron, requireFeature, requireVerifiedUser } from "@/lib/api-auth"

const request = (authorization?: string) =>
  new Request("https://flacronsport.test/api", { headers: authorization ? { authorization } : {} })

const status = async (promise: Promise<unknown>) => {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as ApiError).status
  }
}

beforeEach(() => {
  verifyIdToken.mockReset()
  adminAuth.current = { verifyIdToken }
  vi.stubEnv("CRON_SECRET", "cron-test-secret")
})
afterEach(() => vi.unstubAllEnvs())

describe("authenticate", () => {
  it("rejects missing and malformed credentials", async () => {
    expect(await status(authenticate(null))).toBe(401)
    expect(await status(authenticate("Basic abc"))).toBe(401)
    expect(verifyIdToken).not.toHaveBeenCalled()
  })
  it("rejects an invalid token", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"))
    expect(await status(authenticate("Bearer forged"))).toBe(401)
  })
  it("checks revocation and takes identity from the token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "user-a", email: "a@test.invalid", email_verified: true })
    expect((await authenticate("Bearer good")).uid).toBe("user-a")
    expect(verifyIdToken).toHaveBeenCalledWith("good", true)
  })
  it("fails closed when Firebase Admin is not configured", async () => {
    adminAuth.current = null
    expect(await status(authenticate("Bearer good"))).toBe(503)
  })
})

describe("role gates", () => {
  it("requires a verified email for checkout", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u", email_verified: false })
    expect(await status(requireVerifiedUser(request("Bearer t")))).toBe(403)
  })
  it("refuses a normal user", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u" })
    expect(await status(requireAdmin(request("Bearer t")))).toBe(403)
  })
  it("refuses an admin without a second factor", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u", role: "admin", firebase: {} })
    await expect(requireAdmin(request("Bearer t"))).rejects.toMatchObject({ code: "mfa_required" })
  })
  it("accepts an admin with a second factor", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u", role: "admin", firebase: { sign_in_second_factor: "totp" } })
    expect(await status(requireAdmin(request("Bearer t")))).toBe(200)
  })
})

describe("scheduler secret", () => {
  it("accepts only the exact secret", () => {
    expect(isCronRequest(request("Bearer cron-test-secret"))).toBe(true)
    expect(isCronRequest(request("Bearer cron-test-secreX"))).toBe(false)
    expect(isCronRequest(request())).toBe(false)
  })
  it("fails closed when no secret is configured", () => {
    vi.stubEnv("CRON_SECRET", "")
    expect(isCronRequest(request("Bearer anything"))).toBe(false)
    expect(() => requireCron(request("Bearer anything"))).toThrow(ApiError)
  })
  it("lets the scheduler past admin routes without a Firebase token", async () => {
    expect(await status(requireAdminOrCron(request("Bearer cron-test-secret")))).toBe(200)
    expect(verifyIdToken).not.toHaveBeenCalled()
  })
})

describe("feature flags", () => {
  it("defaults to off", () => {
    expect(() => requireFeature("GENERATED_PUBLISHING_ENABLED")).toThrow(ApiError)
    vi.stubEnv("GENERATED_PUBLISHING_ENABLED", "true")
    expect(() => requireFeature("GENERATED_PUBLISHING_ENABLED")).not.toThrow()
  })
})
