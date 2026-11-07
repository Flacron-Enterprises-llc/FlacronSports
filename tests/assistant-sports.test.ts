// Synthetic events only: the assistant reads the sport a question names.
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

import type { ModelClient, ModelMessage, ModelRequest } from "@/lib/assistant/anthropic-client"
import { answerQuestion, sportOf, topicOf, type AssistantSources } from "@/lib/assistant/engine"
import { DEFAULT_MODEL, answerWithModel, type ModelSources } from "@/lib/assistant/model"
import { REFERENCE } from "@/lib/assistant/reference"
import { suggestionsFor } from "@/lib/assistant/suggestions"
import { getDictionary, type Locale } from "@/lib/i18n"
import type { Standings } from "@/lib/sports/service"
import { SPORTS, type EventFeed, type SportEvent, type SportId } from "@/lib/sports/types"

const now = new Date("2026-11-07T12:00:00Z")
const event = (overrides: Partial<SportEvent> = {}) => ({
  id: "tsdb-1", sportId: "basketball", eventType: "match", participantType: "team",
  participants: [{ id: "1", name: "Los Angeles Lakers", role: "home", badgeUrl: null }, { id: "2", name: "Boston Celtics", role: "away", badgeUrl: null }],
  competition: { id: "4387", name: "NBA", country: "USA" },
  scheduledStartUTC: "2026-11-07T01:00:00.000Z", status: "finished", providerStatus: "FT", score: { kind: "team", home: 101, away: 99 }, venue: null,
  provider: { name: "TheSportsDB", eventId: "1" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
}) as SportEvent
const race = (overrides: Partial<SportEvent> = {}) => event({
  id: "tsdb-2", sportId: "motorsport", eventType: "session", participants: [], eventName: "Monaco Grand Prix",
  competition: { id: "4370", name: "Formula 1", country: null },
  score: { kind: "classification", entries: [{ position: 1, name: "Ann Lane", team: "Red", time: "1:30:00" }], standings: [{ position: 1, name: "Ann Lane", points: 120 }, { position: 2, name: "Bea Cole", points: 90 }] },
  ...overrides,
})
const card = event({ id: "tsdb-3", sportId: "combat-sports", eventType: "fight-card", eventName: "UFC 300", competition: { id: "4443", name: "UFC", country: null }, score: { kind: "combat", winner: "Los Angeles Lakers", method: "ko", round: 1, time: "1:00" } })

const feed = (events: SportEvent[], overrides: Partial<EventFeed> = {}): EventFeed => ({ state: "ok", events, source: "x", fetchedAt: now.toISOString(), limited: false, ...overrides })
const empty: Standings = { state: "empty", league: null, season: null, rows: [], source: "x", fetchedAt: now.toISOString(), sourceUpdatedAt: null, limited: false }

/** Filters by sport as the real feed does, and records what it was asked. */
function sources(events: SportEvent[]) {
  const asked = { events: [] as (SportId | undefined)[], teams: [] as [string, SportId | undefined][] }
  const data: AssistantSources = {
    getEvents: async ({ sport }) => {
      asked.events.push(sport)
      return feed(events.filter((item) => !sport || item.sportId === sport))
    },
    getTeamFixtures: async (name, sport) => {
      asked.teams.push([name, sport])
      return { team: null, recent: [], feed: feed([]) }
    },
    getStandings: async () => empty,
  }
  return { data, asked }
}
const ask = (question: string, events: SportEvent[] = [], locale: Locale = "en") => answerQuestion(question, locale, sources(events).data, now)
const noSources = { getEvents: async () => { throw new Error("A rule question must not reach the feed") }, getTeamFixtures: async () => { throw new Error("no") }, getStandings: async () => empty } as unknown as AssistantSources
const rule = (question: string, locale: Locale = "en") => answerQuestion(question, locale, noSources, now)
const entry = (id: string) => REFERENCE.find((item) => item.id === id)

describe("reading the sport", () => {
  it.each([
    ["lakers basketball", "basketball", "lakers"],
    ["today's american football fixtures", "american-football", ""],
    ["resultat rugby toulon", "rugby", "toulon"],
    ["f1 standings", "motorsport", "formula 1"],
    ["nba standings", "basketball", "nba"],
    ["lakers nba result", "basketball", "lakers"],
    ["ufc 300 result", "combat-sports", "ufc 300"],
    ["monaco grand prix result", "motorsport", "monaco grand prix"],
    ["arsenal latest result", null, "arsenal"],
    ["sport automobile en direct maintenant", "motorsport", ""],
  ])("%s", (question, sport, topic) => {
    expect(sportOf(question)).toBe(sport)
    expect(topicOf(question)).toBe(topic)
  })
})

describe("questions about a sport", () => {
  it("strips the sport word and passes the sport to every source", async () => {
    const { data, asked } = sources([event()])
    const answer = await answerQuestion("Lakers basketball latest result", "en", data, now)
    expect(answer).toMatchObject({ kind: "result", items: [{ matchId: "tsdb-1" }] })
    expect(asked.teams).toEqual([["lakers", "basketball"]])
    expect(asked.events).toEqual(["basketball"])
  })
  it("does not answer one sport's question with another's game", async () => {
    const answer = await ask("Lakers football result", [event()])
    expect(answer).toMatchObject({ kind: "no_data", items: [] })
  })
  it("finds a result by the event's own name", async () => {
    expect((await ask("Monaco Grand Prix result", [race()])).items[0]?.matchId).toBe("tsdb-2")
    expect((await ask("UFC 300 result", [card])).items[0]?.matchId).toBe("tsdb-3")
    expect((await ask("Monaco race winner", [race()])).kind).toBe("result")
  })
  it("recognises race, fight and tournament words", async () => {
    expect((await ask("Monaco race", [race({ status: "scheduled" })])).kind).toBe("fixtures")
    expect((await ask("UFC 300 fight", [card])).kind).toBe("fixtures")
    expect((await ask("Lakers session", [event()])).kind).toBe("fixtures")
    expect((await ask("next race")).text).toBe(getDictionary("en").assistant.needTeam)
  })
  it("answers every suggested sport chip in both languages", async () => {
    for (const sport of SPORTS) {
      for (const locale of ["en", "fr"] as Locale[]) {
        const game = event({ sportId: sport.id, status: "finished", participants: [{ id: "1", name: "Aaa", role: "home", badgeUrl: null }, { id: "2", name: "Bbb", role: "away", badgeUrl: null }], competition: { id: "1", name: "Zzz", country: null } })
        const copy = getDictionary(locale).assistant
        const name = sport.name[locale].toLowerCase()
        expect((await ask(copy.tipResults.replace("{sport}", name), [game], locale)).items).toHaveLength(1)
        expect((await ask(copy.tipFixtures.replace("{sport}", name), [game], locale)).kind).toBe("fixtures")
        expect((await ask(copy.tipLive.replace("{sport}", name), [{ ...game, status: "live" }], locale)).kind).toBe("live")
      }
    }
    expect(suggestionsFor({ favorites: [], leagues: [{ sportId: "tennis" }], players: [] } as never, "en", getDictionary("en"))[0]).toBe("Today's tennis fixtures")
  })
  it("still says what it needs when the wording says nothing", async () => {
    expect(getDictionary("en").assistant.noResult).not.toMatch(/team/)
    expect(getDictionary("fr").assistant.needTeam).toMatch(/athlète/)
    expect((await ask("Barcelona last result", [])).text).toContain("finished event")
  })
})

describe("racing's championship", () => {
  const dated = (date: string) => ({ scheduledStartUTC: `${date}T14:00:00.000Z` })
  it("reads the table from the latest classified event of that series", async () => {
    const moto = race({ id: "tsdb-9", competition: { id: "4407", name: "MotoGP", country: null }, ...dated("2026-11-06") })
    const answer = await ask("F1 standings", [moto, race(dated("2026-11-05"))])
    expect(answer).toMatchObject({ kind: "standings", charged: true, items: [{ matchId: "tsdb-2" }] })
    expect(answer.table).toMatchObject({ league: "Formula 1", calculated: false, total: 2 })
    expect(answer.table?.rows[0]).toMatchObject({ rank: 1, team: "Ann Lane", points: 120, played: null })
  })
  it("takes a series or a driver by name, and looks back past a gap between races", async () => {
    let calls = 0
    const data: AssistantSources = { ...sources([]).data, getEvents: async () => feed(++calls === 20 ? [race()] : []) }
    expect((await answerQuestion("Formula 1 drivers championship", "en", data, now)).kind).toBe("standings")
    const table = (await ask("Bea Cole F1 standings", [race()])).table
    expect(table?.rows.find((row) => row.team === "Bea Cole")?.asked).toBe(true)
  })
  it("admits an event with no printed championship, and an outage", async () => {
    const plain = race({ score: { kind: "classification", entries: [{ position: 1, name: "Ann Lane", team: null, time: null }] } })
    const missing = await ask("F1 standings", [plain])
    expect(missing).toMatchObject({ kind: "no_data", charged: true })
    expect(missing.table).toBeUndefined()
    const down: AssistantSources = { ...sources([]).data, getEvents: async () => feed([], { state: "unavailable" }) }
    expect(await answerQuestion("F1 standings", "en", down, now)).toMatchObject({ kind: "unavailable", charged: false })
  })
  it("leaves other sports asking for a competition", async () => {
    expect((await ask("basketball standings")).text).toBe(getDictionary("en").assistant.needTeam)
  })
})

describe("rule notes and the sport they cover", () => {
  it.each([
    ["What is overtime in hockey?", "hockey-shootout"],
    ["overtime in ice hockey", "hockey-shootout"],
    ["What is overtime?", "overtime"],
    ["What is overtime in football?", "extra-time"],
    ["What is offside in hockey?", "hockey-offside"],
    ["What is offside?", "offside"],
    ["What is a yellow card in football?", "cards"],
    ["What is a power play in cricket?", "cricket-powerplay"],
    ["How many innings are in baseball?", "baseball-innings"],
    ["What is a sprint in F1?", "motorsport-sprint"],
    ["What is a try in rugby?", "rugby-try"],
    ["What is a set in volleyball?", "volleyball-set"],
    ["What is a penalty shootout?", "extra-time"],
  ])("%s", async (question, id) => {
    expect(await rule(question)).toMatchObject({ kind: "rule", text: entry(id)?.en })
  })
  it("declines a term whose note covers another sport, and does not charge", async () => {
    for (const question of ["yellow card in rugby", "What is a yellow card in rugby?", "penalty in hockey", "What is a touchdown in rugby?"]) {
      const answer = await rule(question)
      expect(answer).toMatchObject({ kind: "no_data", charged: false, sources: [] })
      expect(answer.text).toMatch(/no reviewed rule note/)
    }
    expect((await rule("Qu'est-ce qu'un carton jaune au rugby ?", "fr")).text).toContain("(rugby)")
  })
  it("gives every entry the sport of its rulebook", () => {
    expect(REFERENCE.every((item) => SPORTS.some((sport) => sport.id === item.sport))).toBe(true)
    expect(entry("cricket-lbw")?.sport).toBe("cricket")
    expect(entry("cards")?.sport).toBe("football")
  })
})

describe("the model's lookups", () => {
  const call = (name: string, input: unknown): ModelMessage => ({ role: "assistant", content: [{ type: "tool_use", id: `call-${name}`, name, input }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } })
  const give = (kind: string, answer: string, league: string | null = null) => call("give_answer", { kind, answer, forecast: null, match_refs: [], league_ref: league })
  function scripted(...steps: ModelMessage[]) {
    const requests: ModelRequest[] = []
    const client: ModelClient = {
      messages: {
        create: async (request) => {
          requests.push(structuredClone(request))
          return steps.shift() as ModelMessage
        },
      },
    }
    return { client, requests }
  }
  const data = (overrides: Partial<ModelSources> = {}): ModelSources => ({
    getEvents: async () => feed([event()]),
    getTeamFixtures: async () => ({ team: { name: "Los Angeles Lakers", league: { id: "4387", name: "NBA" } }, recent: [], upcoming: [], feed: feed([]) }),
    getStandings: async () => empty,
    getMatchDetail: async () => ({ state: "empty", timeline: [], stats: [], lineups: { home: [], away: [] }, fetchedAt: now.toISOString() }),
    searchTeams: async () => [],
    ...overrides,
  })
  const run = (client: ModelClient, question: string, from = data()) => answerWithModel({ client, question, locale: "en", sources: from, now, spoiler: false, model: DEFAULT_MODEL })
  const lastResult = (requests: ModelRequest[]) => JSON.stringify(requests.at(-1)?.messages.at(-1))

  it("flags a calculated table with its unit, percentages and overtime losses", async () => {
    const table: Standings = {
      ...empty, state: "ok", league: "NBA",
      calculated: { games: 40, latestGame: "2026-11-06T00:00:00.000Z", unit: "points", stale: false },
      rows: [{ rank: 1, team: "Los Angeles Lakers", played: 10, won: 8, drawn: 0, lost: 2, scoredFor: null, scoredAgainst: null, difference: null, points: null, form: null, zone: null, winPercent: 0.8, overtimeLosses: 1 }],
    }
    const { client, requests } = scripted(call("get_team_fixtures", { team: "Lakers", sport: "basketball" }), call("get_standings", { league_ref: "l1" }), give("standings", "A table calculated from results has the Lakers first.", "l1"))
    const answer = await run(client, "Lakers standings", data({ getStandings: async () => table }))
    const seen = lastResult(requests)
    for (const text of ['\\"calculated\\":true', '\\"unit\\":\\"points\\"', '\\"win_percent\\":0.8', '\\"overtime_losses\\":1']) expect(seen).toContain(text)
    expect(answer.table?.calculated).toBe(true)
    expect(JSON.stringify(requests[0].system)).toMatch(/never call it the official table/)
  })
  it("marks an official table as nothing of the kind", async () => {
    const table: Standings = { ...empty, state: "ok", league: "NBA", rows: [{ rank: 1, team: "Los Angeles Lakers", played: 10, won: 8, drawn: 0, lost: 2, scoredFor: 1, scoredAgainst: 1, difference: 0, points: 16, form: null, zone: null }] }
    const { client, requests } = scripted(call("get_team_fixtures", { team: "Lakers", sport: null }), call("get_standings", { league_ref: "l1" }), give("standings", "The Lakers are first.", "l1"))
    await run(client, "Lakers standings", data({ getStandings: async () => table }))
    expect(lastResult(requests)).not.toContain("calculated")
  })
  it("searches names within a sport, and steers athletes to the daily events", async () => {
    const seen: (SportId | undefined)[] = []
    const { client, requests } = scripted(call("search_teams", { text: "Sinner", sport: "tennis" }), give("no_data", "Our data holds nothing on that."))
    await run(client, "Sinner", data({ searchTeams: async (_text, sport) => { seen.push(sport); return [{ name: "Jannik Sinner", sportId: "tennis" }] } }))
    expect(seen).toEqual(["tennis"])
    const tools = requests[0].tools as { name: string; description: string }[]
    expect(tools.find((item) => item.name === "get_team_fixtures")?.description).toMatch(/Teams only/)
    expect(tools.find((item) => item.name === "get_team_fixtures")?.description).not.toMatch(/athlete's/)
    expect(tools.find((item) => item.name === "search_teams")?.description).toMatch(/tennis, combat-sports or motorsport/)
  })
  it("gives the rule for the sport asked about, or none", async () => {
    const hockey = scripted(call("get_rule_reference", { topic: "overtime", sport: "ice-hockey" }), give("rule", "Overtime is 5 minutes of three-on-three."))
    await run(hockey.client, "What is overtime in hockey?")
    expect(lastResult(hockey.requests)).toContain("hockey-shootout")
    expect(lastResult(hockey.requests)).not.toContain("\\\"overtime\\\"")
    const named = scripted(call("get_rule_reference", { topic: "yellow card in rugby", sport: null }), give("no_data", "I have no reviewed note on that."))
    await run(named.client, "yellow card in rugby")
    expect(lastResult(named.requests)).toContain('\\"found\\":false')
    const given = scripted(call("get_rule_reference", { topic: "yellow card", sport: "rugby" }), give("no_data", "I have no reviewed note on that."))
    await run(given.client, "yellow card in rugby")
    expect(lastResult(given.requests)).toContain('\\"found\\":false')
    const football = scripted(call("get_rule_reference", { topic: "yellow card", sport: null }), give("rule", "A yellow card is a caution."))
    expect((await run(football.client, "yellow card")).sources[0]?.label).toBe(entry("cards")?.source.label)
  })
})
