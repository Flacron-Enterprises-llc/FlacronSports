// Cricket: format, innings, margin and match facts. The feed gives one number per side
// and everything else, when it gives it at all, in free text in two different fields.
// Formats seen are listed in the field inventory; a line that fits none of them is
// ignored, so a change of wording loses a detail rather than showing a wrong one.

import type { RawEvent } from "../thesportsdb"
import type { CricketDetails, CricketFormat, CricketOutcome, CricketStage, EventScore, EventStatus, Innings, SportEvent } from "../types"

type InningsScore = Extract<EventScore, { kind: "innings" }>

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

const FORMATS: [RegExp, CricketFormat][] = [
  [/\btest\b/i, "test"],
  [/county championship|sheffield shield|ranji/i, "first-class"],
  [/\bhundred\b/i, "hundred"],
  [/one day|\bodi\b|cricket world cup|champions trophy/i, "odi"],
  [/t20|twenty20|big bash|blast|premier league|super league|super smash|sa20|major league cricket|shpageeza|commonwealth games/i, "t20"],
]

export function cricketFormat(league: string | null | undefined): CricketFormat | null {
  // "Cricket World Cup" means one-day, but the T20 world cups carry the same words.
  const name = (league ?? "").replace(/womens?\s+/i, "")
  if (/t20/i.test(name)) return "t20"
  return FORMATS.find(([pattern]) => pattern.test(name))?.[1] ?? null
}

/** How many days a league's matches are scheduled for, or null for a one-day format. */
export const multiDayLength = (league: string | null | undefined): number | null => {
  const format = cricketFormat(league)
  return format ? SCHEDULED_DAYS[format] ?? null : null
}

const twoInnings = (format: CricketFormat | null) => format === "test" || format === "first-class"
const SCHEDULED_DAYS: Partial<Record<CricketFormat, number>> = { test: 5, "first-class": 4 }

const plainName = (name: string) => name.replace(/\b(?:cricket|women|t20)\b/gi, "").replace(/\s+/g, " ").trim()

// A side that plays one competition under another name: "Warwickshire won by 5 wickets" is the Birmingham Bears.
const ALSO_KNOWN_AS: Record<string, string> = { "birmingham bears": "warwickshire" }

const inOrder = (short: string, full: string) => {
  let at = 0
  for (const letter of full) if (letter === short[at]) at += 1
  return at === short.length
}

/**
 * Which side a piece of result text means. The text says "GT", "Hurricanes", "SUS" or
 * "India" for sides listed as "Gujarat Titans", "Hobart Hurricanes", "Sussex" and
 * "India Cricket Women". Null unless exactly one side fits at the closest level.
 */
export function matchSide(said: string, sides: string[]): number | null {
  const short = said.replace(/\s+(?:women|xi)$/i, "").trim()
  const wanted = fold(short)
  if (!wanted) return null
  const names = sides.map((side) => fold(plainName(side)))
  const words = wanted.split(/\s+/).filter((word) => word.length >= 4)
  const ranks: ((name: string) => boolean)[] = [
    (name) => name === wanted,
    (name) => ALSO_KNOWN_AS[name] === wanted,
    (name) => ` ${name} `.includes(` ${wanted} `),
    (name) => /^[A-Z]{2,6}$/.test(short) && name.split(" ").map((word) => word[0]).join("") === wanted,
    (name) => /^[A-Z]{2,6}$/.test(short) && name.startsWith(wanted[0]) && inOrder(wanted, name.replace(/\s/g, "")),
    (name) => name.length >= 5 && wanted.endsWith(name),
    // "NW Warriors", "S Paschim". Rebrands such as "Gallants" for "Galle Marvels" share a stem.
    (name) => words.some((word) => name.includes(word)),
    (name) => words.some((word) => name.split(" ").some((part) => part.startsWith(word.slice(0, 4)))),
  ]
  for (const rank of ranks) {
    const found = names.flatMap((name, index) => (rank(name) ? [index] : []))
    if (found.length === 1) return found[0]
    if (found.length > 1) return null
  }
  return null
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const count = (text: string) => WORDS[text.toLowerCase()] ?? Number(text)
const NUMBER = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)"
const WON = new RegExp(`^(.+?)\\s+(?:won|win)\\s+by\\s+(an innings and\\s+)?${NUMBER}\\s+(wicket|wkt|run)s?\\b`, "i")
const BEAT = new RegExp(`^(.+?)\\s+beat\\s+.+?\\s+by\\s+(an innings and\\s+)?${NUMBER}\\s+(wicket|wkt|run)s?\\b`, "i")

/** Splits on sentence ends, not on the dots in "S. Raza" or "D/L". */
const sentences = (text: string) => text.split(/\r?\n|(?<=[a-z0-9)])\.\s+|;\s+/).map((row) => row.trim()).filter(Boolean)

/** "Australia 322 for 9 (Carey 74)" names its side before the first figure. */
const leadingName = (text: string) => text.replace(/^.*:\s*/, "").match(/^[^\d(]+/)?.[0].trim() ?? ""

export interface CricketReading {
  outcome: CricketOutcome | null
  winner: string | null
  margin: InningsScore["margin"]
  byInnings: boolean
  ballsLeft: number | null
  method: "dls" | null
  rain: boolean
  reducedOvers: number | null
  revisedOvers: number | null
  target: number | null
  playerOfMatch: string | null
  toss: CricketDetails["toss"]
}

export function readCricketText(text: string, sides: string[]): CricketReading {
  const rows = sentences(text)
  // A scorecard sentence can hold semicolons, so the whole text gets a last look.
  const candidates = [...rows, text.replace(/\s+/g, " ")]
  let reading: Pick<CricketReading, "outcome" | "winner" | "margin" | "byInnings"> = { outcome: null, winner: null, margin: null, byInnings: false }
  for (const row of candidates) {
    const match = row.match(BEAT) ?? row.match(WON)
    const side = match ? matchSide(leadingName(match[1]), sides) : null
    if (!match || side === null) continue
    reading = { outcome: "won", winner: sides[side], margin: { value: count(match[3]), unit: match[4].toLowerCase() === "run" ? "runs" : "wickets" }, byInnings: Boolean(match[2]) }
    break
  }
  if (!reading.outcome) {
    if (rows.some((row) => /^match drawn\b/i.test(row))) reading.outcome = "drawn"
    else if (rows.some((row) => /^(?:match )?tied\b/i.test(row))) reading.outcome = "tied"
    else if (rows.some((row) => /^no result\b/i.test(row) || /\babandoned\b/i.test(row))) reading.outcome = "no-result"
  }
  const toss = text.match(/^\s*(.+?)\s+won (?:the )?toss(?:,| and)\s+(?:chose|elected|electing|opted) to (bat|field|bowl)/im) ?? text.match(/[;.]\s*([^;.]+?)\s+won (?:the )?toss,\s+(?:chose|elected) to (bat|field|bowl)/i)
  const tossSide = toss ? matchSide(toss[1], sides) : null
  const player = (text.match(/(?:player of the match|potm):\s*([^(\r\n.]+)/i) ?? text.match(/\b([A-Z][\w'-]+(?: [A-Z][\w'-]+)+) was named Player of the Match/))?.[1].trim()
  return {
    ...reading,
    ballsLeft: Number(text.match(/\((?:with\s+)?(\d+) balls? (?:remaining|left)\)/i)?.[1]) || null,
    method: /\b(?:DLS|D\/L)\b/i.test(text) ? "dls" : null,
    rain: /\brain\b|rain-affected/i.test(text),
    reducedOvers: Number(text.match(/reduced to (\d+) overs/i)?.[1]) || null,
    revisedOvers: Number(text.match(/revised target from (\d+) overs/i)?.[1]) || null,
    target: Number(text.match(/\btarget(?: of)? (\d{1,3})\b/i)?.[1]) || null,
    playerOfMatch: player || null,
    toss: toss && tossSide !== null ? { side: sides[tossSide], choice: toss[2].toLowerCase() === "bat" ? "bat" : "field" } : null,
  }
}

const parseRuns = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

const parseWickets = (value: string | number | null | undefined) => {
  const wickets = parseRuns(value)
  return wickets !== null && wickets <= 10 ? wickets : null
}

const LINE = /(?:^|[\n;:.]\s*|\bvs\s+|\bbeat\s+)([A-Z][A-Za-z'.\- ]*?)\s*(\d{1,3})(?:\/(\d{1,2})|\s+for\s+(\d{1,2})|\s+(all out))?\s*(?:\((\d{1,3}(?:\.\d)?)\s*(?:overs?|ov)\b|(?=\s*\())/g

/** Each side's line in a one-innings match. A line counts only if it carries the side's own runs. */
export function readInningsLines(text: string, sides: string[], runs: (number | null)[]): (Innings | null)[] {
  const found: (Innings | null)[] = sides.map(() => null)
  for (const match of text.replace(/\r/g, "").matchAll(LINE)) {
    const side = matchSide(match[1], sides)
    const total = Number(match[2])
    if (side === null || found[side] || (runs[side] !== null && runs[side] !== total)) continue
    const wickets = match[5] ? 10 : parseWickets(match[3] ?? match[4])
    found[side] = { runs: total, wickets, overs: match[6] ?? null }
  }
  fillFromFigures(found, text, runs)
  return found
}

const FIGURES = /\b(\d{1,3})(?:\/|\s+for\s+)(\d{1,2})\b(?:\s+in\s+(\d{1,3}(?:\.\d)?)\s+overs?)?/g

/** "a score of 251/7" or "reached 118/5 in 7.4 overs" name no side, but only one side made those runs. */
function fillFromFigures(found: (Innings | null)[], text: string, runs: (number | null)[]) {
  for (const match of text.matchAll(FIGURES)) {
    const total = Number(match[1])
    const side = runs.indexOf(total)
    const wickets = parseWickets(match[2])
    if (side === -1 || runs.lastIndexOf(total) !== side || found[side] || wickets === null) continue
    found[side] = { runs: total, wickets, overs: match[3] ?? null }
  }
}

const SPELL = /^(\d{1,3})(?:\/(\d{1,2}))?\s*(d)?\s*(f\/o)?$/i

/** "SUS 244 & 319/9d", "ESS129 & 351/6 f/o". Must add up to the side's total, or it is not believed. */
export function readTwoInnings(text: string, sides: string[], totals: (number | null)[]): (Innings[] | null)[] {
  const found: (Innings[] | null)[] = sides.map(() => null)
  for (const row of text.split(/\r?\n/)) {
    const line = row.trim().match(/^([A-Z]{2,6})\s*(\d.*)$/)
    const side = line ? matchSide(line[1], sides) : null
    if (!line || side === null || found[side]) continue
    const spells = line[2].split("&").map((part) => part.trim().match(SPELL))
    if (spells.some((spell) => !spell)) continue
    const innings = spells.map((spell) => {
      const [, runs, wickets, declared, followOn] = spell as RegExpMatchArray
      return { runs: Number(runs), wickets: parseWickets(wickets), overs: null, ...(declared ? { declared: true } : {}), ...(followOn ? { followOn: true } : {}) }
    })
    const sum = innings.reduce((total, item) => total + item.runs, 0)
    if (totals[side] === null || totals[side] === sum) found[side] = innings
  }
  return found
}

function stageOf(raw: RawEvent): CricketStage | null {
  const text = raw.strDescriptionEN ?? ""
  if (/\beliminator\b/i.test(text)) return "eliminator"
  if (/\bqualifier\b/i.test(text)) return "qualifier"
  const round = Number(raw.intRound)
  if (round === 200) return "final"
  if (round === 150) return "semi-final"
  return round === 160 || round === 170 || round === 180 || round === 400 ? "playoff" : null
}

const ROUND_LIMIT = 99

const ofText = (text: string, pattern: RegExp) => text.match(pattern)?.[1].trim() || null

function detailsOf(raw: RawEvent, format: CricketFormat | null, reading: CricketReading): CricketDetails {
  const text = `${raw.strDescriptionEN ?? ""}\n${raw.strResult ?? ""}`
  const round = Number(raw.intRound)
  return {
    kind: "cricket",
    format,
    scheduledDays: format ? SCHEDULED_DAYS[format] ?? null : null,
    stage: stageOf(raw),
    matchLabel: text.match(/\b(\d{1,2}(?:st|nd|rd|th)) (Test|ODI|T20I)\b/)?.slice(1, 3).join(" ") ?? null,
    round: Number.isInteger(round) && round > 0 && round <= ROUND_LIMIT ? round : null,
    season: raw.strSeason?.trim() || null,
    group: raw.strGroup?.trim() || null,
    phase: ofText(raw.strDescriptionEN ?? "", /^\s*(Phase \d+\b[^\r\n]*)/im),
    umpires: ofText(raw.strDescriptionEN ?? "", /^\s*Umpires?:\s*([^\r\n]+)/im),
    dayNight: /\bnight match\b/i.test(raw.strDescriptionEN ?? ""),
    city: raw.strCity?.trim() || null,
    country: raw.strCountry?.trim() || null,
    women: /\bwomen\b/i.test(`${raw.strHomeTeam} ${raw.strLeague}`),
    toss: reading.toss,
    spectators: parseRuns(raw.intSpectators),
  }
}

function resultFacts(reading: CricketReading): Partial<InningsScore> {
  return {
    ...(reading.outcome ? { outcome: reading.outcome } : {}),
    ...(reading.byInnings ? { byInnings: true } : {}),
    ...(reading.ballsLeft ? { ballsLeft: reading.ballsLeft } : {}),
    ...(reading.method ? { method: reading.method } : {}),
    ...(reading.rain ? { rain: true } : {}),
    ...(reading.reducedOvers ? { reducedOvers: reading.reducedOvers } : {}),
    ...(reading.revisedOvers ? { revisedOvers: reading.revisedOvers } : {}),
    ...(reading.target ? { target: reading.target } : {}),
    ...(reading.playerOfMatch ? { playerOfMatch: reading.playerOfMatch } : {}),
  }
}

const hidesResult = (status: EventStatus) => status === "scheduled" || status === "postponed" || status === "canceled"

/** No side ends on nil, so a nil is a total nobody entered: four rained-off World Cup games, and a county side. */
const parseTotal = (value: string | number | null | undefined) => parseRuns(value) || null

const DAY_MS = 86_400_000


type Figure = string | number | null | undefined

interface Sides {
  totals: (number | null)[]
  wickets: Figure[]
}

const reversed = <T,>([home, away]: T[]): T[] => [away, home]

/**
 * The feed has filed totals and wickets under the wrong side: Sri Lanka 146, England 95 beside
 * "England won by 51 runs". The stated margin settles it where it fits only one way. On a
 * revised target the winner can have the lower total, so a DLS game is not turned round.
 * A win by N wickets also states the winner's own wickets, which outrank a figure that disagrees.
 */
function settleSides({ totals, wickets }: Sides, sides: string[], reading: CricketReading): Sides {
  const winner = reading.winner ? sides.indexOf(reading.winner) : -1
  const margin = reading.margin
  if (winner === -1 || !margin) return { totals, wickets }
  const [won, lost] = [totals[winner], totals[1 - winner]]
  const swapped = !reading.method && won !== null && lost !== null && (margin.unit === "runs" ? lost - won === margin.value : won < lost)
  const settled = swapped ? { totals: reversed(totals), wickets: reversed(wickets) } : { totals, wickets }
  if (margin.unit !== "wickets") return settled

  const down = 10 - margin.value
  const [own, other] = [settled.wickets[winner], settled.wickets[1 - winner]]
  if (parseWickets(own) === down) return settled
  const figures: Figure[] = []
  figures[winner] = down
  figures[1 - winner] = parseWickets(other) === down ? own : other
  return { totals: settled.totals, wickets: figures }
}

export function cricketFields(raw: RawEvent, sides: string[], infer: (settled: boolean) => EventStatus): Pick<SportEvent, "status" | "score" | "details"> {
  const format = cricketFormat(raw.strLeague)
  const text = [raw.strResult, raw.strDescriptionEN].filter(Boolean).join("\n")
  const reading = readCricketText(text, sides)
  const entered = [parseTotal(raw.intHomeScore), parseTotal(raw.intAwayScore)]
  // Two totals and a passed date do not settle a game: a feed that stopped mid-chase looks the
  // same, and would name the wrong winner. Such a game keeps its score as unconfirmed.
  const inferred = infer(Boolean(reading.outcome))
  // The postponed flag stays on a game played later, and FT is the newer word.
  const stated = inferred === "postponed" && raw.strStatus?.trim().toUpperCase() === "FT" ? "finished" : inferred
  const status: EventStatus = reading.outcome === "no-result" && stated === "finished" ? "abandoned" : stated
  const details = detailsOf(raw, format, reading)
  const { totals, wickets } = twoInnings(format) ? { totals: entered, wickets: [] } : settleSides({ totals: entered, wickets: [raw.intHomeScoreExtra, raw.intAwayScoreExtra] }, sides, reading)
  const facts = { winner: reading.winner, margin: reading.margin, ...resultFacts(reading) }
  let score: EventScore = { kind: "none" }
  if (!hidesResult(status)) {
    if (twoInnings(format)) score = twoInningsScore(text, sides, totals, facts, reading)
    else {
      const lines = readInningsLines(text, sides, totals)
      const side = (index: number, extra: string | number | null | undefined): Innings | null => {
        const line = lines[index]
        const runs = totals[index] ?? line?.runs ?? null
        return runs === null ? null : { runs, wickets: parseWickets(extra) ?? line?.wickets ?? null, overs: line?.overs ?? null }
      }
      const home = side(0, wickets[0])
      const away = side(1, wickets[1])
      if (home || away || (reading.outcome && reading.outcome !== "no-result")) score = { kind: "innings", home, away, ...facts }
    }
  }
  return { status, score, details }
}

/**
 * The feed's one number per side is the sum of both innings in county cricket, but not
 * always in a Test: one side's first innings alone has been seen beside an innings win.
 * So a total stands only when innings are listed, or when it does not contradict the margin.
 */
function twoInningsScore(text: string, sides: string[], totals: (number | null)[], facts: Pick<InningsScore, "winner" | "margin">, reading: CricketReading): EventScore {
  const spells = readTwoInnings(text, sides, totals)
  const total = (index: number): Innings | null => {
    const runs = totals[index] ?? spells[index]?.reduce((sum, item) => sum + item.runs, 0) ?? null
    return runs === null ? null : { runs, wickets: null, overs: null }
  }
  if (spells[0] || spells[1]) {
    return { kind: "innings", home: total(0), away: total(1), ...facts, ...(spells[0] ? { homeInnings: spells[0] } : {}), ...(spells[1] ? { awayInnings: spells[1] } : {}) }
  }
  const [home, away] = totals
  const winnerIndex = reading.winner ? sides.indexOf(reading.winner) : -1
  const contradicted = reading.byInnings && home !== null && away !== null && winnerIndex !== -1 && (winnerIndex === 0 ? home - away : away - home) !== reading.margin?.value
  if (contradicted || (home === null && away === null)) {
    return reading.outcome ? { kind: "innings", home: null, away: null, ...facts } : { kind: "none" }
  }
  return { kind: "innings", home: total(0), away: total(1), ...facts, totalsOnly: true }
}
