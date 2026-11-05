// Synthetic provider records for isolated tests only.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { COOKIE_CATEGORIES, getPolicy, POLICIES } from "@/lib/legal/content"
import { normalizeEvent, normalizeStatus } from "@/lib/sports/thesportsdb"
import { SPORTS } from "@/lib/sports/types"
import { evaluateViewing, type VideoSource } from "@/lib/video/viewing"

const raw = { idEvent: "1", strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strTimestamp: "2026-11-05T18:00:00" }

describe("sports normalization", () => {
  it("stores kickoff as UTC", () => {
    expect(normalizeEvent(raw, "football").scheduledStartUTC).toBe("2026-11-05T18:00:00.000Z")
  })
  it("never turns a missing score into zero", () => {
    expect(normalizeEvent({ ...raw, strStatus: "FT", intHomeScore: null, intAwayScore: null }, "football").score).toEqual({ kind: "none" })
    expect(normalizeEvent({ ...raw, strStatus: "NS", intHomeScore: "0", intAwayScore: "0" }, "football").score).toEqual({ kind: "none" })
  })
  it("keeps a real zero", () => {
    expect(normalizeEvent({ ...raw, strStatus: "FT", intHomeScore: "0", intAwayScore: "2" }, "football").score).toEqual({ kind: "team", home: 0, away: 2 })
  })
  it.each([
    ["NS", "scheduled"], ["FT", "finished"], ["AET", "finished"], ["PEN", "finished"], ["1H", "live"], ["Q3", "live"],
    ["PST", "postponed"], ["CANC", "canceled"], ["SUSP", "interrupted"], ["ABD", "abandoned"], ["???", "unknown"],
  ])("maps %s to %s", (status, expected) => {
    expect(normalizeStatus({ idEvent: "1", strStatus: status })).toBe(expected)
  })
  it("honours the postponed flag", () => {
    expect(normalizeStatus({ idEvent: "1", strStatus: "NS", strPostponed: "yes" })).toBe("postponed")
  })
  it("defines all 11 sport categories and enables only football and basketball", () => {
    expect(SPORTS).toHaveLength(11)
    expect(SPORTS.filter((sport) => sport.enabled).map((sport) => sport.id)).toEqual(["football", "basketball"])
  })
})

describe("viewing decision", () => {
  const source: VideoSource = {
    id: "v1", matchId: "m1", provider: "p", type: "live", territories: ["US"], permitted: true, available: true,
    validFromUTC: "2026-11-05T00:00:00Z", validToUTC: "2026-11-06T00:00:00Z", platforms: ["web"], requiresEntitlement: false, officialUrl: null,
  }
  const context = { country: "US", platform: "web", entitled: false, now: new Date("2026-11-05T12:00:00Z") }
  const actions = (result: ReturnType<typeof evaluateViewing>) => result.options.map((option) => option.action)

  it("offers Watch Live only when every check passes", () => {
    expect(actions(evaluateViewing([source], context))).toEqual(["watch_live"])
  })
  it("falls back to Follow Live without any licensed source", () => {
    const result = evaluateViewing([], context)
    expect(actions(result)).toEqual(["follow_live"])
    expect(result.reasons).toContain("no_licensed_source")
  })
  it.each([
    ["territory", { ...source, territories: ["FR"] }, context, "territory_blocked"],
    ["unknown country", source, { ...context, country: null }, "territory_blocked"],
    ["expired", { ...source, validToUTC: "2026-11-05T01:00:00Z" }, context, "outside_window"],
    ["no permission", { ...source, permitted: false }, context, "not_permitted"],
    ["removed", { ...source, available: false }, context, "unavailable"],
    ["platform", { ...source, platforms: ["ios"] }, context, "platform_unsupported"],
    ["entitlement", { ...source, requiresEntitlement: true }, context, "entitlement_required"],
  ])("blocks on %s", (_name, candidate, ctx, reason) => {
    const result = evaluateViewing([candidate], ctx)
    expect(actions(result)).not.toContain("watch_live")
    expect(result.reasons).toContain(reason)
  })
  it("links only https official broadcasters", () => {
    const blocked = { ...source, territories: [], officialUrl: "javascript:alert(1)" }
    expect(actions(evaluateViewing([blocked], context))).toEqual(["follow_live"])
    const official = { ...blocked, officialUrl: "https://broadcaster.example" }
    expect(actions(evaluateViewing([official], context))).toContain("official_broadcaster")
  })
})

describe("localization and policies", () => {
  const leaves = (value: unknown, prefix = ""): string[] =>
    typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, item]) => leaves(item, `${prefix}${key}.`))
      : [prefix]

  it("gives French the same keys as English", () => {
    expect(leaves(getDictionary("fr")).sort()).toEqual(leaves(getDictionary("en")).sort())
  })
  it("publishes all six policies with the broadcast disclaimer on pricing and watch copy", () => {
    expect(POLICIES.map((policy) => policy.slug).sort()).toEqual(
      ["cookie-policy", "disclaimer", "eula", "privacy-policy", "refund-policy", "terms-of-service"],
    )
    const en = getDictionary("en")
    expect(en.pricing.disclaimer).toContain("do not guarantee universal broadcast access")
    expect(en.watch.disclaimer).toContain("do not guarantee universal broadcast access")
  })
  it("keeps the section counts of the source document", () => {
    const counts = Object.fromEntries(POLICIES.map((policy) => [policy.slug, policy.sections.length]))
    expect(counts).toEqual({ eula: 10, "privacy-policy": 14, "terms-of-service": 16, "refund-policy": 8, disclaimer: 8, "cookie-policy": 7 })
    expect(getPolicy("nope")).toBeUndefined()
    expect(COOKIE_CATEGORIES).toHaveLength(4)
  })
  it("shows no user-facing AI wording", () => {
    const text = JSON.stringify(getDictionary("en")) + JSON.stringify(getDictionary("fr"))
    expect(text).not.toMatch(/\bAI\b|\bIA\b/)
  })
  it("sets reject and accept to equal size in the consent bar", () => {
    const source = readFileSync("components/consent/consent-ui.tsx", "utf8")
    expect(source).toContain("fixed inset-x-0 bottom-0")
    expect(source).toContain("fs-glass")
    expect(source).toMatch(/\$\{BUTTON\} \$\{GHOST\}.*rejectNonEssential\("banner"\)/)
  })
})
