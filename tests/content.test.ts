// Synthetic events, users and an in-memory Firestore for isolated tests only.
import type { Firestore } from "firebase-admin/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST as tick } from "@/app/api/jobs/tick/route"
import type { AlertDeps } from "@/lib/alerts/notifications"
import { claimNotification, listNotifications, notificationId, runAlerts, type NotificationRecord } from "@/lib/alerts/notifications"
import { buildAlert, dueAlerts, isQuietHour, localClock, suppressionReason } from "@/lib/alerts/rules"
import { applyCorrection, buildReport, isGrounded, runReports, saveReport, sourceVersion, type Report } from "@/lib/content/reports"
import { brandedEmail, sendEmail } from "@/lib/email-service"
import { getDictionary } from "@/lib/i18n"
import { runIsolated } from "@/lib/jobs/tick"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/me/preferences-defaults"
import { buildDigest, digestEmail, isDeliveryHour, runNewsletter } from "@/lib/newsletter/digest"
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/newsletter/token"
import { normalizeStandings } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"

const ses = vi.hoisted(() => ({ commands: [] as { input: unknown }[] }))

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))
vi.mock("@/lib/billing/firestore-store", () => ({ getEffectiveAccess: async () => ({ plan: "free" }) }))
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    async send(command: { input: unknown }) {
      ses.commands.push(command)
    }
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}))

const NOW = new Date("2026-11-05T18:00:00Z")

function memoryDb() {
  const store = new Map<string, Record<string, unknown>>()
  const docRef = (collection: string, id: string) => {
    const key = `${collection}/${id}`
    return {
      key,
      get: async () => ({ exists: store.has(key), data: () => store.get(key) }),
      create: async (value: Record<string, unknown>) => {
        if (store.has(key)) throw Object.assign(new Error("exists"), { code: 6 })
        store.set(key, value)
      },
      set: async (value: Record<string, unknown>) => void store.set(key, value),
      update: async (patch: Record<string, unknown>) => void store.set(key, { ...store.get(key), ...patch }),
    }
  }
  type Ref = ReturnType<typeof docRef>
  const query = (collection: string, lower = "", upper = "￿") => ({
    where: (_field: string, op: string, value: string) => query(collection, op === ">=" ? value : lower, op === "<" ? value : upper),
    orderBy: () => query(collection, lower, upper),
    limit: () => query(collection, lower, upper),
    get: async () => ({
      docs: [...store.entries()]
        .filter(([key, value]) => key.startsWith(`${collection}/`) && String(value.feedKey) >= lower && String(value.feedKey) < upper)
        .sort(([, a], [, b]) => String(b.feedKey).localeCompare(String(a.feedKey)))
        .map(([, value]) => ({ data: () => value })),
    }),
  })
  const db = {
    collection: (name: string) => ({ doc: (id: string) => docRef(name, id), ...query(name) }),
    // A failed create throws before anything is stored, which matches a rolled-back transaction.
    runTransaction: async <T,>(work: (tx: unknown) => Promise<T>) =>
      work({
        get: (ref: Ref) => ref.get(),
        create: (ref: Ref, value: Record<string, unknown>) => void store.set(ref.key, value),
        set: (ref: Ref, value: Record<string, unknown>) => void store.set(ref.key, value),
      }),
  }
  return { db: db as unknown as Firestore, store }
}

const event = (overrides: Partial<SportEvent> = {}): SportEvent => ({
  id: "tsdb-1",
  sportId: "football",
  eventType: "match",
  participantType: "team",
  participants: [
    { id: "1", name: "Harbor City", role: "home", badgeUrl: null },
    { id: "2", name: "Ridge United", role: "away", badgeUrl: null },
  ],
  competition: { id: "9", name: "Test League", country: null },
  scheduledStartUTC: "2026-11-05T15:00:00.000Z",
  status: "finished",
  providerStatus: "FT",
  score: { kind: "team", home: 2, away: 1 },
  venue: "Should Not Appear Stadium",
  provider: { name: "TheSportsDB", eventId: "1" },
  sourceUpdatedAt: null,
  coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
})

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({ ...DEFAULT_PREFERENCES, favorites: ["Harbor City"], ...overrides })
const alertPrefs = (alerts: Partial<Preferences["alerts"]>, rest: Partial<Preferences> = {}) => prefs({ ...rest, alerts: { ...DEFAULT_PREFERENCES.alerts, ...alerts } })

describe("grounded reports", () => {
  it("builds exactly the verified facts from a score-only input, in both languages", () => {
    const en = buildReport(event(), "en", NOW.toISOString(), NOW)
    expect(en.status).toBe("validated")
    expect(en.body).toBe("Final score: Harbor City 2, Ridge United 1. Test League, November 5, 2026 (UTC).")
    expect(buildReport(event(), "fr", NOW.toISOString(), NOW).body).toBe("Score final : Harbor City 2, Ridge United 1. Test League, 5 novembre 2026 (UTC).")
    expect(en.body).not.toMatch(/Stadium|goal|minute|scored|star|won|beat/i)
  })
  it("keeps the score out of the title, which appears on the spoiler-free list", () => {
    expect(buildReport(event(), "en", NOW.toISOString(), NOW).title).toBe("Result: Harbor City v Ridge United")
  })
  it("reports a real 0-0 rather than treating it as missing", () => {
    expect(buildReport(event({ score: { kind: "team", home: 0, away: 0 } }), "en", NOW.toISOString(), NOW).status).toBe("validated")
  })
  it("rejects text carrying a number the event does not contain", () => {
    expect(isGrounded("Harbor City 2, Ridge United 1. Winner in the 90th minute.", event(), "en")).toBe(false)
  })
  it("ignores digits that belong to a team name", () => {
    const named = event({ participants: [{ id: "1", name: "Schalke 04", role: "home", badgeUrl: null }, { id: "2", name: "Ridge United", role: "away", badgeUrl: null }] })
    expect(buildReport(named, "en", NOW.toISOString(), NOW).status).toBe("validated")
  })
  it("withholds a finished event with no score and writes no text", () => {
    const report = buildReport(event({ score: { kind: "none" } }), "en", NOW.toISOString(), NOW)
    expect(report).toMatchObject({ status: "rejected", withheldReason: "missing_score", title: "", body: "" })
  })
  it("holds an unfinished event as a draft even when a live score exists", () => {
    expect(buildReport(event({ status: "live" }), "en", NOW.toISOString(), NOW)).toMatchObject({ status: "draft", withheldReason: "not_finished", body: "" })
  })
  it("rejects a placeholder team", () => {
    const report = buildReport(event({ participants: [{ id: null, name: "TBD", role: "home", badgeUrl: null }, { id: "2", name: "B", role: "away", badgeUrl: null }] }), "en", NOW.toISOString(), NOW)
    expect(report.withheldReason).toBe("missing_participants")
  })
  it("changes the source version only when the facts change", () => {
    expect(sourceVersion(event())).toBe(sourceVersion(event({ venue: "Elsewhere" })))
    expect(sourceVersion(event())).not.toBe(sourceVersion(event({ score: { kind: "team", home: 3, away: 1 } })))
  })
})

describe("report storage", () => {
  const saved = (store: Map<string, Record<string, unknown>>, id = "tsdb-1-result-en") => store.get(`reports/${id}`) as unknown as Report

  it("publishes once and treats a rerun of the same source as a duplicate", async () => {
    const { db, store } = memoryDb()
    expect(await saveReport(db, buildReport(event(), "en", "t", NOW))).toBe("created")
    expect(saved(store)).toMatchObject({ status: "published", promptVersion: "result-template-v1" })
    expect(saved(store).feedKey).toBe(`en#${NOW.toISOString()}`)
    const later = new Date(NOW.getTime() + 60_000)
    expect(await saveReport(db, buildReport(event(), "en", "t", later))).toBe("duplicate")
    expect(saved(store).generatedAt).toBe(NOW.toISOString())
  })
  it("never lets a rerun overwrite an editor correction, even with new source data", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildReport(event(), "en", "t", NOW))
    await applyCorrection(db, "tsdb-1-result-en", { body: "Final score: Harbor City 3, Ridge United 1.", note: "Provider score was wrong." }, NOW)

    expect(await saveReport(db, buildReport(event(), "en", "t", NOW))).toBe("locked")
    const changed = event({ score: { kind: "team", home: 5, away: 5 } })
    expect(await saveReport(db, buildReport(changed, "en", "t", NOW))).toBe("locked")
    expect(saved(store)).toMatchObject({ status: "corrected", body: "Final score: Harbor City 3, Ridge United 1.", correctionNote: "Provider score was wrong." })
  })
  it("takes a report down for review when the score changes after publication", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildReport(event(), "en", "t", NOW))
    const changed = event({ score: { kind: "team", home: 3, away: 1 } })
    expect(await saveReport(db, buildReport(changed, "en", "t", NOW))).toBe("queued")
    expect(saved(store)).toMatchObject({ status: "draft", withheldReason: "source_changed", feedKey: null })
    const again = event({ score: { kind: "team", home: 4, away: 1 } })
    expect(await saveReport(db, buildReport(again, "en", "t", NOW))).toBe("queued")
    expect(saved(store).status).toBe("draft")
  })
  it("does not let a feed that lost the score unpublish a good report", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildReport(event(), "en", "t", NOW))
    expect(await saveReport(db, buildReport(event({ score: { kind: "none" } }), "en", "t", NOW))).toBe("kept")
    expect(saved(store).status).toBe("published")
  })
  it("publishes once a withheld event gains its score", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildReport(event({ score: { kind: "none" } }), "en", "t", NOW))
    expect(saved(store).status).toBe("rejected")
    expect(await saveReport(db, buildReport(event(), "en", "t", NOW))).toBe("replaced")
    expect(saved(store).status).toBe("published")
  })
  it("runs both languages for finished events and skips the rest", async () => {
    const { db, store } = memoryDb()
    const counts = await runReports(db, [event(), event({ id: "tsdb-2", status: "scheduled", score: { kind: "none" } })], "t", NOW)
    expect(counts.created).toBe(2)
    expect([...store.keys()].sort()).toEqual(["reports/tsdb-1-result-en", "reports/tsdb-1-result-fr"])
  })
})

describe("alert rules", () => {
  it("handles quiet hours across midnight", () => {
    expect([22, 23, 0, 3, 6].every((hour) => isQuietHour(hour, 22, 7))).toBe(true)
    expect([7, 12, 21].some((hour) => isQuietHour(hour, 22, 7))).toBe(false)
  })
  it("handles same-day quiet hours and an unset window", () => {
    expect(isQuietHour(13, 12, 14)).toBe(true)
    expect(isQuietHour(14, 12, 14)).toBe(false)
    expect(isQuietHour(3, null, null)).toBe(false)
    expect(isQuietHour(3, 5, 5)).toBe(false)
  })
  it("applies quiet hours in the user's time zone, not UTC", () => {
    const late = new Date("2026-11-05T22:30:00Z")
    const quiet = { quietStart: 22, quietEnd: 7 }
    expect(suppressionReason(alertPrefs(quiet, { timeZone: "UTC" }), "free", "final", late)).toBe("quiet")
    expect(suppressionReason(alertPrefs(quiet, { timeZone: "America/New_York" }), "free", "final", late)).toBeNull()
    const tokyoDawn = new Date("2026-11-05T21:30:00Z")
    expect(suppressionReason(alertPrefs(quiet, { timeZone: "UTC" }), "free", "final", tokyoDawn)).toBeNull()
    expect(suppressionReason(alertPrefs(quiet, { timeZone: "Asia/Tokyo" }), "free", "final", tokyoDawn)).toBe("quiet")
  })
  it("falls back to UTC for an unknown zone instead of failing", () => {
    expect(localClock(NOW, "Not/AZone")).toEqual({ hour: 18, date: "2026-11-05" })
  })
  it("respects mute and the chosen alert types", () => {
    expect(suppressionReason(alertPrefs({ muted: true }), "premium", "start", NOW)).toBe("muted")
    expect(suppressionReason(alertPrefs({ types: ["final"] }), "premium", "start", NOW)).toBe("type_off")
  })
  it("fires start only around kickoff and final only with a verified score", () => {
    const upcoming = event({ status: "scheduled", score: { kind: "none" }, scheduledStartUTC: "2026-11-05T18:10:00.000Z" })
    expect(dueAlerts(upcoming, NOW)).toEqual(["start"])
    expect(dueAlerts({ ...upcoming, scheduledStartUTC: "2026-11-05T20:00:00.000Z" }, NOW)).toEqual([])
    expect(dueAlerts({ ...upcoming, status: "postponed" }, NOW)).toEqual([])
    expect(dueAlerts(event(), NOW)).toEqual(["final"])
    expect(dueAlerts(event({ score: { kind: "none" } }), NOW)).toEqual([])
  })
  it("keeps the score out of a final alert in spoiler mode", () => {
    const hidden = buildAlert(event(), "final", prefs({ spoilerMode: true }))
    expect(JSON.stringify(hidden)).not.toMatch(/\b2\b|\b1\b/)
    const shown = buildAlert(event(), "final", prefs())
    expect(shown.body).toContain("Harbor City 2, Ridge United 1")
    expect(shown.spoilerFreeBody).not.toContain("Harbor City 2")
  })
  it("uses the user's language", () => {
    expect(buildAlert(event(), "final", prefs({ locale: "fr" })).body).toContain("Score final")
  })
})

describe("alert delivery", () => {
  const deps = (overrides: Partial<AlertDeps> & Pick<AlertDeps, "db">): AlertDeps => ({
    events: [event()],
    users: [{ uid: "u1", prefs: prefs() }],
    planFor: async () => "free",
    emailFor: async () => "fan@example.test",
    send: vi.fn(async () => true),
    siteUrl: "https://example.test",
    now: NOW,
    ...overrides,
  })

  it("makes a duplicate impossible at the store", async () => {
    const { db } = memoryDb()
    const record = { uid: "u1", eventId: "e1", type: "final", feedKey: "u1#t" } as NotificationRecord
    expect(await claimNotification(db, record)).toBe(true)
    expect(await claimNotification(db, record)).toBe(false)
  })
  it("delivers once across reruns and overlapping ticks", async () => {
    const { db, store } = memoryDb()
    const send = vi.fn(async () => true)
    const user = { uid: "u1", prefs: alertPrefs({ email: true }) }
    const results = await Promise.all([runAlerts(deps({ db, send, users: [user] })), runAlerts(deps({ db, send, users: [user] }))])
    const rerun = await runAlerts(deps({ db, send, users: [user] }))
    expect(results[0].created + results[1].created).toBe(1)
    expect(rerun).toMatchObject({ created: 0, duplicate: 1 })
    expect(store.size).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it("sends no email without the opt-in, and still records the in-app alert", async () => {
    const { db, store } = memoryDb()
    const send = vi.fn(async () => true)
    expect((await runAlerts(deps({ db, send }))).created).toBe(1)
    expect(send).not.toHaveBeenCalled()
    expect(store.get(`notifications/${notificationId("u1", "tsdb-1", "final")}`)).toMatchObject({ emailStatus: "not_requested" })
  })
  it("defers a final alert during quiet hours so a later tick can deliver it", async () => {
    const { db, store } = memoryDb()
    const user = { uid: "u1", prefs: alertPrefs({ quietStart: 17, quietEnd: 19 }) }
    expect((await runAlerts(deps({ db, users: [user] }))).suppressed).toBe(1)
    expect(store.size).toBe(0)
    const after = new Date("2026-11-05T19:30:00Z")
    expect((await runAlerts(deps({ db, users: [user], now: after }))).created).toBe(1)
  })
  it("ignores events the user does not follow", async () => {
    const { db, store } = memoryDb()
    await runAlerts(deps({ db, users: [{ uid: "u1", prefs: prefs({ favorites: ["Elsewhere FC"] }) }] }))
    expect(store.size).toBe(0)
  })
  it("records a failed email without retrying it", async () => {
    const { db, store } = memoryDb()
    const send = vi.fn(async () => { throw new Error("SES down") })
    const user = { uid: "u1", prefs: alertPrefs({ email: true }) }
    expect((await runAlerts(deps({ db, send, users: [user] }))).emailFailed).toBe(1)
    await runAlerts(deps({ db, send, users: [user] }))
    expect(send).toHaveBeenCalledTimes(1)
    expect(store.get(`notifications/${notificationId("u1", "tsdb-1", "final")}`)).toMatchObject({ emailStatus: "failed" })
  })
  it("carries on with other users when one fails", async () => {
    const { db } = memoryDb()
    const planFor = vi.fn(async (uid: string) => {
      if (uid === "u1") throw new Error("down")
      return "free" as const
    })
    const counts = await runAlerts(deps({ db, planFor, users: [{ uid: "u1", prefs: prefs() }, { uid: "u2", prefs: prefs() }] }))
    expect(counts).toMatchObject({ failed: 1, created: 1 })
  })
  it("hides a stored score once spoiler mode is on, and shows only the caller's records", async () => {
    const { db } = memoryDb()
    await runAlerts(deps({ db }))
    await runAlerts(deps({ db, users: [{ uid: "u2", prefs: prefs() }] }))
    const open = await listNotifications(db, "u1", false)
    expect(open).toHaveLength(1)
    expect(open[0].body).toContain("Harbor City 2")
    expect((await listNotifications(db, "u1", true))[0].body).not.toContain("Harbor City 2")
  })
})

describe("newsletter", () => {
  const SECRET = "test-only-secret"
  const subscribed = (overrides: Partial<Preferences> = {}) => prefs({ newsletter: { optedIn: true, consentedAt: "2026-01-01T00:00:00Z" }, ...overrides })

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET)
  })

  it.each([
    ["2026-11-05T13:00:00Z", "America/New_York", true],
    ["2026-11-05T13:00:00Z", "Europe/Paris", false],
    ["2026-11-05T07:15:00Z", "Europe/Paris", true],
    ["2026-11-05T02:29:00Z", "Asia/Kolkata", false],
    ["2026-11-05T02:30:00Z", "Asia/Kolkata", true],
    ["2026-11-05T03:29:00Z", "Asia/Kolkata", true],
    ["2026-11-05T03:30:00Z", "Asia/Kolkata", false],
    ["2026-11-04T23:45:00Z", "Asia/Tokyo", true],
    ["2026-11-05T08:00:00Z", "UTC", true],
    ["2026-11-05T09:00:00Z", "UTC", false],
  ])("at %s in %s the delivery hour is %s", (iso, zone, expected) => {
    expect(isDeliveryHour(new Date(iso), zone)).toBe(expected)
  })
  it("uses the user's local date across the date line", () => {
    expect(localClock(new Date("2026-11-04T23:45:00Z"), "Asia/Tokyo").date).toBe("2026-11-05")
    expect(localClock(new Date("2026-11-05T03:00:00Z"), "America/Los_Angeles").date).toBe("2026-11-04")
  })

  const deps = (db: Firestore, send = vi.fn(async () => true)) => ({
    db, send, events: [event()], users: [{ uid: "u1", prefs: subscribed() }], emailFor: async () => "fan@example.test",
    siteUrl: "https://example.test", now: new Date("2026-11-05T08:00:00Z"),
  })

  it("sends one digest per local date across every tick in the hour", async () => {
    const { db } = memoryDb()
    const send = vi.fn(async () => true)
    const base = deps(db, send)
    expect((await runNewsletter(base)).sent).toBe(1)
    expect((await runNewsletter({ ...base, now: new Date("2026-11-05T08:15:00Z") })).duplicate).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it("sends nothing outside the delivery hour or without opt-in", async () => {
    const { db } = memoryDb()
    const send = vi.fn(async () => true)
    await runNewsletter({ ...deps(db, send), now: new Date("2026-11-05T12:00:00Z") })
    await runNewsletter({ ...deps(db, send), users: [{ uid: "u2", prefs: prefs() }] })
    expect(send).not.toHaveBeenCalled()
  })
  it("does not retry a failed send, so it can never double-mail", async () => {
    const { db, store } = memoryDb()
    const send = vi.fn(async () => { throw new Error("SES down") })
    const base = deps(db, send as never)
    expect((await runNewsletter(base)).failed).toBe(1)
    await runNewsletter(base)
    expect(send).toHaveBeenCalledTimes(1)
    expect(store.get("newsletter_sends/u1_2026-11-05")).toMatchObject({ status: "failed" })
  })
  it("sends nothing and claims nothing when there is no verified content", async () => {
    const { db, store } = memoryDb()
    expect((await runNewsletter({ ...deps(db), events: [] })).empty).toBe(1)
    expect(store.size).toBe(0)
  })
  it("drops scores from the digest in spoiler mode", () => {
    const shown = buildDigest(subscribed(), [event()], NOW)
    const hidden = buildDigest(subscribed({ spoilerMode: true }), [event()], NOW)
    expect(shown?.lines.join(" ")).toContain("Harbor City 2, Ridge United 1")
    expect(hidden?.lines.join(" ")).not.toMatch(/\b2\b/)
  })
  it("never shows a missing score as zero in the digest", () => {
    expect(buildDigest(subscribed(), [event({ score: { kind: "none" } })], NOW)).toBeNull()
  })
  it("carries one-click unsubscribe headers with a valid token", () => {
    const digest = buildDigest(subscribed(), [event()], NOW)
    const email = digestEmail("u1", subscribed(), digest!, "fan@example.test", "https://example.test")
    const header = email?.headers?.find((item) => item.name === "List-Unsubscribe")?.value ?? ""
    expect(email?.headers).toContainEqual({ name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" })
    const url = new URL(header.slice(1, -1))
    expect(url.pathname).toBe("/api/newsletter/unsubscribe")
    expect(verifyUnsubscribeToken(url.searchParams.get("token"))).toBe("u1")
  })
  it("passes custom headers to SES as Simple headers", async () => {
    vi.stubEnv("SES_REGION", "us-east-1")
    vi.stubEnv("EMAIL_FROM", "FlacronSport <noreply@example.test>")
    ses.commands.length = 0
    await sendEmail({ to: "fan@example.test", subject: "s", html: "h", text: "t", headers: [{ name: "List-Unsubscribe", value: "<https://example.test>" }] })
    expect(ses.commands[0].input).toMatchObject({ Content: { Simple: { Headers: [{ Name: "List-Unsubscribe", Value: "<https://example.test>" }] } } })
  })
  it("escapes feed text in digest email", () => {
    const { html } = brandedEmail({ heading: "h", body: "b", cta: "c", url: "https://example.test", footnote: "f", siteUrl: "https://example.test", lines: ["<script>x</script>"] })
    expect(html).not.toContain("<script>")
  })
})

describe("unsubscribe token", () => {
  const SECRET = "test-only-secret"

  it("accepts its own token", () => {
    expect(verifyUnsubscribeToken(unsubscribeToken("user-1", SECRET), SECRET)).toBe("user-1")
  })
  it("rejects a tampered signature or a swapped uid", () => {
    const token = unsubscribeToken("user-1", SECRET) as string
    const last = token.slice(-1)
    expect(verifyUnsubscribeToken(`${token.slice(0, -1)}${last === "A" ? "B" : "A"}`, SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(token.replace("user-1", "user-2"), SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(`${token}x`, SECRET)).toBeNull()
  })
  it("rejects malformed tokens and another secret", () => {
    expect(verifyUnsubscribeToken("no-signature", SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(".abc", SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(null, SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(unsubscribeToken("user-1", "other"), SECRET)).toBeNull()
  })
  it("fails closed without a secret", () => {
    vi.stubEnv("CRON_SECRET", "")
    expect(unsubscribeToken("user-1")).toBeNull()
    expect(verifyUnsubscribeToken("user-1.abc")).toBeNull()
  })
})

describe("jobs and standings", () => {
  const call = (token?: string) => tick(new Request("https://example.test/api/jobs/tick", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} }))
  const code = async (response: Response) => [response.status, ((await response.json()) as { code: string }).code]

  it("refuses the tick without the secret, with the flag off, and without storage", async () => {
    vi.stubEnv("CRON_SECRET", "")
    expect(await code(await call("anything"))).toEqual([503, "cron_not_configured"])
    vi.stubEnv("CRON_SECRET", "test-only-secret")
    expect(await code(await call())).toEqual([401, "unauthorized"])
    expect(await code(await call("wrong"))).toEqual([401, "unauthorized"])
    vi.stubEnv("JOBS_ENABLED", "")
    expect(await code(await call("test-only-secret"))).toEqual([503, "feature_disabled"])
    vi.stubEnv("JOBS_ENABLED", "true")
    expect(await code(await call("test-only-secret"))).toEqual([503, "storage_unavailable"])
  })
  it("keeps running other jobs when one fails, without leaking the error", async () => {
    const after = vi.fn(async () => ({ sent: 1 }))
    const results = await runIsolated({ reports: async () => { throw new Error("secret detail") }, newsletter: after })
    expect(after).toHaveBeenCalled()
    expect(results).toEqual({ reports: { failed: true, error: "job_failed" }, newsletter: { sent: 1 } })
  })
  it("keeps missing standings values null while a real zero stays zero", () => {
    const { rows, sourceUpdatedAt } = normalizeStandings([{ intRank: "1", strTeam: "A", intDraw: "0", intPoints: "", intGoalDifference: "-3", dateUpdated: "2026-11-02 23:11:22" }])
    expect(rows[0]).toMatchObject({ drawn: 0, points: null, played: null, difference: -3 })
    expect(sourceUpdatedAt).toBe("2026-11-02T23:11:22.000Z")
  })
  it("writes no user-facing AI wording in the new strings", () => {
    const { reports, alerts, notifications, newsletter, team, standings } = getDictionary("en")
    expect(JSON.stringify({ reports, alerts, notifications, newsletter, team, standings })).not.toMatch(/\bAI\b|artificial intelligence/i)
  })
})

describe("moved events", () => {
  it("gives a moved kickoff its own start alert and leaves the final alert single", () => {
    const first = notificationId("u1", "tsdb-1", "start", "2026-11-05T18:00:00.000Z")
    const moved = notificationId("u1", "tsdb-1", "start", "2026-11-05T20:00:00.000Z")
    expect(moved).not.toBe(first)
    expect(notificationId("u1", "tsdb-1", "start", "2026-11-05T18:00:00.000Z")).toBe(first)
    expect(notificationId("u1", "tsdb-1", "final", "2026-11-05T18:00:00.000Z")).toBe(notificationId("u1", "tsdb-1", "final", "2026-11-05T20:00:00.000Z"))
  })
})
