// Synthetic events and an in-memory database for isolated tests only.
import type { Firestore } from "firebase-admin/firestore"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { searchAudit } from "@/lib/admin/audit-log"
import { staleSports } from "@/lib/admin/operations"
import { listReportQueue, reviewReport, rollbackReport } from "@/lib/admin/report-review"
import { staffRevokeInvite } from "@/lib/admin/rooms"
import { featureOn, requireSwitch } from "@/lib/api-auth"
import { pendingMatchIds, settledMatchIds, settlePredictions } from "@/lib/community/predictions"
import { buildPreview, buildRecap, buildRoundup, previewable, roundupHourUTC, runPreviews, runRecaps, runRoundup } from "@/lib/content/coverage"
import { filterReports, reportCompetitions, visibleReports } from "@/lib/content/news"
import { applyCorrection, buildReport, saveReport, type Report } from "@/lib/content/reports"
import { failedJobs, runId } from "@/lib/ops/runs"
import { Breaker, CircuitOpenError } from "@/lib/sports/breaker"
import { applyCoverageChange, competitionKey, eventAllowed, summarizeSeen, videoAllowed, type CoverageRules } from "@/lib/sports/coverage"
import type { MatchDetail, TimelineItem } from "@/lib/sports/detail"
import type { SportEvent } from "@/lib/sports/types"
import { fakeDb } from "./fake-db"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

const NOW = new Date("2026-11-05T18:00:00Z")
const DAY = 86_400_000

function memoryDb() {
  const store = new Map<string, Record<string, unknown>>()
  const ref = (key: string) => ({
    key,
    get: async () => ({ exists: store.has(key), data: () => store.get(key) }),
  })
  type Ref = ReturnType<typeof ref>
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async <T,>(work: (tx: unknown) => Promise<T>) =>
      work({
        get: (doc: Ref) => doc.get(),
        create: (doc: Ref, value: Record<string, unknown>) => void store.set(doc.key, value),
        set: (doc: Ref, value: Record<string, unknown>) => void store.set(doc.key, value),
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
  venue: "Harbor Park",
  provider: { name: "TheSportsDB", eventId: "1" },
  sourceUpdatedAt: null,
  coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
})

const upcoming = (overrides: Partial<SportEvent> = {}) => event({ status: "scheduled", score: { kind: "none" }, scheduledStartUTC: "2026-11-06T15:30:00.000Z", ...overrides })

const moment = (minute: number, kind: TimelineItem["kind"], player: string, side: TimelineItem["side"] = "home"): TimelineItem => ({ id: `${minute}`, minute, kind, side, player, secondary: null })

const detail = (timeline: TimelineItem[]): MatchDetail => ({ state: timeline.length ? "ok" : "empty", timeline, stats: [], lineups: { home: [], away: [] }, fetchedAt: "t" })

const goals = [moment(12, "goal", "A. Striker"), moment(40, "goal", "B. Winger", "away"), moment(77, "penalty", "A. Striker")]

afterEach(() => vi.unstubAllEnvs())

describe("recaps", () => {
  it("uses timeline facts and nothing else", () => {
    const recap = buildRecap(event(), detail(goals), "en", "t", NOW)
    expect(recap).toMatchObject({ id: "tsdb-1-recap-en", type: "recap", status: "validated", title: "Recap: Harbor City v Ridge United" })
    expect(recap?.body).toBe("Harbor City 2, Ridge United 1. Test League, November 5, 2026 (UTC).\n12' Goal: A. Striker (Harbor City).\n40' Goal: B. Winger (Ridge United).\n77' Penalty goal: A. Striker (Harbor City).")
  })
  it("writes in French too", () => {
    expect(buildRecap(event(), detail(goals), "fr", "t", NOW)?.body).toContain("77' But sur penalty : A. Striker (Harbor City).")
  })
  it("never invents moments for a score-only event", () => {
    expect(buildRecap(event(), detail([]), "en", "t", NOW)).toBeNull()
    expect(buildRecap(event(), { ...detail(goals), state: "unavailable" }, "en", "t", NOW)).toBeNull()
    expect(buildRecap(event(), detail([moment(5, "yellow", "A. Striker")]), "en", "t", NOW)).toBeNull()
  })
  it("reports nothing for an unfinished or unverified game", () => {
    expect(buildRecap(event({ status: "live" }), detail(goals), "en", "t", NOW)).toBeNull()
    expect(buildRecap(event({ score: { kind: "none" } }), detail(goals), "en", "t", NOW)).toBeNull()
  })
  it("holds a timeline that disagrees with the final score for review", () => {
    const recap = buildRecap(event(), detail(goals.slice(0, 2)), "en", "t", NOW)
    expect(recap).toMatchObject({ status: "draft", withheldReason: "timeline_conflict" })
    expect(recap?.body).not.toBe("")
  })
  it("gives a new source version when the timeline changes, and none when it does not", () => {
    const first = buildRecap(event(), detail(goals), "en", "t", NOW)
    expect(buildRecap(event(), detail(goals), "en", "t", NOW)?.jobKey).toBe(first?.jobKey)
    const moved = [moment(13, "goal", "A. Striker"), ...goals.slice(1)]
    expect(buildRecap(event(), detail(moved), "en", "t", NOW)?.jobKey).not.toBe(first?.jobKey)
  })
  it("spends match detail only on games whose facts moved, and stores one report per language", async () => {
    const { db, store } = memoryDb()
    const detailFor = vi.fn(async () => detail(goals))
    expect((await runRecaps(db, [event()], { detailFor, fetchedAt: "t" }, NOW)).created).toBe(2)
    await runRecaps(db, [event()], { detailFor, fetchedAt: "t" }, NOW)
    expect(detailFor).toHaveBeenCalledTimes(1)
    expect([...store.keys()].sort()).toEqual(["reports/tsdb-1-recap-en", "reports/tsdb-1-recap-fr"])
  })
  it("keeps going when one game's detail cannot be read", async () => {
    const { db } = memoryDb()
    const detailFor = vi.fn(async (item: SportEvent) => {
      if (item.id === "tsdb-1") throw new Error("down")
      return detail(goals)
    })
    const counts = await runRecaps(db, [event(), event({ id: "tsdb-2" })], { detailFor, fetchedAt: "t" }, NOW)
    expect(counts).toMatchObject({ failed: 1, created: 2 })
  })
})

describe("previews", () => {
  it("states only the verified fields, in the viewer's language", () => {
    const en = buildPreview(upcoming(), "en", "t", NOW)
    expect(en).toMatchObject({ id: "tsdb-1-preview-en", status: "validated", title: "Preview: Harbor City v Ridge United" })
    expect(en.body).toBe("Harbor City and Ridge United meet in Test League. Scheduled start: November 6, 2026 at 15:30 (UTC). Venue: Harbor Park.")
    expect(buildPreview(upcoming({ venue: null }), "fr", "t", NOW).body).toBe("Harbor City et Ridge United se rencontrent en Test League. Début prévu : 6 novembre 2026 à 15:30 (UTC).")
  })
  it("leaves out a clock time the source never gave", () => {
    expect(buildPreview(upcoming({ dateOnly: true, venue: null }), "en", "t", NOW).body).toBe("Harbor City and Ridge United meet in Test League. Scheduled date: November 6, 2026 (UTC).")
  })
  it("covers only games still to come in the window", () => {
    expect(previewable(upcoming(), NOW)).toBe(true)
    expect(previewable(upcoming({ scheduledStartUTC: "2026-11-05T17:00:00.000Z" }), NOW)).toBe(false)
    expect(previewable(upcoming({ scheduledStartUTC: "2026-11-09T17:00:00.000Z" }), NOW)).toBe(false)
    expect(previewable(upcoming({ status: "postponed" }), NOW)).toBe(false)
  })
  it("will not name a placeholder team", () => {
    const report = buildPreview(upcoming({ participants: [{ id: null, name: "TBD", role: "home", badgeUrl: null }, { id: "2", name: "Ridge United", role: "away", badgeUrl: null }] }), "en", "t", NOW)
    expect(report).toMatchObject({ status: "draft", body: "", withheldReason: "missing_participants" })
  })
  it("updates in place when the kickoff moves and keeps the publish date", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildPreview(upcoming(), "en", "t", NOW))
    const later = new Date(NOW.getTime() + 60_000)
    expect(await saveReport(db, buildPreview(upcoming({ scheduledStartUTC: "2026-11-06T18:00:00.000Z" }), "en", "t", later))).toBe("replaced")
    const saved = store.get("reports/tsdb-1-preview-en") as unknown as Report
    expect(saved.body).toContain("18:00")
    expect(saved).toMatchObject({ status: "published", publishedAt: NOW.toISOString() })
  })
  it("comes down when the game is postponed, and is not created for one", async () => {
    const { db, store } = memoryDb()
    await runPreviews(db, [upcoming({ id: "tsdb-9", status: "postponed" })], "t", NOW)
    expect(store.size).toBe(0)
    await runPreviews(db, [upcoming()], "t", NOW)
    await runPreviews(db, [upcoming({ status: "postponed" })], "t", NOW)
    expect(store.get("reports/tsdb-1-preview-en")).toMatchObject({ status: "draft", feedKey: null, body: "" })
  })
  it("never overwrites an editor's text", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildPreview(upcoming(), "en", "t", NOW))
    store.set("reports/tsdb-1-preview-en", { ...store.get("reports/tsdb-1-preview-en"), editedAt: NOW.toISOString(), body: "Edited" })
    expect(await saveReport(db, buildPreview(upcoming({ venue: "Elsewhere" }), "en", "t", NOW))).toBe("locked")
    expect(store.get("reports/tsdb-1-preview-en")?.body).toBe("Edited")
  })
})

describe("daily roundup", () => {
  const day = [
    event({ scheduledStartUTC: "2026-11-04T15:00:00.000Z" }),
    event({ id: "tsdb-2", competition: { id: "1", name: "NBA", country: null }, sportId: "basketball", scheduledStartUTC: "2026-11-04T20:00:00.000Z", score: { kind: "team", home: 101, away: 99 } }),
    event({ id: "tsdb-3", status: "postponed", score: { kind: "none" }, scheduledStartUTC: "2026-11-04T20:00:00.000Z" }),
    event({ id: "tsdb-4", score: { kind: "none" }, scheduledStartUTC: "2026-11-04T20:00:00.000Z" }),
  ]
  it("lists verified results only, major competitions first", () => {
    const report = buildRoundup("2026-11-04", day, "en", "t", NOW)
    expect(report).toMatchObject({ id: "roundup-2026-11-04-en", slug: "roundup-2026-11-04", type: "roundup", status: "validated", title: "Daily roundup: November 4, 2026", competition: "" })
    expect(report?.body.split("\n")).toEqual(["Results from November 4, 2026 (UTC).", "NBA: Harbor City 101, Ridge United 99.", "Test League: Harbor City 2, Ridge United 1."])
    expect(report?.sources).toHaveLength(2)
  })
  it("produces nothing on a day with no verified result", () => {
    expect(buildRoundup("2026-11-04", [day[2], day[3]], "en", "t", NOW)).toBeNull()
  })
  it("waits for its hour and writes each language once", async () => {
    const { db, store } = memoryDb()
    expect(await runRoundup(db, day, "t", new Date("2026-11-05T05:59:00Z"))).toEqual({ skipped: "before_schedule" })
    expect(store.size).toBe(0)
    expect(await runRoundup(db, day, "t", new Date("2026-11-05T06:00:00Z"))).toMatchObject({ created: 2 })
    expect(await runRoundup(db, day, "t", new Date("2026-11-05T06:15:00Z"))).toMatchObject({ created: 0, duplicate: 2 })
  })
  it("reads the hour from configuration and ignores nonsense", () => {
    expect(roundupHourUTC({ ROUNDUP_HOUR_UTC: "9" })).toBe(9)
    expect(roundupHourUTC({ ROUNDUP_HOUR_UTC: "0" })).toBe(0)
    expect(roundupHourUTC({ ROUNDUP_HOUR_UTC: "25" })).toBe(6)
    expect(roundupHourUTC({})).toBe(6)
  })
})

describe("generated publishing switch", () => {
  it("keeps validated text out of the feed until it is back on", async () => {
    vi.stubEnv("FEATURE_GENERATED_PUBLISHING", "false")
    const { db, store } = memoryDb()
    await saveReport(db, buildReport(event(), "en", "t", NOW))
    expect(store.get("reports/tsdb-1-result-en")).toMatchObject({ status: "validated", feedKey: null })
    vi.stubEnv("FEATURE_GENERATED_PUBLISHING", "")
    expect(await saveReport(db, buildReport(event(), "en", "t", NOW))).toBe("replaced")
    expect(store.get("reports/tsdb-1-result-en")).toMatchObject({ status: "published" })
  })
  it("leaves features on unless told otherwise", () => {
    expect(featureOn("FEATURE_VIDEO")).toBe(true)
    vi.stubEnv("FEATURE_PAYMENTS", "false")
    expect(featureOn("FEATURE_PAYMENTS")).toBe(false)
    expect(() => requireSwitch("FEATURE_PAYMENTS")).toThrow()
  })
})

describe("news feeds", () => {
  const row = (matchId: string, type: Report["type"], fields: Partial<Report> = {}) => ({ matchId, type, eventDateUTC: NOW.toISOString(), title: `${type}`, competition: "Test League", participants: ["Harbor City", "Ridge United"], ...fields })
  it("shows the fullest report for a match", () => {
    const shown = visibleReports([row("m1", "preview"), row("m1", "result"), row("m1", "recap"), row("m2", "preview"), row("m2", "result"), row("m3", "preview")], NOW)
    expect(shown.map((item) => `${item.matchId}:${item.type}`)).toEqual(["m1:recap", "m2:result", "m3:preview"])
  })
  it("drops a preview once its game is well past", () => {
    expect(visibleReports([row("m1", "preview", { eventDateUTC: new Date(NOW.getTime() - DAY).toISOString() })], NOW)).toEqual([])
  })
  it("filters by team, competition and search together", () => {
    const rows = [row("m1", "result"), row("m2", "result", { competition: "NBA", participants: ["Lakers", "Celtics"] })]
    expect(filterReports(rows, { team: "Lakers" }).map((item) => item.matchId)).toEqual(["m2"])
    expect(filterReports(rows, { competition: "Test League" }).map((item) => item.matchId)).toEqual(["m1"])
    expect(filterReports(rows, { team: "Lakers", competition: "Test League" })).toEqual([])
    expect(filterReports(rows, { q: "celtics" }).map((item) => item.matchId)).toEqual(["m2"])
  })
  it("offers competitions that have reports, leaving out roundups", () => {
    expect(reportCompetitions([{ competition: "B" }, { competition: "A" }, { competition: "A" }, { competition: "" }])).toEqual(["A", "B"])
  })
})

describe("editorial tools", () => {
  const seed = (fields: object = {}) => {
    const fake = fakeDb()
    fake.put("reports/r1", { id: "r1", locale: "en", title: "Result", body: "Original", status: "published", publishedAt: "2026-11-01T00:00:00.000Z", feedKey: "en#2026-11-01T00:00:00.000Z", correctionNote: null, withheldReason: null, updatedAt: "2026-11-01T00:00:00.000Z", sources: [], ...fields })
    return fake
  }
  const correct = (db: ReturnType<typeof fakeDb>["db"], body: string) => applyCorrection(db, "r1", { body, note: "Wrong score", actorUid: "editor" }, NOW)

  it("rolls a correction back to the exact previous text, and the job still stays out", async () => {
    const { db, docs } = seed()
    await correct(db, "Corrected")
    await rollbackReport(db, { id: "r1" }, NOW)
    expect(docs.get("reports/r1")).toMatchObject({ status: "published", body: "Original", correctionNote: null, feedKey: "en#2026-11-01T00:00:00.000Z", editedAt: NOW.toISOString(), previousVersions: 0 })
  })
  it("walks back one version at a time, then refuses", async () => {
    const { db, docs } = seed()
    await correct(db, "First")
    await correct(db, "Second")
    await rollbackReport(db, { id: "r1" }, NOW)
    expect(docs.get("reports/r1")).toMatchObject({ body: "First", status: "corrected" })
    await rollbackReport(db, { id: "r1" }, NOW)
    expect(docs.get("reports/r1")).toMatchObject({ body: "Original" })
    await expect(rollbackReport(db, { id: "r1" }, NOW)).rejects.toMatchObject({ code: "no_previous_version" })
  })
  it("can undo a rejection and put the report back in the feed", async () => {
    const { db, docs } = seed()
    await reviewReport(db, { id: "r1", status: "rejected", actorUid: "editor" }, NOW)
    expect(docs.get("reports/r1")).toMatchObject({ feedKey: null })
    await rollbackReport(db, { id: "r1" }, NOW)
    expect(docs.get("reports/r1")).toMatchObject({ status: "published", feedKey: "en#2026-11-01T00:00:00.000Z" })
  })
  it("will not correct a withheld report without a title", async () => {
    const { db } = seed({ title: "", body: "" })
    await expect(correct(db, "Text")).rejects.toMatchObject({ code: "title_required" })
  })
  it("keeps the published version when a source change sends a report to review", async () => {
    const { db, store } = memoryDb()
    await saveReport(db, buildReport(event(), "en", "t", NOW))
    expect(await saveReport(db, buildReport(event({ score: { kind: "team", home: 3, away: 1 } }), "en", "t", NOW))).toBe("queued")
    const editor = fakeDb()
    for (const [path, value] of store) editor.put(path, value)
    await rollbackReport(editor.db, { id: "tsdb-1-result-en" }, NOW)
    expect(editor.docs.get("reports/tsdb-1-result-en")).toMatchObject({ status: "published", body: expect.stringContaining("Harbor City 2") })
  })
  it("lists a queue newest first with its sources", async () => {
    const { db, put } = seed({ status: "draft", updatedAt: "2026-11-02T00:00:00.000Z", sources: [{ provider: "Feed", eventId: "1", fetchedAt: "t" }] })
    put("reports/r2", { id: "r2", status: "draft", updatedAt: "2026-11-03T00:00:00.000Z", sources: [] })
    put("reports/r3", { id: "r3", status: "published", updatedAt: "2026-11-04T00:00:00.000Z", sources: [] })
    const rows = await listReportQueue(db, "draft")
    expect(rows.map((row) => row.id)).toEqual(["r2", "r1"])
    expect(rows[1].sources[0].provider).toBe("Feed")
    expect((await listReportQueue(db, "published")).map((row) => row.id)).toEqual(["r3"])
  })
})

describe("prediction settlement", () => {
  const entry = (matchId: string, days: number, settled = false, uid = "a") => [`predictions/${matchId}_${uid}`, { uid, displayName: "A", matchId, home: 2, away: 1, settled, settledKey: null, voided: false, points: 0, lockedAtUTC: new Date(NOW.getTime() - days * DAY).toISOString() }] as const
  const seeded = (rows: (readonly [string, object])[]) => {
    const fake = fakeDb()
    for (const [path, value] of rows) fake.put(path, value)
    return fake
  }

  it("does not let future entries or old postponed matches take every slot", async () => {
    const rows = [
      ...Array.from({ length: 600 }, (_, index) => entry(`tsdb-future${index}`, -5)),
      ...Array.from({ length: 30 }, (_, index) => entry(`tsdb-old${index}`, 40 + index)),
      entry("tsdb-new", 0.1),
    ]
    const { db } = seeded(rows)
    const ids = await pendingMatchIds(db, 20, NOW)
    expect(ids).toHaveLength(20)
    expect(ids).toContain("tsdb-new")
    expect(ids.some((id) => id.startsWith("tsdb-future"))).toBe(false)
  })
  it("reaches every stuck match in turn", async () => {
    const { db } = seeded(Array.from({ length: 30 }, (_, index) => entry(`tsdb-old${index}`, 40 + index)))
    const reached = new Set<string>()
    for (let tick = 0; tick < 4; tick += 1) for (const id of await pendingMatchIds(db, 10, new Date(NOW.getTime() + tick * 15 * 60_000))) reached.add(id)
    expect(reached.size).toBe(30)
  })
  it("rechecks settled matches from the past week only", async () => {
    const { db } = seeded([entry("tsdb-1", 1, true), entry("tsdb-2", 30, true), entry("tsdb-3", 1, false), entry("tsdb-4", -1, true)])
    expect(await settledMatchIds(db, 20, NOW)).toEqual(["tsdb-1"])
  })
  it("re-scores a corrected result by the difference, once", async () => {
    const { db, docs } = seeded([entry("tsdb-1", 1)])
    const finished = (home: number) => event({ score: { kind: "team", home, away: 1 } })
    await settlePredictions(db, { events: [finished(2)], lookup: async () => null }, NOW)
    expect(docs.get("prediction_points/a")).toMatchObject({ points: 5, exact: 1 })

    const corrected = { events: [finished(3)], lookup: async () => null }
    expect((await settlePredictions(db, corrected, NOW)).settled).toBe(1)
    expect((await settlePredictions(db, corrected, NOW)).settled).toBe(0)
    expect(docs.get("prediction_points/a")).toMatchObject({ points: 2, exact: 0 })
  })
  it("counts a failed lookup and keeps settling the others", async () => {
    const { db, docs } = seeded([entry("tsdb-1", 1), entry("tsdb-2", 1)])
    const lookup = vi.fn(async (id: string) => {
      if (id === "tsdb-1") throw new Error("provider down")
      return event({ id })
    })
    const result = await settlePredictions(db, { events: [], lookup }, NOW)
    expect(result).toEqual({ checked: 2, settled: 1, failed: 1 })
    expect(docs.get("predictions/tsdb-2_a")).toMatchObject({ settled: true })
  })
  it("spends no lookup on a game already in the feed", async () => {
    const { db } = seeded([entry("tsdb-1", 1)])
    const lookup = vi.fn(async () => null)
    await settlePredictions(db, { events: [event()], lookup }, NOW)
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe("coverage rules", () => {
  const open: CoverageRules = { sports: {}, competitions: {} }
  const key = competitionKey("football", "Test League")

  it("leaves everything on by default", () => {
    expect(eventAllowed(open, event())).toBe(true)
    expect(videoAllowed(open, "football", "Test League")).toBe(true)
  })
  it("hides a switched-off sport or competition and its video", () => {
    const noSport = applyCoverageChange(open, { type: "sport", sportId: "football", enabled: false })
    expect(eventAllowed(noSport, event())).toBe(false)
    expect(videoAllowed(noSport, "football", "Test League")).toBe(false)
    const noLeague = applyCoverageChange(open, { type: "competition", sportId: "football", name: "Test League", enabled: false })
    expect(eventAllowed(noLeague, event())).toBe(false)
    expect(eventAllowed(noLeague, event({ competition: { id: null, name: "Other", country: null } }))).toBe(true)
  })
  it("switches video alone without touching scores", () => {
    const rules = applyCoverageChange(open, { type: "competition", sportId: "football", name: "Test League", video: false })
    expect(eventAllowed(rules, event())).toBe(true)
    expect(videoAllowed(rules, "football", "Test League")).toBe(false)
  })
  it("stores only what differs from the default", () => {
    const off = applyCoverageChange(open, { type: "competition", sportId: "football", name: "Test League", video: false })
    const both = applyCoverageChange(off, { type: "competition", sportId: "football", name: "Test League", enabled: false })
    expect(both.competitions[key]).toEqual({ enabled: false, video: false })
    const on = applyCoverageChange(applyCoverageChange(both, { type: "competition", sportId: "football", name: "Test League", enabled: true }), { type: "competition", sportId: "football", name: "Test League", video: true })
    expect(on.competitions).toEqual({})
    expect(applyCoverageChange(applyCoverageChange(open, { type: "sport", sportId: "tennis", enabled: false }), { type: "sport", sportId: "tennis", enabled: true }).sports).toEqual({})
  })
  it("summarizes what the feed showed, per sport", () => {
    const seen = summarizeSeen([event(), event({ id: "tsdb-2" }), event({ id: "tsdb-3", sportId: "tennis", competition: { id: null, name: "ATP", country: "France" } })], "t")
    expect(seen.get("football")?.["Test League"]).toEqual({ name: "Test League", country: null, lastSeenAt: "t", events: 2 })
    expect(seen.get("tennis")?.ATP.country).toBe("France")
  })
  it("names a sport with nothing recent without calling it failed", () => {
    const stale = staleSports({ football: { League: { name: "League", country: null, lastSeenAt: NOW.toISOString(), events: 1 } } }, NOW.getTime())
    expect(stale.some((row) => row.sportId === "football")).toBe(false)
    expect(stale.find((row) => row.sportId === "tennis")).toEqual({ sportId: "tennis", lastSeenAt: null })
  })
})

describe("circuit breaker", () => {
  const trip = (breaker: Breaker, at: number) => {
    for (let index = 0; index < 5; index += 1) breaker.fail("status_500", at)
  }

  it("stays closed through a few failures and a success clears them", () => {
    const breaker = new Breaker("feed")
    for (let index = 0; index < 4; index += 1) breaker.fail("status_500", 0)
    expect(breaker.status(0).state).toBe("closed")
    breaker.succeed()
    expect(breaker.status(0).failures).toBe(0)
  })
  it("opens after repeated failures and reports why", () => {
    const breaker = new Breaker("feed")
    trip(breaker, 0)
    expect(() => breaker.assertReady(1000)).toThrow(CircuitOpenError)
    expect(breaker.status(1000)).toMatchObject({ state: "open", lastError: "status_500", retryAt: new Date(60_000).toISOString() })
  })
  it("lets one trial through after the wait and recovers on success", () => {
    const breaker = new Breaker("feed")
    trip(breaker, 0)
    breaker.assertReady(60_000)
    expect(breaker.status(60_000).state).toBe("half-open")
    expect(() => breaker.assertReady(60_001)).toThrow(CircuitOpenError)
    breaker.succeed()
    expect(breaker.status(60_001)).toMatchObject({ state: "closed", trips: 0 })
    expect(() => breaker.assertReady(60_002)).not.toThrow()
  })
  it("waits longer each time a trial fails, up to a limit", () => {
    const breaker = new Breaker("feed")
    trip(breaker, 0)
    breaker.assertReady(60_000)
    breaker.fail("no_response", 60_000)
    expect(breaker.status(60_000).retryAt).toBe(new Date(180_000).toISOString())
    for (let index = 0; index < 8; index += 1) {
      const retry = Date.parse(breaker.status(0).retryAt as string)
      breaker.assertReady(retry)
      breaker.fail("no_response", retry)
    }
    const { retryAt, openedAt } = breaker.status(0)
    expect(Date.parse(retryAt as string) - Date.parse(openedAt as string)).toBe(600_000)
  })
})

describe("job records", () => {
  it("reuses a fixed set of ids so the collection cannot grow", () => {
    const at = new Date("2026-11-05T18:00:00Z")
    expect(runId("schedule", at)).toBe(runId("schedule", new Date(at.getTime() + 7 * DAY)))
    expect(runId("schedule", at)).not.toBe(runId("schedule", new Date(at.getTime() + 15 * 60_000)))
  })
  it("names the jobs that failed", () => {
    expect(failedJobs({ reports: { created: 1 }, alerts: { failed: true, error: "job_failed" }, roundup: { skipped: "x" }, nothing: null })).toEqual(["alerts"])
  })
})

describe("audit search", () => {
  const fake = fakeDb()
  beforeEach(() => {
    for (let index = 0; index < 3; index += 1) fake.put(`audit_logs/a${index}`, { action: index === 1 ? "report.correct" : "moderation.room_locked", actorUid: `u${index}`, detail: { roomId: `room-${index}` }, at: `2026-11-0${index + 1}T00:00:00.000Z` })
  })
  it("finds an entry by action, actor or detail, newest first", async () => {
    expect((await searchAudit(fake.db, { q: "report" })).entries.map((row) => row.actorUid)).toEqual(["u1"])
    expect((await searchAudit(fake.db, { q: "U2" })).entries).toHaveLength(1)
    expect((await searchAudit(fake.db, { q: "room-0" })).entries[0].actorUid).toBe("u0")
    expect((await searchAudit(fake.db, { q: "" })).entries.map((row) => row.actorUid)).toEqual(["u2", "u1", "u0"])
  })
  it("continues from an earlier point", async () => {
    expect((await searchAudit(fake.db, { q: "", before: "2026-11-02T00:00:00.000Z" })).entries.map((row) => row.actorUid)).toEqual(["u0"])
  })
})

describe("staff invitation revocation", () => {
  const seed = (inviteHash: string | null) => {
    const fake = fakeDb()
    fake.put("rooms/r1", { hostUid: "host", inviteHash, status: "active" })
    if (inviteHash) fake.put(`room_invites/${inviteHash}`, { roomId: "r1", revoked: false })
    return fake
  }
  it("revokes the link without the staff member joining the room", async () => {
    const { db, docs } = seed("hash")
    expect(await staffRevokeInvite(db, { roomId: "r1", actorUid: "staff", reason: "Abuse" }, NOW)).toEqual({ revoked: true })
    expect(docs.get("room_invites/hash")).toMatchObject({ revoked: true, revokedBy: "staff" })
    expect(docs.get("rooms/r1")).toMatchObject({ inviteHash: null })
  })
  it("says so when there was nothing to revoke", async () => {
    expect(await staffRevokeInvite(seed(null).db, { roomId: "r1", actorUid: "staff", reason: "Abuse" }, NOW)).toEqual({ revoked: false })
    await expect(staffRevokeInvite(fakeDb().db, { roomId: "r1", actorUid: "staff", reason: "Abuse" }, NOW)).rejects.toMatchObject({ code: "not_found" })
  })
})

describe("indexing", () => {
  it("lists public pages only, each with both languages", () => {
    const entries = sitemap()
    expect(entries.some((entry) => /\/app(\/|$)/.test(new URL(entry.url).pathname))).toBe(false)
    const pricing = entries.find((entry) => entry.url.endsWith("/fr/pricing"))
    expect(pricing?.alternates?.languages).toMatchObject({ en: expect.stringMatching(/\/pricing$/), fr: expect.stringMatching(/\/fr\/pricing$/), "x-default": expect.stringMatching(/\/pricing$/) })
  })
  it("keeps the product and sign-in out of crawling in both languages", () => {
    const { disallow } = robots().rules as { disallow: string[] }
    expect(disallow).toEqual(expect.arrayContaining(["/app", "/fr/app", "/signin", "/fr/signin", "/api/"]))
  })
})
