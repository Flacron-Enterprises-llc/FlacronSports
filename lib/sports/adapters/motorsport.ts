// Motorsport: every session is one record, and its result is whatever table or list its
// contributor pasted in. The layouts below are all of those in the field inventory. A
// table counts only if positions run unbroken from 1, so a layout this file does not
// know hides the result rather than showing a wrong order.

import type { RawEvent, RawResult } from "../thesportsdb"
import type { ClassificationEntry, ClassifiedOut, EventScore, EventStatus, MotorsportDetails, MotorsportSession, SportEvent, StandingEntry } from "../types"

type Classification = Extract<EventScore, { kind: "classification" }>

const NATIONS = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "China", "Colombia", "Denmark", "Finland", "France",
  "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Monaco", "Netherlands", "New Zealand", "Poland", "Russia",
  "Spain", "Sweden", "Switzerland", "Thailand", "United Kingdom", "United States", "Venezuela",
]

function withoutNation(cell: string): string | null {
  const nation = NATIONS.find((name) => cell.startsWith(`${name} `))
  return nation ? cell.slice(nation.length + 1).trim() : null
}

/** "+4.395s", "+ 0:05:777" and "42:19:363" are all a time; the last colon can stand for the decimal point. */
function timing(cell: string | undefined): string | null {
  const text = cell?.replace(/\s+/g, "").replace(/s$/, "")
  if (!text) return null
  const match = text.match(/^\+?\d[\d:.']*(?=[a-z]?$)/)
  return match ? match[0].replace(/:(\d{3})$/, ".$1").replace(/'/g, ":") : null
}

const cellsOf = (row: string) => row.split(/\t+|\s+\/\s*|\s{2,}/).map((cell) => cell.trim().replace(/^\//, "").trim()).filter(Boolean)
const POSITION = /^\d{1,3}$/
const OUT = /^(?:Ret|DNF|DNS|DSQ|DQ|NC|NS|WD)$/

interface Read {
  position: string
  entry: Omit<ClassificationEntry, "position">
  note: string | null
}

/** Grand prix table: position, number, nation and driver, team, laps, time, grid, points. */
function grandPrixRow(row: string): Read | null {
  const cells = row.split("\t").map((cell) => cell.trim())
  if (!/^\d+$/.test(cells[1] ?? "") || !/^\d+$/.test(cells[4] ?? "")) return null
  const name = withoutNation(cells[2] ?? "")
  if (!name || !cells[3]) return null
  return {
    position: cells[0],
    note: timing(cells[5]) ? null : cells[5] || null,
    entry: {
      name, team: cells[3], time: timing(cells[5]), laps: Number(cells[4]), number: Number(cells[1]),
      grid: /^\d+$/.test(cells[6] ?? "") ? Number(cells[6]) : null,
      ...(cells[6] === "PL" ? { pitLane: true } : {}),
      ...(/^\d+(?:\.\d+)?$/.test(cells[7] ?? "") ? { points: Number(cells[7]) } : {}),
    },
  }
}

/** Tab or slash marked: position, name, team, time. British GT puts the car first and lists its drivers. */
function tableRow(row: string): Read | null {
  const cells = cellsOf(row)
  if (cells.length < 2 || !(POSITION.test(cells[0]) || OUT.test(cells[0]))) return null
  if (cells.length > 5) return null
  if (/^\d{1,3}$/.test(cells[1]) && cells.length >= 4) {
    return { position: cells[0], note: timing(cells[4]) ? null : cells[4] || null, entry: { name: cells[3], team: cells[2], time: timing(cells[4]), number: Number(cells[1]) } }
  }
  if (cells.length > 4 || /^\d/.test(cells[1])) return null
  return { position: cells[0], note: timing(cells[3]) ? null : cells[3] || null, entry: { name: cells[1], team: cells[2] ?? null, time: timing(cells[3]) } }
}

/** "1. Kimi Antonelli (Mercedes) 1:34.035", and "1. Chase Briscoe (#19, Joe Gibbs Racing) - 267 laps". */
function listRow(row: string): Read | null {
  // GT World Challenge: "2. #50 Name/Name (AF Corse) Pro Cup +2.597".
  const entered = row.match(/^(\d{1,3})\.\s+#(\d+)\s+(.+?)\s+\(([^)]+)\)(?:\s+[A-Z][a-z]+ Cup)?(?:\s+(\+?\d[\d:.]*))?$/)
  if (entered) return { position: entered[1], note: null, entry: { name: entered[3], team: entered[4], time: timing(entered[5]), number: Number(entered[2]) } }
  const match = row.match(/^(\d{1,3})\.\s+(.+?)(?:\s+\(([^)]+)\))?(?:\s+-\s+(\d+) laps)?(?:\s+(\+?\d[\d:.]*)s?)?(?:\s+-\s.*)?$/)
  if (!match) return null
  const car = match[3]?.match(/^#(\d+),\s*(.+)$/)
  return { position: match[1], note: null, entry: { name: match[2].trim(), team: car?.[2] ?? match[3] ?? null, time: timing(match[5]), ...(match[4] ? { laps: Number(match[4]) } : {}), ...(car ? { number: Number(car[1]) } : {}) } }
}

/** "1 #100 Name/Name - TEAM (Honda) - 66 laps, 1'29.842". */
function carRow(row: string): Read | null {
  const match = row.match(/^(\d{1,3})\s+#(\d+)\s+(.+?)\s+-\s+(.+?)\s+-\s+(\d+)(?:\s+laps)?,\s+(\S+)/)
  return match ? { position: match[1], note: null, entry: { name: match[3].trim(), team: match[4].trim(), time: timing(match[6]), laps: Number(match[5]), number: Number(match[2]) } } : null
}

const readRow = (row: string) => (/^\d{1,3}\s+#/.test(row) ? carRow(row) : /^\d{1,3}\.\s/.test(row) ? listRow(row) : grandPrixRow(row) ?? tableRow(row))

/** "Pos | Car # | Team | Best Lap | Gap", where the row after the header sets the columns. */
function pipeRows(rows: string[]): Read[] {
  const at = rows.findIndex((row) => /^Pos\s*\|/i.test(row.trim()))
  if (at === -1) return []
  const columns = rows[at].split("|").map((cell) => cell.trim().toLowerCase())
  const column = (cells: string[], name: RegExp) => cells[columns.findIndex((title) => name.test(title))]
  return rows.slice(at + 1).flatMap((row) => {
    const cells = row.split("|").map((cell) => cell.trim())
    if (cells.length !== columns.length || !POSITION.test(cells[0])) return []
    const number = Number(column(cells, /car/)?.replace("#", ""))
    const gap = column(cells, /gap/)
    const best = column(cells, /best|time/)
    const name = column(cells, /driver/) ?? column(cells, /team/)
    return name ? [{ position: cells[0], note: null, entry: { name, team: column(cells, /team/) ?? null, time: timing(cells[0] === "1" ? best : gap) ?? timing(best), ...(Number.isFinite(number) ? { number } : {}) } }] : []
  })
}

const STANDINGS = /standings/i
const NOT_CLASSIFIED = /^not classified\b/i
const CLASS_HEADING = /^(GT\d{1,3}|LMGT3|LMP2|Hypercar)(?:\s+classification)?:?$/i
const HEAT_HEADING = /^(RACE \d)\b/

function standingRow(row: string): StandingEntry | null {
  const cells = row.split(/\s+\/|\t+/).map((cell) => cell.trim()).filter(Boolean)
  const points = Number(cells.at(-1))
  if (cells.length < 3 || !POSITION.test(cells[0]) || !Number.isFinite(points)) return null
  return { position: Number(cells[0]), name: cells[1], ...(cells.length > 3 ? { team: cells[2] } : {}), points }
}

/** The run of places from first. A source can stop at the top 10 and pick up again at 36th. */
function unbroken(reads: Read[]): ClassificationEntry[] | null {
  // DTM writes its positions "01", "02".
  const end = reads.findIndex((read, index) => Number(read.position) !== index + 1)
  const run = end === -1 ? reads : reads.slice(0, end)
  return run.length < 3 ? null : run.map((read) => ({ position: Number(read.position), ...read.entry }))
}

export type RaceResult = Omit<Classification, "kind">

/**
 * Reads the classified finishers, then whatever follows: retirements, the not-classified
 * block, pole, fastest lap and the championship table. Commentary lines are skipped.
 */
export function parseRace(text: string | null | undefined, heat: number | null = null): RaceResult | null {
  if (!text) return null
  const rows = text.split(/\r?\n/)
  const groups: { name: string | null; reads: Read[] }[] = [{ name: null, reads: [] }]
  const out: ClassifiedOut[] = []
  const standings: StandingEntry[] = []
  let block: "race" | "out" | "standings" = "race"
  let pole: string | null = null
  let fastest: RaceResult["fastestLap"] = null

  const piped = pipeRows(rows)
  if (piped.length > 0) groups[0].reads = piped

  for (const line of rows) {
    const row = line.trim()
    if (!row) continue
    if (NOT_CLASSIFIED.test(row)) { block = "out"; continue }
    if (STANDINGS.test(row)) { block = "standings"; continue }
    const heading = row.match(CLASS_HEADING)?.[1] ?? row.match(HEAT_HEADING)?.[1]
    if (heading) {
      block = "race"
      if (groups.at(-1)?.reads.length) groups.push({ name: heading, reads: [] })
      else (groups.at(-1) as (typeof groups)[number]).name = heading
      continue
    }
    const poleRow = row.match(/^Pole Position\s*-\s*(.+)$/i)
    if (poleRow) { pole = poleRow[1].trim(); continue }
    const lap = row.match(/^Fastest Lap\s*-\s*(.+?)\s*\(([\d:.]+)\)/i)
    if (lap) { fastest = { name: lap[1].trim(), time: timing(lap[2]) }; continue }
    if (piped.length > 0) continue
    if (block === "standings") {
      const standing = standingRow(line)
      if (standing) standings.push(standing)
      continue
    }
    const read = readRow(line.trimEnd())
    if (!read) continue
    if (block === "out" || OUT.test(read.position)) out.push({ name: read.entry.name, team: read.entry.team, status: OUT.test(read.position) ? read.position.toUpperCase() : null, note: read.note, ...(typeof read.entry.laps === "number" ? { laps: read.entry.laps } : {}) })
    else groups.at(-1)?.reads.push(read)
  }

  // One record can hold a whole weekend's races, and it belongs to one of them.
  const heats = groups.filter((group) => group.name?.startsWith("RACE "))
  const own = heats.find((group) => group.name === `RACE ${heat}`) ?? heats[0]
  const [main, ...others] = own ? [{ ...own, name: null }] : groups
  const entries = unbroken(main.reads)
  if (!entries) return null
  const classes = others.flatMap((group) => {
    const list = unbroken(group.reads)
    return list && group.name ? [{ name: group.name, entries: list }] : []
  })
  return {
    entries,
    ...(main.name ? { className: main.name } : {}),
    ...(classes.length > 0 ? { classes } : {}),
    ...(out.length > 0 ? { out } : {}),
    ...(pole ? { pole } : {}),
    ...(fastest ? { fastestLap: fastest } : {}),
    ...(standings.length > 0 ? { standings } : {}),
  }
}

export const parseClassification = (text: string | null | undefined): ClassificationEntry[] | null => parseRace(text)?.entries ?? null

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

/**
 * The results endpoint: name, place, and time, gap or reason. It covers sessions with no
 * pasted table, such as practice and rallies, but holds no team, grid or laps.
 */
export function raceFromRows(rows: RawResult[] | null | undefined): RaceResult | null {
  const listed = (rows ?? []).flatMap((row) => {
    const position = Number(row.intPosition)
    return row.strPlayer && Number.isInteger(position) && position > 0 ? [{ position, name: row.strPlayer.trim(), detail: row.strDetail?.trim() ?? "", playerId: row.idPlayer ?? undefined }] : []
  }).sort((a, b) => a.position - b.position)
  const stopped = (detail: string) => /^(?:RET|DNF|DNS|DSQ|DQ|NC|WD)$/i.test(detail)
  const running = listed.filter((row) => !stopped(row.detail))
  const reads: Read[] = running.map((row) => ({ position: String(row.position), note: null, entry: { name: row.name, team: null, time: timing(row.detail) ?? (/^\d+ laps?$/i.test(row.detail) ? row.detail : null), ...(row.playerId ? { playerId: row.playerId } : {}) } }))
  const entries = unbroken(reads)
  if (!entries) return null
  const placed = new Set(entries.map((entry) => entry.name))
  const out = listed.filter((row) => !placed.has(row.name)).map((row): ClassifiedOut => ({ name: row.name, team: null, status: stopped(row.detail) ? row.detail.toUpperCase() : null, note: stopped(row.detail) ? null : row.detail || null }))
  return { entries, ...(out.length > 0 ? { out } : {}) }
}

/** A pasted table has the teams and the results endpoint has the player records, so each fills the other. */
function linked(race: RaceResult, rows: RawResult[] | null | undefined): RaceResult {
  const ids = new Map((rows ?? []).flatMap((row) => (row.strPlayer && row.idPlayer ? [[fold(row.strPlayer), row.idPlayer] as const] : [])))
  return { ...race, entries: race.entries.map((entry) => ({ ...entry, ...(ids.get(fold(entry.name)) ? { playerId: ids.get(fold(entry.name)) } : {}) })) }
}

const CLASS_IN_TITLE = /\s+[-–]\s+((?:Hypercar|LMGT3|LMP2)(?:\s*&\s*(?:Hypercar|LMGT3|LMP2))?)$/i

export function sessionOf(title: string): { session: MotorsportSession; number: number | null; weekend: string; className: string | null } {
  const className = title.match(CLASS_IN_TITLE)?.[1] ?? null
  const name = title.replace(CLASS_IN_TITLE, "").trim()
  const found: [RegExp, MotorsportSession][] = [
    [/\s*\b(?:Free Practice|Practice|FP)\s*(\d)?$/i, "practice"],
    [/\s*\bTesting\s*\d?\s*(?:Day\s*(\d))?$/i, "testing"],
    [/\s*\bSprint Qualifying\s*(\d)?$/i, "sprint-qualifying"],
    [/\s*\b(?:Qualifying|Qualifing|Hyperpole|Shootout|Superpole)\s*(\d)?$/i, "qualifying"],
    [/\s*\bSprint(?: Race)?\s*(\d)?$/i, "sprint"],
  ]
  for (const [pattern, session] of found) {
    const match = name.match(pattern)
    if (match) return { session, number: match[1] ? Number(match[1]) : null, weekend: name.slice(0, match.index).trim() || name, className }
  }
  const heat = name.match(/\s*\bRace\s*(\d+)$/i)
  return { session: "race", number: heat ? Number(heat[1]) : null, weekend: heat ? name.slice(0, heat.index).trim() || name : name, className }
}

const hidesResult = (status: EventStatus) => status === "scheduled" || status === "postponed" || status === "canceled"
const competitor = (name: string) => ({ id: null, name, role: "competitor" as const, badgeUrl: null })

function detailsOf(raw: RawEvent, title: string | null): MotorsportDetails {
  const parsed = sessionOf(title ?? "")
  const round = Number(raw.intRound)
  const laps = `${raw.strResult ?? ""}`.match(/\bwas run for (\d+) laps\b|\((\d+) laps\)/)
  return {
    kind: "motorsport",
    session: parsed.session,
    sessionNumber: parsed.number,
    weekend: parsed.weekend || null,
    className: parsed.className,
    round: Number.isInteger(round) && round > 0 ? round : null,
    circuit: raw.strVenue?.trim() || null,
    city: raw.strCity?.trim() || null,
    country: raw.strCountry?.trim() || null,
    season: raw.strSeason?.trim() || null,
    scheduledLaps: laps ? Number(laps[1] ?? laps[2]) : null,
  }
}

export function motorsportFields(raw: RawEvent, infer: (settled: boolean) => EventStatus): Pick<SportEvent, "eventType" | "participantType" | "participants" | "eventName" | "status" | "score" | "details"> {
  const title = raw.strEvent?.trim() || null
  const pasted = parseRace(raw.strResult, sessionOf(title ?? "").number)
  const race = pasted ? linked(pasted, raw.resultRows) : raceFromRows(raw.resultRows)
  const status = infer(Boolean(race))
  const shown = race && !hidesResult(status) ? race : null
  return {
    eventType: "session",
    participantType: "entrant",
    participants: shown ? shown.entries.map((entry) => ({ ...competitor(entry.name), id: entry.playerId ?? null })) : [],
    eventName: title,
    status,
    score: shown ? { kind: "classification", ...shown } : { kind: "none" },
    details: detailsOf(raw, title),
  }
}
