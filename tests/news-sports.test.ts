import { describe, expect, it, vi } from "vitest"
import { buildPreview, buildRecap, buildRoundup, runRoundup } from "@/lib/content/coverage"
import { balanceBySport, filterReports, isSportRoundup, pageOfReports, reportCompetitions, reportTeams } from "@/lib/content/news"
import { buildReport, isGrounded, listNewsReports, sportFeedKey, type Report } from "@/lib/content/reports"
import { getDictionary } from "@/lib/i18n"
import { DAILY_REPORTS_FLOOR, DAILY_REPORTS_PER_SPORT, interleave, isMajorCompetition, isMajorIn, selectForReports } from "@/lib/sports/priority"
import { resultLine } from "@/lib/sports/presentation"
import { isCovered } from "@/lib/sports/thesportsdb"
import type { EventScore, SportEvent, SportId } from "@/lib/sports/types"

const db = vi.hoisted(() => ({ current: null as unknown }))
vi.mock("@/lib/firebase-admin", () => ({ getAdminDb: () => db.current, getAdminAuth: () => null }))

const NOW = new Date("2026-11-05T12:00:00.000Z")

function game(id: string, sportId: SportId, competition: string, fields: Partial<SportEvent> = {}): SportEvent {
  return {
    id: `tsdb-${id}`, sportId, eventType: "match", participantType: "team",
    participants: [{ id: "1", name: "Harbor City", role: "home", badgeUrl: null }, { id: "2", name: "Ridge United", role: "away", badgeUrl: null }],
    competition: { id: competition, name: competition, country: null },
    scheduledStartUTC: "2026-11-04T15:00:00.000Z", status: "finished", providerStatus: "FT",
    score: { kind: "team", home: 2, away: 1 }, venue: null,
    provider: { name: "TheSportsDB", eventId: id }, sourceUpdatedAt: null,
    coverageFlags: { liveScores: false, statistics: false, video: false },
    ...fields,
  }
}

const competitors = (...names: string[]) => names.map((name) => ({ id: null, name, role: "competitor" as const, badgeUrl: null }))
const many = (count: number, sportId: SportId, competition: string, prefix = competition) => Array.from({ length: count }, (_, index) => game(`${prefix}-${index}`, sportId, competition))

describe("competition names from the feed", () => {
  it.each<[SportId, string[]]>([
    ["basketball", ["NBA", "EuroLeague Basketball", "WNBA", "NCAA Division I Basketball Mens"]],
    ["ice-hockey", ["NHL", "Russian KHL", "Mens Ice Hockey World Championships"]],
    ["american-football", ["NFL", "NCAA Division 1 Football"]],
    ["baseball", ["MLB", "Korean KBO League"]],
    ["rugby", ["English Prem Rugby", "French Top 14", "Six Nations Championship", "European Rugby Champions Cup"]],
    ["volleyball", ["CEV Champions League", "FIVB Volleyball Mens Nations League", "Italian Volleyball League", "Polish PlusLiga"]],
    ["tennis", ["ATP World Tour", "WTA Tour"]],
    ["combat-sports", ["UFC", "Professional Fighters League"]],
    ["motorsport", ["Formula 1", "MotoGP", "NASCAR Cup Series", "IndyCar Series"]],
    ["cricket", ["Australian Big Bash League", "Indian Premier League", "ICC World Test Championship"]],
  ])("%s lists its top leagues", (sportId, names) => {
    for (const name of names) expect(isMajorIn(sportId, name), name).toBe(true)
  })
  it("keeps development leagues out, and a name counts only in its own sport", () => {
    expect(isMajorIn("basketball", "NBA G League")).toBe(false)
    expect(isMajorIn("baseball", "MLB Spring Training")).toBe(false)
    expect(isMajorIn("rugby", "Six Nations Under 20s Championship")).toBe(false)
    expect(isMajorIn("volleyball", "Italian Serie A")).toBe(false)
    expect(isMajorCompetition("NHL")).toBe(true)
  })
  it("lets PFL through the combat filter while scripted wrestling stays out", () => {
    expect(isCovered({ idEvent: "1", strLeague: "Professional Fighters League" }, "combat-sports")).toBe(true)
    expect(isCovered({ idEvent: "1", strLeague: "WWE" }, "combat-sports")).toBe(false)
  })
})

describe("report selection per sport", () => {
  const none = () => false

  it("caps each sport and day, and football cannot take another sport's place", () => {
    const events = [...many(200, "football", "English Premier League"), ...many(3, "volleyball", "Polish PlusLiga"), ...many(120, "basketball", "NBA")]
    const chosen = selectForReports(events, none)
    const count = (sport: SportId) => chosen.filter((event) => event.sportId === sport).length
    expect(count("football")).toBe(DAILY_REPORTS_PER_SPORT)
    expect(count("basketball")).toBe(DAILY_REPORTS_PER_SPORT)
    expect(count("volleyball")).toBe(3)
  })
  it("counts each day on its own", () => {
    const later = many(60, "basketball", "NBA", "later").map((event) => ({ ...event, scheduledStartUTC: "2026-11-05T15:00:00.000Z" }))
    expect(selectForReports([...many(60, "basketball", "NBA"), ...later], none)).toHaveLength(DAILY_REPORTS_PER_SPORT * 2)
  })
  it("shares a full day between a sport's major competitions", () => {
    const chosen = selectForReports([...many(100, "football", "English Premier League"), ...many(5, "football", "Ivory Coast Ligue 1")], none)
    expect(chosen.filter((event) => event.competition.name === "Ivory Coast Ligue 1")).toHaveLength(5)
  })
  it("tops up a quiet sport from its other competitions, but never football", () => {
    expect(selectForReports(many(30, "ice-hockey", "American ECHL"), none)).toHaveLength(DAILY_REPORTS_FLOOR)
    expect(selectForReports(many(30, "football", "Georgian Liga 3"), none)).toEqual([])
  })
  it("gives the same answer as games change status, so a preview's game keeps its result report", () => {
    const events = many(90, "basketball", "NBA")
    const later = events.map((event, index) => (index % 2 ? { ...event, status: "scheduled" as const, score: { kind: "none" as const } } : event))
    expect(selectForReports(later, none).map((event) => event.id)).toEqual(selectForReports(events, none).map((event) => event.id))
  })
  it("always keeps a followed game, outside the quota", () => {
    const followed = game("mine", "football", "Georgian Liga 3")
    const chosen = selectForReports([followed, ...many(100, "football", "English Premier League")], (event) => event.id === followed.id)
    expect(chosen).toHaveLength(DAILY_REPORTS_PER_SPORT + 1)
    expect(chosen[0]).toBe(followed)
  })
  it("interleaves groups in order", () => {
    expect(interleave(["a1", "a2", "a3", "b1", "c1"], (item) => item[0])).toEqual(["a1", "b1", "c1", "a2", "a3"])
  })
})

const t = { en: getDictionary("en"), fr: getDictionary("fr") }

describe("report wording per sport", () => {
  const body = (event: SportEvent, locale: "en" | "fr") => {
    const report = buildReport(event, locale, NOW.toISOString(), NOW)
    expect(report.status, report.withheldReason ?? "").toBe("validated")
    expect(isGrounded(report.body, event, locale)).toBe(true)
    return report
  }

  it("keeps the plain final score for ordinary team sports", () => {
    expect(body(game("1", "basketball", "NBA"), "en").body).toBe("Final score: Harbor City 2, Ridge United 1. NBA, November 4, 2026 (UTC).")
  })
  it("says how a game ended only when the feed does", () => {
    expect(body(game("1", "ice-hockey", "NHL", { conclusion: "shootout" }), "en").body).toContain("Ridge United 1 (after a shootout).")
    expect(body(game("1", "football", "CAF Champions League", { conclusion: "penalties" }), "fr").body).toContain("Ridge United 1 (aux tirs au but).")
  })
  it("counts sets in volleyball and lists the set points", () => {
    const event = game("1", "volleyball", "Polish PlusLiga", {
      score: { kind: "team", home: 3, away: 1 },
      breakdown: { segments: [[25, 20], [23, 25], [25, 17], [25, 19]].map(([home, away], index) => ({ kind: "set" as const, number: index + 1, home, away })) },
    })
    expect(body(event, "en").body).toBe("Final score in sets: Harbor City 3, Ridge United 1. Set scores: 25-20, 23-25, 25-17, 25-19. Polish PlusLiga, November 4, 2026 (UTC).")
    expect(body(event, "fr").body).toContain("Score final en sets : Harbor City 3, Ridge United 1. Détail des sets : 25-20")
  })
  it("leaves set points out when the feed has none", () => {
    expect(body(game("1", "volleyball", "Polish PlusLiga", { score: { kind: "team", home: 3, away: 0 } }), "en").body).toBe("Final score in sets: Harbor City 3, Ridge United 0. Polish PlusLiga, November 4, 2026 (UTC).")
  })

  const tennis = game("2", "tennis", "WTA Tour", {
    eventType: "match", participantType: "individual", participants: competitors("Rybakina", "Putintseva"), eventName: "Pan Pacific Open",
    score: { kind: "sets", lines: [{ name: "Putintseva", games: [2, 3] }, { name: "Rybakina", games: [6, 6] }], winner: "Rybakina", retired: null },
  })
  it("gives tennis the set scores, winner first, with the tournament", () => {
    expect(resultLine(tennis, t.en)).toBe("Rybakina won 6-2, 6-3")
    const en = body(tennis, "en")
    expect(en.title).toBe("Result: Rybakina v Putintseva")
    expect(en.body).toBe("Rybakina won 6-2, 6-3. WTA Tour, Pan Pacific Open, November 4, 2026 (UTC).")
    expect(body(tennis, "fr").body).toContain("Rybakina a gagné 6-2, 6-3.")
  })
  it("keeps a retirement's unfinished rows", () => {
    const retired = { ...tennis, score: { kind: "sets", lines: [{ name: "Rybakina", games: [5] }, { name: "Putintseva", games: [2] }], winner: null, retired: "Putintseva" } as EventScore }
    expect(resultLine(retired, t.en)).toBe("Putintseva retired: Rybakina 5, Putintseva 2")
  })
  it("gives cricket runs and wickets", () => {
    const event = game("3", "cricket", "Indian Premier League", {
      score: { kind: "innings", home: { runs: 166, wickets: 6, overs: "20" }, away: { runs: 170, wickets: 2, overs: "15.5" }, winner: "Ridge United", margin: { value: 8, unit: "wickets" } },
    })
    expect(body(event, "en").body).toBe("Ridge United won by 8 wickets: Harbor City 166/6, Ridge United 170/2. Indian Premier League, November 4, 2026 (UTC).")
    expect(body(event, "fr").body).toContain("Ridge United a gagné par 8")
  })
  it("gives motorsport a classification and never lists entrants in the title", () => {
    const event = game("4", "motorsport", "Formula 1", {
      eventType: "session", participantType: "entrant", participants: competitors("Ari Stone", "Ben Ash"), eventName: "São Paulo Grand Prix",
      score: { kind: "classification", entries: [{ position: 1, name: "Ari Stone", team: null, time: null }, { position: 2, name: "Ben Ash", team: null, time: null }] },
    })
    const en = body(event, "en")
    expect(en.title).toBe("Result: São Paulo Grand Prix")
    expect(en.body).toBe("Classification: 1. Ari Stone, 2. Ben Ash. Formula 1, November 4, 2026 (UTC).")
    expect(body(event, "fr").body).toContain("Classement : 1. Ari Stone")
  })
  it("gives a bout both fighters and the verified method", () => {
    const event = game("5", "combat-sports", "UFC", {
      eventType: "bout", participantType: "individual", participants: competitors("Moicano", "Nolan"), eventName: "UFC Fight Night 292",
      score: { kind: "combat", winner: "Moicano", method: "ko", round: 2, time: "1:23" },
    })
    const en = body(event, "en")
    expect(en.title).toBe("Result: Moicano v Nolan")
    expect(en.body).toBe("Moicano v Nolan: Moicano won, knockout, Round 2 (1:23). UFC Fight Night 292, November 4, 2026 (UTC).")
    expect(body(event, "fr").body).toContain("Moicano - Nolan : Moicano a gagné")
  })
  it("rejects a number no verified field states, in any sport", () => {
    const event = game("1", "volleyball", "Polish PlusLiga", { score: { kind: "team", home: 3, away: 1 } })
    expect(isGrounded("Final score in sets: Harbor City 3, Ridge United 1. Set scores: 25-20. Polish PlusLiga, November 4, 2026 (UTC).", event, "en")).toBe(false)
  })

  describe("previews", () => {
    const upcoming = (fields: Partial<SportEvent>) => ({ status: "scheduled" as const, score: { kind: "none" as const }, scheduledStartUTC: "2026-11-06T18:00:00.000Z", ...fields })
    it("sends a bout to its card and says who fights", () => {
      const event = game("6", "combat-sports", "UFC", upcoming({ eventType: "bout", participants: competitors("Moicano", "Nolan"), eventName: "UFC Fight Night 293" }))
      expect(buildPreview(event, "en", "t", NOW)).toMatchObject({ status: "validated", title: "Preview: Moicano v Nolan" })
      expect(buildPreview(event, "en", "t", NOW).body).toContain("Bout: Moicano v Nolan, UFC Fight Night 293.")
      expect(buildPreview(event, "fr", "t", NOW)).toMatchObject({ title: "Avant-combat : Moicano - Nolan" })
    })
    it("places a tennis match at its tournament", () => {
      const event = game("7", "tennis", "ATP World Tour", upcoming({ participants: competitors("Cobolli", "Berrettini"), eventName: "Vienna Open" }))
      expect(buildPreview(event, "en", "t", NOW).body).toContain("Cobolli and Berrettini meet at ATP World Tour, Vienna Open.")
    })
    it("calls a race an event, not a match", () => {
      const event = game("8", "motorsport", "Formula 1", upcoming({ eventType: "session", participants: [], eventName: "São Paulo Grand Prix" }))
      expect(buildPreview(event, "en", "t", NOW)).toMatchObject({ status: "validated", title: "Preview: São Paulo Grand Prix" })
      expect(buildPreview(event, "fr", "t", NOW).body).toContain("São Paulo Grand Prix est au programme de Formula 1.")
    })
  })
  it("writes no recap for a sport with no timeline", () => {
    const detail = { state: "empty", timeline: [], stats: [], lineups: { home: [], away: [] } } as unknown as Parameters<typeof buildRecap>[1]
    expect(buildRecap(game("9", "volleyball", "Polish PlusLiga"), detail, "en", "t", NOW)).toBeNull()
  })
})

describe("roundups", () => {
  const day = [...many(40, "football", "English Premier League"), ...many(2, "volleyball", "Polish PlusLiga"), ...many(2, "ice-hockey", "NHL")]

  it("gives every sport lines in the shared roundup, however busy football was", () => {
    const report = buildRoundup("2026-11-04", day, "en", "t", NOW)
    expect(report?.sportId).toBe("all")
    expect(report?.body).toContain("Polish PlusLiga: Harbor City 2, Ridge United 1 in sets.")
    expect(report?.body).toContain("NHL: Harbor City 2, Ridge United 1.")
  })
  it("writes one roundup for a sport, with its own address and sport name", () => {
    const report = buildRoundup("2026-11-04", day, "fr", "t", NOW, "ice-hockey")
    expect(report).toMatchObject({ slug: "roundup-2026-11-04-ice-hockey", sportId: "ice-hockey", title: "Le point du jour, Hockey sur glace : 4 novembre 2026" })
    expect(report?.body).not.toContain("English Premier League")
    expect(buildRoundup("2026-11-04", day, "en", "t", NOW, "tennis")).toBeNull()
  })
  it("stores the shared roundup and one per sport that played", async () => {
    const written: string[] = []
    const fake = {
      collection: () => ({ doc: (id: string) => ({ id }) }),
      runTransaction: async (run: (tx: unknown) => Promise<unknown>) => run({
        get: async () => ({ exists: false }),
        create: (ref: { id: string }) => written.push(ref.id),
      }),
    }
    await runRoundup(fake as never, day, "t", new Date("2026-11-05T07:00:00Z"))
    expect(written).toHaveLength(8)
    expect(written).toContain("roundup-2026-11-04-en")
    expect(written).toContain("roundup-2026-11-04-volleyball-fr")
  })
})

const report = (id: string, fields: Partial<Report>): Report => ({
  id, slug: id, matchId: id, sportId: "football", locale: "en", type: "result", status: "published", title: `Result ${id}`, body: "Body", participants: ["A", "B"], competition: "League",
  eventDateUTC: null, sources: [], promptVersion: "", sourceVersion: "", jobKey: "", withheldReason: null, correctionNote: null, editedAt: null,
  generatedAt: "", updatedAt: "", publishedAt: "2026-11-05T10:00:00.000Z", feedKey: "x", ...fields,
})

describe("news filters", () => {
  it("filters by type and combines with the other filters", () => {
    const rows = [report("a", { type: "preview", participants: ["Lakers", "Celtics"] }), report("b", { type: "recap", participants: ["Lakers", "Heat"] }), report("c", { type: "roundup", participants: [] })]
    expect(filterReports(rows, { type: "preview" }).map((item) => item.id)).toEqual(["a"])
    expect(filterReports(rows, { type: "recap", team: "Lakers" }).map((item) => item.id)).toEqual(["b"])
    expect(filterReports(rows, { type: "preview", team: "Heat" })).toEqual([])
  })
  it("builds its lists from real reports, leaving out everyone a roundup names", () => {
    const rows = [report("a", { participants: ["Zebras", "Ants"], competition: "NBA" }), report("b", { type: "roundup", participants: ["Nobody"], competition: "" })]
    expect(reportTeams(rows)).toEqual(["Ants", "Zebras"])
    expect(reportCompetitions(rows)).toEqual(["NBA"])
  })
  it("pages and settles a page outside the range on a real one", () => {
    const rows = Array.from({ length: 25 }, (_, index) => index)
    expect(pageOfReports(rows, 2)).toMatchObject({ page: 2, pages: 3, items: rows.slice(12, 24) })
    expect(pageOfReports(rows, 99)).toMatchObject({ page: 3, items: [24] })
    expect(pageOfReports(rows, Number.NaN)).toMatchObject({ page: 1 })
    expect(pageOfReports([], 1)).toEqual({ items: [], page: 1, pages: 1 })
  })
  it("has sports take turns inside a day, newest day first", () => {
    const rows = [
      report("old", { sportId: "tennis", publishedAt: "2026-11-04T10:00:00.000Z" }),
      report("f1", { publishedAt: "2026-11-05T12:00:00.000Z" }), report("f2", { publishedAt: "2026-11-05T11:00:00.000Z" }), report("f3", { publishedAt: "2026-11-05T10:00:00.000Z" }),
      report("v1", { sportId: "volleyball", publishedAt: "2026-11-05T09:00:00.000Z" }),
    ]
    expect(balanceBySport(rows).map((item) => item.id)).toEqual(["f1", "v1", "f2", "f3", "old"])
  })
  it("tells a sport's roundup from the shared one", () => {
    expect(isSportRoundup({ type: "roundup", sportId: "all" })).toBe(false)
    expect(isSportRoundup({ type: "roundup", sportId: "tennis" })).toBe(true)
    expect(isSportRoundup({ type: "result", sportId: "tennis" })).toBe(false)
  })
})

/** Answers the two query shapes the list uses, and fails on anything that would need a composite index. */
function fakeDb(rows: Report[]) {
  const query = (filters: [string, string, unknown][], order: string | null, max: number) => ({
    where: (field: string, op: string, value: unknown) => query([...filters, [field, op, value]], order, max),
    orderBy: (field: string) => query(filters, field, max),
    limit: (next: number) => query(filters, order, next),
    get: async () => {
      const ranged = new Set(filters.filter(([, op]) => op === ">=" || op === "<").map(([field]) => field))
      const equal = filters.some(([, op]) => op === "==" || op === "in")
      if ((ranged.size > 0 && equal) || (order && equal) || ranged.size > 1) throw new Error("needs a composite index")
      const value = (row: Report, field: string) => (row as unknown as Record<string, unknown>)[field]
      const found = rows.filter((row) => filters.every(([field, op, wanted]) => {
        const actual = value(row, field)
        if (op === "==") return actual === wanted
        if (op === "in") return (wanted as unknown[]).includes(actual)
        if (actual === undefined || actual === null) return false
        return op === ">=" ? String(actual) >= String(wanted) : String(actual) < String(wanted)
      }))
      const sorted = order ? found.sort((a, b) => String(value(b, order)).localeCompare(String(value(a, order)))) : found
      return { docs: sorted.slice(0, max).map((row) => ({ data: () => row })) }
    },
  })
  return { collection: () => query([], null, 1000) }
}

const stamped = (id: string, fields: Partial<Report>) => {
  const row = report(id, fields)
  return { ...row, feedKey: `en#${row.publishedAt}`, sportFeedKey: sportFeedKey(row, row.publishedAt as string) }
}

describe("news list", () => {
  const football = Array.from({ length: 320 }, (_, index) => stamped(`f${index}`, { publishedAt: `2026-11-05T10:${String(index % 60).padStart(2, "0")}:00.000Z` }))
  const volleyball = stamped("v", { sportId: "volleyball", publishedAt: "2026-10-20T10:00:00.000Z" })
  const tennisRoundup = stamped("r", { sportId: "tennis", type: "roundup", matchId: "r" })

  it("keeps a quiet sport in the all-sports list, past any shared limit", async () => {
    db.current = fakeDb([...football, volleyball])
    const { state, reports } = await listNewsReports("en", null, ["football", "volleyball"])
    expect(state).toBe("ok")
    expect(reports.map((item) => item.id)).toContain("v")
  })
  it("reads one sport by itself", async () => {
    db.current = fakeDb([...football, volleyball, stamped("draft", { sportId: "volleyball", status: "draft" })])
    const { reports } = await listNewsReports("en", "volleyball", ["football", "volleyball"])
    expect(reports.map((item) => item.id)).toEqual(["v"])
  })
  it("finds a report published before the sport key existed", async () => {
    const legacy = { ...report("old", { sportId: "rugby" }), sportFeedKey: undefined }
    db.current = fakeDb([legacy])
    expect((await listNewsReports("en", "rugby", ["rugby"])).reports.map((item) => item.id)).toEqual(["old"])
  })
  it("shows a sport's roundup under that sport, not in the all-sports list", async () => {
    db.current = fakeDb([tennisRoundup])
    expect((await listNewsReports("en", "tennis", ["tennis"])).reports).toHaveLength(1)
    expect((await listNewsReports("en", null, ["tennis"])).reports).toHaveLength(0)
  })
  it("reports storage trouble rather than an empty list", async () => {
    db.current = null
    expect(await listNewsReports("en", "tennis", ["tennis"])).toEqual({ state: "unavailable", reports: [] })
  })
})
