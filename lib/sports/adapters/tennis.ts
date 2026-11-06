// Tennis: most matches arrive as a bare title, "Tournament Name vs Name", with no field
// for either player. A recent match may add a draw line and a result, and the team
// events each have their own layouts. Every layout in the field inventory is read here.

import type { RawEvent, RawResult } from "../thesportsdb"
import type { EventScore, EventStatus, Participant, SetLine, SportEvent, TennisDetails, TennisRound, TennisRubber } from "../types"

type Sets = Extract<EventScore, { kind: "sets" }>
type Fields = Pick<SportEvent, "eventType" | "participantType" | "participants" | "eventName" | "status" | "score" | "details">

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim())

/** Results are stated per side, so a line that does not fit exactly hides the result. */
export function parseTennisResult(text: string | null | undefined): Omit<Sets, "kind"> | null {
  if (!text) return null
  const rows = lines(text)
  const walkover = rows[0].match(/^(.+?)\s+w\/o\s+(.+)$/)
  if (walkover) return { lines: [{ name: walkover[1].trim(), games: [] }, { name: walkover[2].trim(), games: [] }], winner: walkover[1].trim(), retired: null, walkover: true }
  const scored: SetLine[] = rows.flatMap((row) => {
    const match = row.match(/^(.+?)\s*:\s*(\d+(?:\s+\d+)*)$/)
    return match ? [{ name: match[1].trim(), games: match[2].split(/\s+/).map(Number) }] : []
  })
  if (scored.length !== 2 || scored[0].games.length !== scored[1].games.length) return null

  const names = scored.map((line) => line.name)
  const winner = rows[0].match(/^(.+?)\s+beat\s+.+?\s+\d+-\d+$/)?.[1].trim() ?? null
  const retired = rows[0].match(/^(.+?)\s+retired from the match\.?$/)?.[1].trim() ?? null
  if ((winner && !names.includes(winner)) || (retired && !names.includes(retired))) return null
  return { lines: scored, winner, retired }
}

const SET = /(\d{1,2})-(\d{1,2})(?:\((\d{1,2})\))?/g
const SET_RUN = /\b\d{1,2}-\d{1,2}(?:\(\d{1,2}\))?(?:(?:,\s*|\s+)\d{1,2}-\d{1,2}(?:\(\d{1,2}\))?)+|\b\d{1,2}-\d{1,2}\(\d{1,2}\)/

/** "6-3, 7-6(4), 13-11", written from the winner's side. The bracket is the set loser's tiebreak points. */
export function parseSetRun(text: string): { winner: number[]; loser: number[]; tiebreaks: (number | null)[] } | null {
  const run = text.match(SET_RUN)?.[0]
  if (!run) return null
  const sets = [...run.matchAll(SET)]
  return { winner: sets.map((set) => Number(set[1])), loser: sets.map((set) => Number(set[2])), tiebreaks: sets.map((set) => (set[3] ? Number(set[3]) : null)) }
}

const surnames = (side: string) => side.split(/\s*\/\s*|\s+and\s+/).map((name) => name.trim().split(/\s+/).at(-1) as string)
const has = (text: string, side: string) => surnames(side).every((name) => text.includes(name))

/** "Ruud/Zverev (Team Europe) def. Bublik/Nakashima (Team World) 6-4, 7-6(7)", or a sentence saying the same. */
function proseResult(text: string, names: [string, string]): Omit<Sets, "kind"> | null {
  for (const row of lines(text)) {
    const target = row.match(/\b(?:def\.?|defeating|beating|beat|past|victory over)\s+([^0-9]{3,70})/)?.[1]
    const sets = parseSetRun(row)
    if (!target || !sets) continue
    const lost = names.findIndex((name) => has(target, name))
    if (lost === -1 || has(target, names[1 - lost])) continue
    const won = names[1 - lost]
    return { lines: [{ name: won, games: sets.winner }, { name: names[lost], games: sets.loser }], winner: won, retired: null, ...(sets.tiebreaks.some((value) => value !== null) ? { tiebreaks: sets.tiebreaks } : {}) }
  }
  return null
}

/** The results endpoint says only who won, by full name. Doubles list both partners. */
export function resultFromRows(rows: RawResult[] | null | undefined, names: [string, string]): Omit<Sets, "kind"> | null {
  const won = (rows ?? []).filter((row) => row.strDetail === "WIN").map((row) => row.strPlayer ?? "").join(" ")
  const side = names.findIndex((name) => has(won, name))
  if (!won || side === -1 || has(won, names[1 - side])) return null
  return { lines: [{ name: names[side], games: [] }, { name: names[1 - side], games: [] }], winner: names[side], retired: null }
}

function playerIds(rows: RawResult[] | null | undefined, name: string): string | null {
  return (rows ?? []).find((row) => has(row.strPlayer ?? "", name))?.idPlayer ?? null
}

/** Rankings in brackets are dropped from the names and kept beside them. */
export function parseTennisDraw(description: string | null | undefined): { tournament: string; city: string | null; round: string | null; names: [string, string]; ranks: (number | null)[] } | null {
  const [header, draw] = lines(description ?? "")
  const match = draw?.match(/^(.+?)(?:\s*\((\d+|\w+)\))?\s+vs\.?\s+(.+?)(?:\s*\((\d+|\w+)\))?$/)
  if (!match) return null
  const [tournament, city, round] = header.split(" - ").map((part) => part.trim())
  return { tournament, city: city || null, round: round || null, names: [match[1].trim(), match[3].trim()], ranks: [Number(match[2]) || null, Number(match[4]) || null] }
}

export function tennisRound(text: string | null | undefined): TennisRound | null {
  const value = (text ?? "").toLowerCase().trim()
  if (/^(?:the )?final$/.test(value)) return { key: "final" }
  if (/^semi-?finals?$/.test(value)) return { key: "semi-final" }
  if (/^quarter-?finals?$/.test(value)) return { key: "quarter-final" }
  if (/^round robin$/.test(value)) return { key: "round-robin" }
  const number = value.match(/^(\d)(?:st|nd|rd|th) round$/)
  return number ? { key: "round", number: Number(number[1]) } : null
}

// Titles run the tournament and the first player together. These are every tournament in
// the checked seasons, because the names themselves give no boundary: "Trofeo DellEdera"
// belongs to the event and "Dada Mascoll" to a player.
const TOURNAMENTS = [
  "Abierto Mexicano", "ABN AMRO World Tennis Tournament", "Abu Dhabi WTA Womens Tennis Open", "Adelaide International", "Almaty Open", "Argentina Open", "ASB Classic", "Athens Open",
  "ATV Bancomat Tennis Open", "ATX Open", "Australian Open", "Bad Homburg Open", "Barcelona Open", "BMW Open", "BNP Paribas Masters", "BNP Paribas Open", "Boss Open", "Brisbane International",
  "Canadian Open", "Cerity Partners Hall of Fame Open for the Van Alen Cup Presented by the Margaret Fund", "Charleston Open", "Chengdu Open", "Chennai Open", "Chile Open", "China Open", "Citi Open",
  "Copa Colsanitas", "Croatia Open", "Dallas Open", "Delray Beach Open", "Dubai Duty Free Tennis Championships", "Dubai Tennis Championships", "Eastbourne International", "Eastbourne Open", "Enka Open",
  "Estoril Open", "European Open", "French Open", "Generali Open Ladies Kitzbühel", "Generali Open", "Geneva Open", "German Open", "Grand Est Open 88", "Grand Prix Hassan II", "Guadalajara Open",
  "Guangzhou Open", "Halle Open", "Hamburg European Open", "Hamburg Open", "Hangzhou Open", "Hellenic Championship", "Hobart International", "Hong Kong Tennis Open", "Iasi Open",
  "Internationaux de Strasbourg", "Internazionali BNL dItalia", "Japan Open Tennis Championships", "Japan Open", "Jiangxi Open", "Korea Open", "Ladies Linz Open", "Libéma Open", "Los Cabos Open",
  "Lyon Open", "Makarska Open", "Mallorca Championships", "Masters Cup", "Memorial Eugenio Fontana", "Memphis Classic", "Merida Open", "Miami Open", "Monte Carlo Masters", "Monterrey Open",
  "Morocco Open", "Mutua Madrid Open", "Ningbo Open", "Nordea Open", "Nordic Open", "Nottingham Open", "Open 13", "Open de Moselle", "Open de Rouen", "Open delle Puglie Trofeo DellEdera",
  "Open delle Puglie Trofeo", "Open Sud de France", "Ostrava Open", "Porsche Tennis Grand Prix", "Prague Open", "Qatar Exxon Mobil Open", "Qatar Open", "Queens Club Championships", "Rio Open",
  "Rosmalen Grass Court Championships", "Shanghai Masters", "Singapore Open", "SP Open", "Stuttgart Open", "Suisse Open Gstaad", "Swiss Indoors", "Tennis in the Land", "The HSBC Championships",
  "Tiriac Open", "Toray Pan Pacific Open Tennis Tournament", "Transylvania Open", "U.S. Mens Clay Court Championships", "U.S.Mens Clay Court Championships", "US Open", "Vienna Open",
  "Western and Southern Financial Group Masters", "Western and Southern Financial Group Womens Open", "Wimbledon", "Winston Salem Open at Wake Forest University", "WTA Finals", "Wuhan Open",
].sort((a, b) => b.length - a.length)

// A new event is most often named this way, and a wrong split only leaves the names out.
const NEW_TOURNAMENT = /^((?:Lexus .+?|.+) (?:Open|International|Championships?|Masters|Classic|Cup|Finals)) (\S.*)$/
const DRAW_NAME = /^((?:Womens|Mens|Mixed) (?:Singles|Doubles))\s+(.+)$/

/** Tournament and players from the title. Null when the boundary cannot be told. */
export function splitTitle(title: string): { tournament: string | null; names: [string, string] } | null {
  const parts = title.split(/\s+vs\.?\s+/)
  if (parts.length !== 2) return null
  const [left, right] = parts.map((part) => part.trim())
  const known = TOURNAMENTS.find((name) => left.startsWith(`${name} `))
  if (known) return { tournament: known, names: [left.slice(known.length + 1).trim(), right] }
  const draw = left.match(DRAW_NAME)
  if (draw) return { tournament: draw[1], names: [draw[2], right] }
  const lexus = left.match(NEW_TOURNAMENT)
  if (lexus) return { tournament: lexus[1], names: [lexus[2], right] }
  // Team events and the Laver Cup title the match with its two sides alone.
  return { tournament: null, names: [left, right] }
}

const RUBBER = /^(.+?)\s+def\.?\s+(.+?)\s+(\d{1,2}-\d{1,2}.*)$/

function parseRubbers(text: string): TennisRubber[] {
  return lines(text).flatMap((row) => {
    const match = row.match(RUBBER)
    const sets = match ? parseSetRun(match[3]) : null
    if (!match || !sets) return []
    return [{ winner: match[1].replace(/\s*\([A-Z]{3}\)/g, "").trim(), loser: match[2].replace(/\s*\([A-Z]{3}\)/g, "").trim(), games: sets.winner.map((games, index) => [games, sets.loser[index]] as [number, number]), tiebreaks: sets.tiebreaks }]
  })
}

/** A nation against a nation, with the rubbers listed underneath. */
function isTeamTie(raw: RawEvent): boolean {
  return Boolean(raw.strGroup) || /^united cup|davis cup|fed cup|hopman/i.test(raw.strLeague ?? "")
}

function tieScore(text: string, names: [string, string]): EventScore {
  const match = lines(text)[0].match(/^(.+?)\s+def\.?\s+(.+?)\s+(\d)-(\d)$/)
  if (!match) return { kind: "none" }
  const winnerFirst = match[1].trim() === names[0]
  if (!winnerFirst && match[1].trim() !== names[1]) return { kind: "none" }
  const [won, lost] = [Number(match[3]), Number(match[4])]
  return { kind: "team", home: winnerFirst ? won : lost, away: winnerFirst ? lost : won }
}

const competitor = (name: string): Participant => ({ id: null, name, role: "competitor", badgeUrl: null })
const hidesResult = (status: EventStatus) => status === "scheduled" || status === "postponed" || status === "canceled"

function genderOf(raw: RawEvent, tournament: string | null): TennisDetails["gender"] {
  if (/^wta/i.test(raw.strLeague ?? "") || /^womens/i.test(tournament ?? "")) return "women"
  if (/^atp/i.test(raw.strLeague ?? "") || /^mens/i.test(tournament ?? "")) return "men"
  return /^mixed/i.test(tournament ?? "") ? "mixed" : null
}

export function tennisFields(raw: RawEvent, infer: (settled: boolean) => EventStatus): Fields {
  const title = raw.strEvent?.trim() || null
  const split = title ? splitTitle(title) : null
  const draw = parseTennisDraw(raw.strDescriptionEN)
  const base = { season: raw.strSeason?.trim() || null, country: raw.strCountry?.trim() || null, group: raw.strGroup?.trim() || null }

  if (split && isTeamTie(raw)) {
    const text = raw.strResult ?? ""
    const rubbers = parseRubbers(text)
    const score = tieScore(text, split.names)
    const status = infer(rubbers.length > 0)
    return {
      eventType: "match", participantType: "entrant", participants: split.names.map(competitor), eventName: null, status,
      score: hidesResult(status) ? { kind: "none" } : score,
      details: { ...base, kind: "tennis", format: "team-tie", tournament: null, city: raw.strCity?.trim() || null, round: null, gender: null, ranks: [], rubbers: hidesResult(status) ? [] : rubbers },
    }
  }

  const stated = parseTennisResult(raw.strResult)
  const names = draw?.names ?? split?.names ?? null
  const result = stated ?? (names ? proseResult(`${raw.strResult ?? ""}\n${raw.strDescriptionEN ?? ""}`, names) ?? resultFromRows(raw.resultRows, names) : null)
  const at = (name: string) => title?.indexOf(name) ?? -1
  // Draw order, not result order: the source lists the winner first.
  const ordered = result ? result.lines.map((line) => line.name).sort((a, b) => at(a) - at(b)) : names ?? []
  const status = infer(Boolean(result && (result.winner || result.retired)))
  const tournament = draw?.tournament ?? split?.tournament ?? null
  return {
    eventType: "match",
    participantType: ordered.some((name) => name.includes("/")) ? "pair" : "individual",
    participants: ordered.map((name) => ({ ...competitor(name), id: playerIds(raw.resultRows, name) })),
    eventName: tournament ?? (names ? null : title),
    status,
    score: result && !hidesResult(status) ? { kind: "sets", ...result } : { kind: "none" },
    details: {
      ...base, kind: "tennis", format: ordered.some((name) => name.includes("/")) ? "doubles" : "singles", tournament,
      city: draw?.city ?? (raw.strCity?.trim() || null), round: tennisRound(draw?.round), gender: genderOf(raw, tournament), ranks: draw?.ranks ?? [], rubbers: [],
    },
  }
}
