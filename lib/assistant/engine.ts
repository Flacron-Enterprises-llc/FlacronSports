// Deterministic and grounded: no model is called, so every answer comes from the
// sports feed or the curated reference. Anything else is admitted as unknown.

import { getDictionary, type Locale } from "@/lib/i18n"
import type { EventFeed, SportEvent, SportId } from "@/lib/sports/types"
import { REFERENCE, REFERENCE_REVIEWED_UTC, type ReferenceEntry } from "./reference"

export type AnswerKind = "fixtures" | "result" | "rule" | "no_data" | "unavailable" | "declined" | "unknown"

export interface AnswerItem {
  matchId: string
  title: string
  competition: string
  startUTC: string | null
  status: SportEvent["status"]
  score: string | null
}

export interface AssistantAnswer {
  kind: AnswerKind
  text: string
  items: AnswerItem[]
  notes: string[]
  sources: { label: string; url: string | null }[]
  asOfUTC: string | null
  /** False when nothing useful could be answered, so the request is given back. */
  charged: boolean
}

export interface AssistantSources {
  getEvents(options: { date?: string; sport?: SportId }): Promise<EventFeed>
  getTeamFixtures(name: string): Promise<{ team: { name: string } | null; recent: SportEvent[]; feed: Omit<EventFeed, "events"> }>
}

const MAX_ITEMS = 10
const RESULT_LOOKBACK_DAYS = 7

// "paris" alone is the city and "cote" is Cote d'Ivoire, so neither can mean betting here.
const PREDICTION = /\b(predict\w*|forecast\w*|odds|bet|bets|betting|wager|tips?|who(?:'ll| will) win|will \w+(?: \w+){0,3} win|pronosti\w*|paris sportifs?|pari|parier|qui (?:va gagner|gagnera)|va-t-(?:il|elle) gagner)\b/
const RESULT = /\b(results?|resultats?|latest|last|recent|score|scores|won|lost|beat|dernier|derniere|derniers|gagne|perdu)\b/
const FIXTURES = /\b(today|tonight|fixtures?|schedule|schedules|playing|plays|play|games?|matches|match|aujourd'hui|aujourd hui|ce soir|calendrier|programme|joue|jouent|rencontres?|matchs?)\b/
const RULE = /\b(rules?|regles?|explain|explique\w*|what is|what's|whats|what are|meaning|c'est quoi|qu'est-ce|definition)\b/
const STANDINGS = /\b(standings?|table|classement)\b/

const STOP_WORDS = new Set(
  `a an the of for in on at to is are was were do does did has have had will what whats when where which who how
   me my show tell give please s t get about with from vs and or
   today tonight fixtures fixture schedule schedules playing plays play game games matches match latest last recent
   result results score scores won lost beat team
   le la les l de du des d un une au aux en et ou a est sont que qui quel quelle quels quelles quand ou comment
   mon ma mes moi donne montre dis pour avec sur
   aujourd hui ce soir jour calendrier programme joue jouent rencontre rencontres matchs resultat resultats dernier derniere derniers gagne perdu equipe`
    .split(/\s+/)
    .filter(Boolean),
)

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

function topicOf(question: string): string {
  return question
    .split(/[\s']+/)
    .filter((word) => !STOP_WORDS.has(word))
    .join(" ")
}

function nameMatches(name: string, topic: string, question: string): boolean {
  const candidate = normalize(name)
  if (candidate.length < 3) return false
  return (topic.length >= 3 && candidate.includes(topic)) || ` ${question} `.includes(` ${candidate} `)
}

const teamMatches = (event: SportEvent, topic: string, question: string) =>
  event.participants.some((participant) => nameMatches(participant.name, topic, question))

const fixtureMatches = (event: SportEvent, topic: string, question: string) =>
  teamMatches(event, topic, question) || nameMatches(event.competition.name, topic, question)

function findReference(question: string): ReferenceEntry | null {
  const padded = ` ${question} `
  return REFERENCE.find((entry) => entry.terms.some((term) => padded.includes(` ${term} `))) ?? null
}

function toItem(event: SportEvent, withScore: boolean): AnswerItem {
  return {
    matchId: event.id,
    title: event.participants.map((participant) => participant.name).join(" / "),
    competition: event.competition.name,
    startUTC: event.scheduledStartUTC,
    status: event.status,
    score: withScore && event.score.kind === "team" ? `${event.score.home} - ${event.score.away}` : null,
  }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

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
  if (STANDINGS.test(question)) return refused("unknown", copy.noStandings)

  if (RESULT.test(question)) {
    if (topic.length < 3) return refused("unknown", copy.needTeam)
    const answerResult = (found: SportEvent, feed: Omit<EventFeed, "events">): AssistantAnswer => ({
      kind: "result",
      text: found.score.kind === "team" ? copy.resultFound : copy.resultNoScore,
      items: [toItem(found, true)],
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
      items: found.slice(0, MAX_ITEMS).map((event) => toItem(event, false)),
      notes: feedNotes(feed),
      ...feedSource(feed),
      charged: true,
    }
  }

  return reference ? rule(reference) : refused("unknown", copy.unknown)
}
