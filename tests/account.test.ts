// Synthetic users and an in-memory store for isolated tests only.
import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, Record<string, unknown>>()
let plan = "free"

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => null,
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: store.has(`${name}/${id}`), data: () => store.get(`${name}/${id}`) }),
        set: async (value: Record<string, unknown>) => void store.set(`${name}/${id}`, value),
      }),
    }),
  }),
}))
vi.mock("@/lib/billing/firestore-store", () => ({ getEffectiveAccess: async () => ({ plan }) }))

import { ApiError } from "@/lib/api-auth"
import { ownDomainLink } from "@/lib/auth-email"
import { getPreferences, updatePreferences } from "@/lib/me/preferences"
import { DEFAULT_PREFERENCES as CLIENT_DEFAULTS } from "@/lib/me/preferences-defaults"
import { DEFAULT_PREFERENCES as SERVER_DEFAULTS } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"

const teams = (count: number) => Array.from({ length: count }, (_, index) => `Team ${index}`)

beforeEach(() => {
  store.clear()
  plan = "free"
})

describe("favorites limits are enforced on the server", () => {
  it("refuses a sixth favorite on Free", async () => {
    await updatePreferences("u", { favorites: teams(5) })
    await expect(updatePreferences("u", { favorites: teams(6) })).rejects.toMatchObject({ code: "favorites_limit" })
  })
  it("allows unlimited favorites on a paid plan", async () => {
    plan = "plus"
    expect((await updatePreferences("u", { favorites: teams(40) })).favorites).toHaveLength(40)
  })
  it("keeps saved favorites after a downgrade but blocks new ones", async () => {
    plan = "plus"
    await updatePreferences("u", { favorites: teams(8) })
    plan = "free"
    expect((await getPreferences("u")).favorites).toHaveLength(8)
    await expect(updatePreferences("u", { favorites: teams(9) })).rejects.toBeInstanceOf(ApiError)
    expect((await updatePreferences("u", { favorites: teams(7) })).favorites).toHaveLength(7)
  })
})

describe("preferences", () => {
  it("rejects unknown shapes", async () => {
    await expect(updatePreferences("u", { favorites: "all" })).rejects.toMatchObject({ code: "invalid_request" })
  })
  it("limits Free alerts to start and final", async () => {
    const saved = await updatePreferences("u", { alerts: { ...SERVER_DEFAULTS.alerts, types: ["start", "scoring"] } })
    expect(saved.alerts.types).toEqual(["start"])
  })
  it("keeps paid alert types on a paid plan", async () => {
    plan = "premium"
    const saved = await updatePreferences("u", { alerts: { ...SERVER_DEFAULTS.alerts, types: ["start", "scoring"] } })
    expect(saved.alerts.types).toEqual(["start", "scoring"])
  })
  it("records when newsletter consent was given, and takes no client date", async () => {
    const saved = await updatePreferences("u", { newsletter: { optedIn: true, consentedAt: "2000-01-01T00:00:00.000Z" } })
    expect(saved.newsletter.consentedAt).not.toBe("2000-01-01T00:00:00.000Z")
    expect(saved.newsletter.consentedAt).not.toBeNull()
  })
  it("keeps browser and server defaults identical", () => {
    expect(CLIENT_DEFAULTS).toEqual(SERVER_DEFAULTS)
  })
})

describe("rate limit", () => {
  it("blocks past the limit and resets after the window", () => {
    rateLimit("k", 2, 1000, 0)
    rateLimit("k", 2, 1000, 1)
    expect(() => rateLimit("k", 2, 1000, 2)).toThrow(ApiError)
    expect(() => rateLimit("k", 2, 1000, 1001)).not.toThrow()
  })
})

describe("own-domain action links", () => {
  it("moves the code to our domain and drops Firebase's URL", () => {
    const link = ownDomainLink("https://flacronsport.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=abc&apiKey=x", "verifyEmail", "https://flacronsport.com")
    expect(link).toBe("https://flacronsport.com/auth/action?mode=verifyEmail&oobCode=abc")
  })
})
