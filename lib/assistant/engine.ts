// Deterministic and grounded: no model is called here, so every answer comes from the
// sports feed or the curated reference. Anything else is admitted as unknown. This is
// also what answers when the model layer in model.ts is off or fails.

import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n"
import { eventTitle, hasResult, resultLine } from "@/lib/sports/presentation"
import type { Standings } from "@/lib/sports/service"
import type { EventFeed, SportEvent, SportId } from "@/lib/sports/types"
import { REFERENCE, REFERENCE_REVIEWED_UTC, type ReferenceEntry } from "./reference"

export type AnswerKind = "fixtures" | "result" | "live" | "standings" | "rule" | "no_data" | "unavailable" | "declined" | "unknown"

export interface AnswerItem {
  matchId: string
  title: string
  competition: string
  startUTC: string | null
  status: SportEvent["status"]
  score: string | null
}

/** Rows the source left blank stay null, and are shown as missing rather than zero. */
export interface AnswerTable {
  leagueId: string
  league: string
  season: string | null
  /** Worked out from results, not the league's official table. */
  calculated?: boolean
  rows: { rank: number | null; team: string; played: number | null; points: number | null; record?: string | null; asked: boolean }[]
  /** How many teams the full table holds, when this shows only part of it. */
  total: number
}

export interface AssistantAnswer {
  kind: AnswerKind
  text: string
  /** Kept apart from the facts in `text`, and always shown as a forecast. */
  forecast?: string
  items: AnswerItem[]
  table?: AnswerTable
  notes: string[]
  sources: { label: string; url: string | null }[]
  asOfUTC: string | null
  /** The text itself states a result, so spoiler mode hides it until revealed. */
  revealsResult?: boolean
  /** False when nothing useful could be answered, so the request is given back. */
  charged: boolean
}

export interface AssistantSources {
  getEvents(options: { date?: string; sport?: SportId }): Promise<EventFeed>
  getTeamFixtures(name: string): Promise<{ team: { name: string } | null; recent: SportEvent[]; upcoming?: SportEvent[]; feed: Omit<EventFeed, "events"> }>
  getStandings(leagueId: string): Promise<Standings>
}

const MAX_ITEMS = 10
const RESULT_LOOKBACK_DAYS = 7
const TABLE_ROWS = 10
const MAX_TABLES_TRIED = 3

// "paris" alone is the city and "cote" is Cote d'Ivoire, so neither can mean betting here.
const PREDICTION = /\b(predict\w*|forecast\w*|odds|bet|bets|betting|wager|tips?|chances?|favou?rites? to|guarantee\w*|who(?:'ll| will|'s going to| is going to) (?:win|finish|go down)|going to (?:win|lose)|will \w+(?: \w+){0,3} (?:win|lose|finish|qualify)|pronosti\w*|paris sportifs?|pari|parier|garanti\w*|favoris? pour|qui (?:va gagner|gagnera)|va-t-(?:il|elle) (?:gagner|perdre))\b/
const LIVE = /\b(live|right now|on now|playing now|en direct|en ce moment|actuellement)\b/
const RESULT = /\b(results?|resultats?|latest|last|recent|score|scores|won|lost|beat|dernier|derniere|derniers|gagne|perdu)\b/
const FIXTURES = /\b(today|tonight|fixtures?|schedule|schedules|playing|plays|play|games?|matches|match|aujourd'hui|aujourd hui|ce soir|calendrier|programme|joue|jouent|rencontres?|matchs?)\b/
const RULE = /\b(rules?|regles?|explain|explique\w*|what is|what's|whats|what are|meaning|c'est quoi|qu'est-ce|definition)\b/
const STANDINGS = /\b(standings?|table|league position|classement|classe)\b/

const STOP_WORDS = new Set(
  `a an the of for in on at to is are was were do does did has have had will what whats when where which who how
   me my show tell give please s t get about with from vs and or
   today tonight fixtures fixture schedule schedules playing plays play game games matches match latest last recent
   result results score scores won lost beat team standing standings table position rank live now right currently
   le la les l de du des d un une au aux en et ou a est sont que qui quel quelle quels quelles quand ou comment
   mon ma mes moi donne montre dis pour avec sur
   aujourd hui ce soir jour calendrier programme joue jouent rencontre rencontres matchs resultat resultats dernier derniere derniers gagne perdu equipe
   classement classe direct moment actuellement`
    .split(/\s+/)
    .filter(Boolean),
)

const DIRECT_RESULT = /\b(did \w+(?: \w+){0,3} (?:win|lose|draw)|who (?:won|lost)|final score|qui a (?:gagne|perdu)|a-t-(?:il|elle) (?:gagne|perdu))\b/

/** Whether a normalized question asks for a result outright, which spoiler mode then allows. */
export const asksForResult = (question: string) => RESULT.test(question) || LIVE.test(question) || STANDINGS.test(question) || DIRECT_RESULT.test(question)

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[?!.,;:()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function topicOf(question: string): string {
  return question
    .split(/[\s']+/)
    .filter((word) => !STOP_WORDS.has(word))
    .join(" ")
}

export function nameMatches(name: string, topic: string, question: string): boolean {
  const candidate = normalize(name)
  if (candidate.length < 3) return false
  return (topic.length >= 3 && candidate.includes(topic)) || ` ${question} `.includes(` ${candidate} `)
}

const teamMatches = (event: SportEvent, topic: string, question: string) =>
  event.participants.some((participant) => nameMatches(participant.name, topic, question))

const fixtureMatches = (event: SportEvent, topic: string, question: string) =>
  teamMatches(event, topic, question) ||
  nameMatches(event.competition.name, topic, question) ||
  Boolean(event.eventName && nameMatches(event.eventName, topic, question))

function findReference(question: string): ReferenceEntry | null {
  const padded = ` ${question} `
  return REFERENCE.find((entry) => entry.terms.some((term) => padded.includes(` ${term} `))) ?? null
}

export function toItem(event: SportEvent, withScore: boolean, t: Dictionary): AnswerItem {
  return {
    matchId: event.id,
    title: eventTitle(event),
    competition: event.competition.name,
    startUTC: event.scheduledStartUTC,
    status: event.status,
    score: withScore ? resultLine(event, t) : null,
  }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

/** The top of the table, plus the row asked about when it sits lower down. */
export function tableView(leagueId: string, standings: Standings, asked: (team: string) => boolean): AnswerTable {
  const top = standings.rows.slice(0, TABLE_ROWS)
  const extra = standings.rows.slice(TABLE_ROWS).filter((row) => asked(row.team))
  return {
    leagueId,
    league: standings.league ?? "",
    season: standings.season,
    total: standings.rows.length,
    calculated: Boolean(standings.calculated),
    rows: [...top, ...extra].map(({ rank, team, played, points, won, lost }) => ({ rank, team, played, points, record: won === null || lost === null ? null : `${won}-${lost}`, asked: asked(team) })),
  }
}

const competitionsIn = (events: SportEvent[]) => events.flatMap((event) => (event.competition.id ? [event.competition.id] : []))

export async function answerQuestion(raw: string, locale: Locale, sources: AssistantSources, now: Date): Promise<AssistantAnswer> {
  const t = getDictionary(locale)
  const copy = t.assistant
  const question = normalize(raw)
  const topic = topicOf(question)

  const empty = { items: [], notes: [], sources: [], asOfUTC: null }
  const refused = (kind: AnswerKind, text: string): AssistantAnswer => ({ ...empty, kind, text, charged: false })
  const feedNotes = (feed: Omit<EventFeed, "events">) => [...(feed.limited ? [t.feed.limited] : []), ...(feed.state === "stale" ? [t.feed.stale] : [])]
  const feedSource = (feed: Omit<EventFeed, "events">) => ({ sources: [{ label: t.reports.verifiedData, url: null }], asOfUTC: feed.fetchedAt })

  if (PREDICTION.test(question)) return refused("declined", copy.declined)

  const reference = findReference(question)
  const rule = (entry: ReferenceEntry): AssistantAnswer => ({
    ...empty,
    kind: "rule",
    text: entry[locale],
    notes: [copy.ruleNote],
    sources: [{ label: entry.source.label, url: entry.source.url }],
    asOfUTC: REFERENCE_REVIEWED_UTC,
    charged: true,
  })
  if (reference && RULE.test(question)) return rule(reference)

  if (STANDINGS.test(question)) {
    if (topic.length < 3) return refused("unknown", copy.needTeam)
    const asked = (team: string) => nameMatches(team, topic, question)
    const team = await sources.getTeamFixtures(topic).catch(() => null)
    const candidates = team?.team ? competitionsIn([...team.recent, ...(team.upcoming ?? [])]) : []
    let lastFeed: EventFeed | null = null
    for (let day = 0; candidates.length === 0 && day < RESULT_LOOKBACK_DAYS; day += 1) {
      const feed = await sources.getEvents({ date: new Date(now.getTime() - day * 86_400_000).toISOString().slice(0, 10) })
      if (feed.state === "unavailable") continue
      lastFeed = feed
      candidates.push(...competitionsIn(feed.events.filter((event) => fixtureMatches(event, topic, question))))
    }
    if (candidates.length === 0) {
      if (!lastFeed && !team?.team) return refused("unavailable", copy.unavailable)
      return { ...empty, kind: "no_data", text: copy.noStandingsFound, ...(lastFeed ? feedSource(lastFeed) : {}), charged: true }
    }

    // A team's latest game can be a cup with no table, so each competition gets a turn.
    let unavailable = false
    let found: { id: string; standings: Standings } | null = null
    for (const id of [...new Set(candidates)].slice(0, MAX_TABLES_TRIED)) {
      const standings = await sources.getStandings(id)
      if (standings.state === "unavailable") unavailable = true
      if (standings.state !== "ok" || !standings.rows.length) continue
      found ??= { id, standings }
      if (standings.rows.some((row) => asked(row.team))) {
        found = { id, standings }
        break
      }
    }
    if (!found) return unavailable ? refused("unavailable", copy.unavailable) : { ...empty, kind: "no_data", text: copy.noStandingsFound, charged: true }

    const { id, standings } = found
    return {
      ...empty,
      kind: "standings",
      text: fill(copy.standingsFound, { league: standings.league ?? "" }),
      table: tableView(id, standings, asked),
      notes: [...(standings.limited ? [t.standings.limited] : []), copy.factsNote],
      sources: [{ label: t.reports.verifiedData, url: null }],
      asOfUTC: standings.sourceUpdatedAt ?? standings.fetchedAt,
      charged: true,
    }
  }

  // Before results: "Arsenal live score" must not answer with their last finished game.
  if (LIVE.test(question)) {
    const feed = await sources.getEvents({ date: now.toISOString().slice(0, 10) })
    if (feed.state === "unavailable") return refused("unavailable", copy.unavailable)
    // A stale feed may still say live about a game that ended, and that must not be repeated.
    if (feed.state === "stale") return { ...empty, kind: "no_data", text: copy.liveStale, notes: feedNotes(feed), ...feedSource(feed), charged: true }
    const live = feed.events.filter((event) => event.status === "live" && (topic.length < 3 || fixtureMatches(event, topic, question)))
    if (live.length === 0) return { ...empty, kind: "no_data", text: copy.noLive, notes: feedNotes(feed), ...feedSource(feed), charged: true }
    return {
      kind: "live",
      text: fill(copy.liveFound, { count: live.length }),
      items: live.slice(0, MAX_ITEMS).map((event) => toItem(event, true, t)),
      notes: feedNotes(feed),
      ...feedSource(feed),
      charged: true,
    }
  }

  if (RESULT.test(question)) {
    if (topic.length < 3) return refused("unknown", copy.needTeam)
    const answerResult = (found: SportEvent, feed: Omit<EventFeed, "events">): AssistantAnswer => ({
      kind: "result",
      text: hasResult(found) ? copy.resultFound : copy.resultNoScore,
      items: [toItem(found, true, t)],
      notes: feedNotes(feed),
      ...feedSource(feed),
      charged: true,
    })
    const latest = (events: SportEvent[]) =>
      events.filter((event) => event.status === "finished").sort((a, b) => (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? ""))[0]

    // The team lookup needs the provider's exact name, so a partial name falls through to the daily feeds.
    const team = await sources.getTeamFixtures(topic).catch(() => null)
    const direct = team?.team ? latest(team.recent) : undefined
    if (team && direct) return answerResult(direct, team.feed)

    let lastFeed: EventFeed | null = null
    for (let day = 0; day < RESULT_LOOKBACK_DAYS; day += 1) {
      const date = new Date(now.getTime() - day * 86_400_000).toISOString().slice(0, 10)
      const feed = await sources.getEvents({ date })
      if (feed.state === "unavailable") continue
      lastFeed = feed
      const found = latest(feed.events.filter((event) => teamMatches(event, topic, question)))
      if (found) return answerResult(found, feed)
    }
    if (!lastFeed) return refused("unavailable", copy.unavailable)
    return { ...empty, kind: "no_data", text: fill(copy.noResult, { days: RESULT_LOOKBACK_DAYS }), notes: feedNotes(lastFeed), ...feedSource(lastFeed), charged: true }
  }

  if (FIXTURES.test(question)) {
    if (topic.length < 3) return refused("unknown", copy.needTeam)
    const feed = await sources.getEvents({ date: now.toISOString().slice(0, 10) })
    if (feed.state === "unavailable") return refused("unavailable", copy.unavailable)
    const found = feed.events.filter((event) => fixtureMatches(event, topic, question))
    if (found.length === 0) return { ...empty, kind: "no_data", text: copy.noFixtures, notes: feedNotes(feed), ...feedSource(feed), charged: true }
    return {
      kind: "fixtures",
      text: fill(copy.fixturesFound, { count: found.length }),
      items: found.slice(0, MAX_ITEMS).map((event) => toItem(event, false, t)),
      notes: feedNotes(feed),
      ...feedSource(feed),
      charged: true,
    }
  }

  return reference ? rule(reference) : refused("unknown", copy.unknown)
}
