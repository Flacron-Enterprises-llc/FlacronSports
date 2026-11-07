// Deterministic and grounded: no model is called here, so every answer comes from the
// sports feed or the curated reference. Anything else is admitted as unknown. This is
// also what answers when the model layer in model.ts is off or fails.

import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n"
import { eventTitle, hasResult, resultLine } from "@/lib/sports/presentation"
import type { StandingRow, Standings } from "@/lib/sports/service"
import { SPORTS, type EventFeed, type SportEvent, type SportId } from "@/lib/sports/types"
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
  /** A championship read from a race, which has a season page rather than a table page. */
  racing?: boolean
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
  getTeamFixtures(name: string, sport?: SportId): Promise<{ team: { name: string } | null; recent: SportEvent[]; upcoming?: SportEvent[]; feed: Omit<EventFeed, "events"> }>
  getStandings(leagueId: string): Promise<Standings>
}

const MAX_ITEMS = 10
const RESULT_LOOKBACK_DAYS = 7
const TABLE_ROWS = 10
const MAX_TABLES_TRIED = 3
// Races can sit weeks apart, so a championship is looked for further back than a result.
const CHAMPIONSHIP_LOOKBACK_DAYS = 31

// "paris" alone is the city and "cote" is Cote d'Ivoire, so neither can mean betting here.
const PREDICTION = /\b(predict\w*|forecast\w*|odds|bet|bets|betting|wager|tips?|chances?|favou?rites? to|guarantee\w*|who(?:'ll| will|'s going to| is going to) (?:win|finish|go down)|going to (?:win|lose)|will \w+(?: \w+){0,3} (?:win|lose|finish|qualify)|pronosti\w*|paris sportifs?|pari|parier|garanti\w*|favoris? pour|qui (?:va gagner|gagnera)|va-t-(?:il|elle) (?:gagner|perdre))\b/
const LIVE = /\b(live|right now|on now|playing now|en direct|en ce moment|actuellement)\b/
const RESULT = /\b(results?|resultats?|latest|last|recent|score|scores|won|lost|beat|winners?|dernier|derniere|derniers|gagne|perdu|vainqueur|gagnant)\b/
const FIXTURES = /\b(today|tonight|fixtures?|schedule|schedules|playing|plays|play|games?|matches|match|races?|fights?|bouts?|tournaments?|sessions?|qualifying|practice|grand prix|aujourd'hui|aujourd hui|ce soir|calendrier|programme|joue|jouent|rencontres?|matchs?|courses?|combats?|tournois?|seances?|qualifications|essais libres)\b/
const RULE = /\b(rules?|regles?|explain|explique\w*|what is|what's|whats|what are|meaning|c'est quoi|qu'est-ce|definition)\b/
const STANDINGS = /\b(standings?|table|league position|drivers? championship|classement|classe|championnat des pilotes)\b/

const STOP_WORDS = new Set(
  `a an the of for in on at to is are was were do does did has have had will what whats when where which who how
   me my show tell give please s t get about with from vs and or
   today tonight fixtures fixture schedule schedules playing plays play game games matches match latest last recent
   result results score scores won lost beat team standing standings table position rank live now right currently
   le la les l de du des d un une au aux en et ou a est sont que qui quel quelle quels quelles quand ou comment
   mon ma mes moi donne montre dis pour avec sur
   aujourd hui ce soir jour calendrier programme joue jouent rencontre rencontres matchs resultat resultats dernier derniere derniers gagne perdu equipe
   classement classe direct moment actuellement maintenant
   next prochain prochaine prochains prochaines winner winners vainqueur gagnant
   race races fight fights bout bouts tournament tournaments session sessions qualifying practice driver drivers
   course courses combat combats tournoi tournois seance seances qualifications essais libres pilote pilotes`
    .split(/\s+/)
    .filter(Boolean),
)

/**
 * The words that name a sport, longest first within each, so "american football" is not read
 * as football. `series` is a name that also stands for a competition, kept as the topic when
 * nothing else was asked: "F1 standings" means Formula 1, not every racing series. `keep`
 * marks words that say the sport but are part of an event's own name.
 */
const SPORT_TERMS: { term: string; sport: SportId; series?: string; keep?: boolean }[] = [
  { term: "american football", sport: "american-football" },
  { term: "football americain", sport: "american-football" },
  { term: "nfl", sport: "american-football", series: "nfl" },
  { term: "hockey sur glace", sport: "ice-hockey" },
  { term: "ice hockey", sport: "ice-hockey" },
  { term: "hockey", sport: "ice-hockey" },
  { term: "nhl", sport: "ice-hockey", series: "nhl" },
  { term: "basketball", sport: "basketball" },
  { term: "basket", sport: "basketball" },
  { term: "wnba", sport: "basketball", series: "wnba" },
  { term: "nba", sport: "basketball", series: "nba" },
  { term: "football", sport: "football" },
  { term: "soccer", sport: "football" },
  { term: "foot", sport: "football" },
  { term: "baseball", sport: "baseball" },
  { term: "mlb", sport: "baseball", series: "mlb" },
  { term: "tennis", sport: "tennis" },
  { term: "atp", sport: "tennis", series: "atp" },
  { term: "wta", sport: "tennis", series: "wta" },
  { term: "cricket", sport: "cricket" },
  { term: "rugby", sport: "rugby" },
  { term: "volley-ball", sport: "volleyball" },
  { term: "volleyball", sport: "volleyball" },
  { term: "volley", sport: "volleyball" },
  { term: "mixed martial arts", sport: "combat-sports" },
  { term: "arts martiaux mixtes", sport: "combat-sports" },
  { term: "sports de combat", sport: "combat-sports" },
  { term: "combat sports", sport: "combat-sports" },
  { term: "boxing", sport: "combat-sports" },
  { term: "boxe", sport: "combat-sports" },
  { term: "mma", sport: "combat-sports" },
  { term: "ufc", sport: "combat-sports", series: "ufc" },
  { term: "sport automobile", sport: "motorsport" },
  { term: "motor racing", sport: "motorsport" },
  { term: "motorsports", sport: "motorsport" },
  { term: "motorsport", sport: "motorsport" },
  { term: "drivers championship", sport: "motorsport" },
  { term: "driver championship", sport: "motorsport" },
  { term: "championnat des pilotes", sport: "motorsport" },
  { term: "formula one", sport: "motorsport", series: "formula 1" },
  { term: "formula 1", sport: "motorsport", series: "formula 1" },
  { term: "formule 1", sport: "motorsport", series: "formula 1" },
  { term: "f1", sport: "motorsport", series: "formula 1" },
  { term: "formula 2", sport: "motorsport", series: "formula 2" },
  { term: "f2", sport: "motorsport", series: "formula 2" },
  { term: "formula e", sport: "motorsport", series: "formula e" },
  { term: "motogp", sport: "motorsport", series: "motogp" },
  { term: "indycar", sport: "motorsport", series: "indycar" },
  { term: "nascar", sport: "motorsport", series: "nascar" },
  { term: "wec", sport: "motorsport", series: "wec" },
  { term: "grand prix", sport: "motorsport", keep: true },
]

function readSport(question: string): { sport: SportId | null; rest: string; series: string } {
  let rest = ` ${question.replace(/'/g, " ")} `
  let sport: SportId | null = null
  let series = ""
  for (const item of SPORT_TERMS) {
    if (!rest.includes(` ${item.term} `)) continue
    sport ??= item.sport
    series ||= item.series ?? ""
    if (!item.keep) rest = rest.split(` ${item.term} `).join(" ")
  }
  return { sport, rest: rest.trim(), series }
}

/** The sport a normalized question names, if any. */
export const sportOf = (question: string) => readSport(question).sport

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

/** What was asked about, without the sport: "lakers basketball" is the Lakers. */
export function topicOf(question: string): string {
  const { rest, series } = readSport(question)
  const topic = rest
    .split(/[\s']+/)
    .filter((word) => !STOP_WORDS.has(word))
    .join(" ")
  // "UFC 300" is an event, so a number left on its own goes back with its series.
  return series && !/[a-z]{3}/.test(topic) ? [series, topic].filter(Boolean).join(" ") : topic
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

/** Whether a normalized question uses one of a rule note's terms. */
export function namesEntry(entry: ReferenceEntry, question: string): boolean {
  const padded = ` ${question} `
  return entry.terms.some((term) => padded.includes(` ${term} `))
}

const latest = (events: SportEvent[]) => [...events].sort((a, b) => (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? ""))

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
export function tableView(
  leagueId: string,
  standings: Pick<Standings, "league" | "season" | "calculated"> & { rows: Pick<StandingRow, "rank" | "team" | "played" | "points" | "won" | "lost">[] },
  asked: (team: string) => boolean,
): AnswerTable {
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

/** The championship as printed after a session, which racing has in place of a league table. */
const championshipOf = (event: SportEvent) => (event.status === "finished" && event.score.kind === "classification" ? event.score.standings ?? [] : [])

export async function answerQuestion(raw: string, locale: Locale, sources: AssistantSources, now: Date): Promise<AssistantAnswer> {
  const t = getDictionary(locale)
  const copy = t.assistant
  const question = normalize(raw)
  const sport = sportOf(question) ?? undefined
  const topic = topicOf(question)
  // A sport alone is enough to list its events: "latest basketball results".
  const unnamed = topic.length < 3
  const wanted = (event: SportEvent) => unnamed || fixtureMatches(event, topic, question)
  const dayFeed = (daysAgo: number) => sources.getEvents({ date: new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10), sport })

  const empty = { items: [], notes: [], sources: [], asOfUTC: null }
  const refused = (kind: AnswerKind, text: string): AssistantAnswer => ({ ...empty, kind, text, charged: false })
  const feedNotes = (feed: Omit<EventFeed, "events">) => [...(feed.limited ? [t.feed.limited] : []), ...(feed.state === "stale" ? [t.feed.stale] : [])]
  const feedSource = (feed: Omit<EventFeed, "events">) => ({ sources: [{ label: t.reports.verifiedData, url: null }], asOfUTC: feed.fetchedAt })

  if (PREDICTION.test(question)) return refused("declined", copy.declined)

  const named = REFERENCE.filter((entry) => namesEntry(entry, question))
  const reference = named.find((entry) => !sport || entry.sport === sport) ?? null
  // A note on the term exists, but for another sport, and its rule must not be passed off as this one's.
  const uncovered = !reference && named.length > 0 && sport ? SPORTS.find((item) => item.id === sport)?.name[locale].toLowerCase() : undefined
  const noRule = (name: string) => refused("no_data", fill(copy.noRule, { sport: name }))
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
  if (uncovered && RULE.test(question)) return noRule(uncovered)

  if (STANDINGS.test(question)) {
    const asked = (team: string) => nameMatches(team, topic, question)
    if (sport === "motorsport") {
      let lastFeed: EventFeed | null = null
      for (let day = 0; day < CHAMPIONSHIP_LOOKBACK_DAYS; day += 1) {
        const feed = await dayFeed(day)
        if (feed.state === "unavailable") continue
        lastFeed = feed
        const [found] = latest(feed.events.filter((event) => championshipOf(event).length > 0 && (wanted(event) || championshipOf(event).some((row) => asked(row.name)))))
        if (!found) continue
        const rows = championshipOf(found).map(({ position, name, points }) => ({ rank: position, team: name, played: null, points, won: null, lost: null }))
        const season = found.details?.kind === "motorsport" ? found.details.season : null
        return {
          kind: "standings",
          text: fill(copy.standingsFound, { league: found.competition.name }),
          items: [toItem(found, true, t)],
          table: { ...tableView(found.competition.id ?? "", { league: found.competition.name, season, rows }, asked), racing: true },
          notes: [...feedNotes(feed), copy.factsNote],
          ...feedSource(feed),
          charged: true,
        }
      }
      if (!lastFeed) return refused("unavailable", copy.unavailable)
      return { ...empty, kind: "no_data", text: copy.noStandingsFound, ...feedSource(lastFeed), charged: true }
    }
    if (unnamed) return refused("unknown", copy.needTeam)
    const team = await sources.getTeamFixtures(topic, sport).catch(() => null)
    const candidates = team?.team ? competitionsIn([...team.recent, ...(team.upcoming ?? [])]) : []
    let lastFeed: EventFeed | null = null
    for (let day = 0; candidates.length === 0 && day < RESULT_LOOKBACK_DAYS; day += 1) {
      const feed = await dayFeed(day)
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
    const feed = await dayFeed(0)
    if (feed.state === "unavailable") return refused("unavailable", copy.unavailable)
    // A stale feed may still say live about a game that ended, and that must not be repeated.
    if (feed.state === "stale") return { ...empty, kind: "no_data", text: copy.liveStale, notes: feedNotes(feed), ...feedSource(feed), charged: true }
    const live = feed.events.filter((event) => event.status === "live" && wanted(event))
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
    if (unnamed && !sport) return refused("unknown", copy.needTeam)
    const answerResult = (found: SportEvent, feed: Omit<EventFeed, "events">): AssistantAnswer => ({
      kind: "result",
      text: hasResult(found) ? copy.resultFound : copy.resultNoScore,
      items: [toItem(found, true, t)],
      notes: feedNotes(feed),
      ...feedSource(feed),
      charged: true,
    })
    const finished = (events: SportEvent[]) => latest(events.filter((event) => event.status === "finished"))

    // The team lookup needs the provider's exact name, so a partial name falls through to the daily feeds.
    const team = unnamed ? null : await sources.getTeamFixtures(topic, sport).catch(() => null)
    const direct = team?.team ? finished(team.recent)[0] : undefined
    if (team && direct) return answerResult(direct, team.feed)

    let lastFeed: EventFeed | null = null
    for (let day = 0; day < RESULT_LOOKBACK_DAYS; day += 1) {
      const feed = await dayFeed(day)
      if (feed.state === "unavailable") continue
      lastFeed = feed
      const found = finished(feed.events.filter(wanted))
      if (found.length === 0) continue
      if (!unnamed) return answerResult(found[0], feed)
      const scored = found.filter(hasResult)
      if (scored.length === 0) continue
      return { kind: "result", text: copy.resultsFound, items: scored.slice(0, MAX_ITEMS).map((event) => toItem(event, true, t)), notes: feedNotes(feed), ...feedSource(feed), charged: true }
    }
    if (!lastFeed) return refused("unavailable", copy.unavailable)
    return { ...empty, kind: "no_data", text: fill(copy.noResult, { days: RESULT_LOOKBACK_DAYS }), notes: feedNotes(lastFeed), ...feedSource(lastFeed), charged: true }
  }

  if (FIXTURES.test(question)) {
    if (unnamed && !sport) return refused("unknown", copy.needTeam)
    const feed = await dayFeed(0)
    if (feed.state === "unavailable") return refused("unavailable", copy.unavailable)
    const found = feed.events.filter(wanted)
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

  if (reference) return rule(reference)
  return uncovered ? noRule(uncovered) : refused("unknown", copy.unknown)
}
