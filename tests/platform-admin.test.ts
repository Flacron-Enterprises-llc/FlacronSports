import { beforeEach, describe, expect, it, vi } from "vitest"

const getUser = vi.fn()
vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => ({ getUser }), getAdminDb: () => null }))

const { clearAdminCache, isPlatformAdmin, ADMIN_ACCESS } = await import("@/lib/billing/platform-admin")

describe("platform administrators", () => {
  beforeEach(() => {
    clearAdminCache()
    getUser.mockReset()
  })

  it("treats the admin role as full access", async () => {
    getUser.mockResolvedValue({ customClaims: { role: "admin" } })
    expect(await isPlatformAdmin("a")).toBe(true)
    expect(ADMIN_ACCESS.plan).toBe("premium")
  })

  it("gives other staff roles no plan", async () => {
    getUser.mockResolvedValue({ customClaims: { role: "editor" } })
    expect(await isPlatformAdmin("b")).toBe(false)
  })

  it("resolves a failed lookup downward", async () => {
    getUser.mockRejectedValue(new Error("down"))
    expect(await isPlatformAdmin("c")).toBe(false)
  })

  it("asks once in five minutes", async () => {
    getUser.mockResolvedValue({ customClaims: { role: "admin" } })
    await isPlatformAdmin("d", 0)
    await isPlatformAdmin("d", 60_000)
    expect(getUser).toHaveBeenCalledTimes(1)
  })
})
