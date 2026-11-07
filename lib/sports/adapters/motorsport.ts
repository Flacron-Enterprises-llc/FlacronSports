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
  const listed = cellsOf(row)
  // Moto3 at Mugello added third place's points after the gap, and no other row's.
  const cells = listed.length === 5 && /^\d{1,2}$/.test(listed[4]) && timing(listed[3]) && !/^\d/.test(listed[1]) ? listed.slice(0, 4) : listed
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

/**
 * IMSA's overall order with each car's class and class place:
 * "2 GTP Laurin Heinrich/Kaylen Frederick - JDC-Miller MotorSports - Porsche 963 - 151 - +1.960".
 */
function classedRow(row: string): Read | null {
  const match = row.match(/^(\d{1,3})\s+(GTP|LMP2|LMP3|GTD PRO|GTD)(?:-\d+)?\s+(.+?)\s+-\s+(.+?)\s+-\s+.+?\s+-\s+(\d+)(?:\s+laps)?(?:\s+-\s+(\S+))?(?:\s+\(([^)]+)\))?$/i)
  if (!match) return null
  return { position: match[1], note: match[7] ?? null, entry: { name: match[3].trim(), team: match[4].trim(), time: timing(match[6]), laps: Number(match[5]), category: match[2].toUpperCase().replace("PRO", "Pro") } }
}

/** "1 #100 Name/Name - TEAM (Honda) - 66 laps, 1'29.842". */
function carRow(row: string): Read | null {
  const match = row.match(/^(\d{1,3})\s+#(\d+)\s+(.+?)\s+-\s+(.+?)\s+-\s+(\d+)(?:\s+laps)?,\s+(\S+)/)
  return match ? { position: match[1], note: null, entry: { name: match[3].trim(), team: match[4].trim(), time: timing(match[6]), laps: Number(match[5]), number: Number(match[2]) } } : null
}

const readRow = (row: string) => (/^\d{1,3}\s+#/.test(row) ? carRow(row) : /^\d{1,3}\.\s/.test(row) ? listRow(row) : grandPrixRow(row) ?? classedRow(row) ?? tableRow(row))

/**
 * A header row names the columns: WEC's "Pos | Car # | Team | Best Lap | Gap" and Super GT's
 * "Pos /Number /Team /Drivers /Laps /Diff.", whose crews are written "Name--Name".
 */
function headedRows(rows: string[]): Read[] {
  const at = rows.findIndex((row) => /^Pos\s*[|/]/i.test(row.trim()))
  if (at === -1) return []
  const mark = /^Pos\s*\|/i.test(rows[at].trim()) ? "|" : "/"
  const columns = rows[at].split(mark).map((cell) => cell.trim().toLowerCase())
  // A championship table has the same look and is read as standings instead.
  if (!columns.some((title) => /gap|diff|time|best|lap/.test(title))) return []
  const column = (cells: string[], name: RegExp) => cells[columns.findIndex((title) => name.test(title))]
  const body = rows.slice(at + 1).filter((row) => row.trim())
  // A slash header over tabbed rows is another layout, read row by row instead.
  const fits = (row: string) => row.split(mark).length === columns.length
  const end = body.findIndex((row) => !fits(row))
  if (mark === "/" && end === 0) return []
  return (mark === "/" && end !== -1 ? body.slice(0, end) : body).flatMap((row) => {
    const cells = row.split(mark).map((cell) => cell.trim())
    if (cells.length !== columns.length || !POSITION.test(cells[0])) return []
    const number = Number(column(cells, /car|number|^no\b/)?.replace("#", ""))
    const gap = column(cells, /gap|diff/)
    const best = column(cells, /best|time/)
    const laps = Number(column(cells, /^laps?$/))
    const name = (column(cells, /driver/) ?? column(cells, /team/))?.replace(/\s*--\s*/g, " / ")
    return name ? [{ position: cells[0], note: null, entry: { name, team: column(cells, /team/) ?? null, time: timing(cells[0] === "1" ? best : gap) ?? timing(best), ...(Number.isInteger(laps) && laps > 0 ? { laps } : {}), ...(Number.isFinite(number) ? { number } : {}) } }] : []
  })
}

// An entry that ends a sentence: "10 Anthony Alfredo. DNFs: ...". "A. da Costa" is a name, not an end.
const sentenceEnd = (text: string) => text.split(/(?<=[a-z]{2})\.\s/)[0].replace(/\.$/, "").trim()

/**
 * Places written inline in prose: "Top 10: 1 Corey Day, 2 Carson Kvapil", "Top finishers: 1. Chandler
 * Smith; 2. Layne Riggs" and Formula E's "Group A: 1 A. da Costa 1:15.157, 2 M. Evans +0.105".
 * Read only when no table is found, and the run stops at the first place that is not the next one.
 */
function inlineLists(text: string): { groups: { name: string | null; reads: Read[] }[]; out: ClassifiedOut[] } {
  const groups: { name: string | null; reads: Read[] }[] = []
  for (const found of text.matchAll(/\b(Top \d+|Top finishers|Group [A-Z])(?:\s*\([^)]*\))?:\s*([^\r\n]+)/g)) {
    const reads: Read[] = []
    for (const item of found[2].split(/[;,]\s*/)) {
      const place = item.match(/^(\d{1,2})\.?\s+(.+)$/)
      if (!place || Number(place[1]) !== reads.length + 1) break
      const body = sentenceEnd(place[2])
      const timed = body.match(/^(.+?)\s+(\+?\d[\d:.]*)$/)
      reads.push({ position: place[1], note: null, entry: { name: (timed?.[1] ?? body).trim(), team: null, time: timing(timed?.[2]) } })
      if (body !== place[2].replace(/\.$/, "").trim()) break
    }
    groups.push({ name: found[1].startsWith("Group") ? found[1] : null, reads })
  }
  const stopped = text.match(/\bDNFs?:\s*([^\r\n]+)/)
  const out = stopped ? sentenceEnd(stopped[1]).split(/,\s*|\s+and\s+/).filter(Boolean).map((name): ClassifiedOut => ({ name: name.trim(), team: null, status: "DNF", note: null })) : []
  return { groups: groups.filter((group) => group.reads.length > 0), out }
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

  const piped = headedRows(rows)
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
    // Formula E's qualifying ends in a duel, and its winner takes pole: "Final: Mortara (1:12.341) bt da Costa".
    const duel = row.match(/^Final:\s*(.+?)\s*\([^)]*\).*?\s(?:bt|def\.)\s/)
    if (duel) { pole = duel[1].trim(); continue }
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

  if (piped.length === 0 && groups.every((group) => group.reads.length === 0)) {
    const inline = inlineLists(text)
    if (inline.groups.length > 0) groups.splice(0, groups.length, ...inline.groups)
    out.push(...inline.out)
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
  // Each row states its own place, so a driver missing from the source's player list leaves a
  // visible gap (Xfinity at Las Vegas has no 18th) instead of pushing everyone after into "out".
  if (reads.length < 3 || reads[0].position !== "1" || new Set(reads.map((read) => read.position)).size !== reads.length) return null
  const entries = reads.map((read) => ({ position: Number(read.position), ...read.entry }))
  const out = listed.filter((row) => stopped(row.detail)).map((row): ClassifiedOut => ({ name: row.name, team: null, status: row.detail.toUpperCase(), note: null }))
  return { entries, ...(out.length > 0 ? { out } : {}) }
}

/** A pasted table has the teams and the results endpoint has the player records, so each fills the other. */
function linked(race: RaceResult, rows: RawResult[] | null | undefined): RaceResult {
  const records = (rows ?? []).flatMap((row) => (row.strPlayer && row.idPlayer ? [{ name: row.strPlayer.trim(), id: row.idPlayer, words: fold(row.strPlayer).split(/\s+/) }] : []))
  // A pasted "Kimi Antonelli" is the record "Andrea Kimi Antonelli": the same surname, and every
  // word of the shorter name in the longer. The record's spelling is kept, so practice, qualifying
  // and race name the driver the same way.
  const recordOf = (name: string) => {
    const words = fold(name).split(/\s+/)
    const exact = records.find((record) => record.words.join(" ") === words.join(" "))
    if (exact) return exact
    const close = records.filter((record) => record.words.at(-1) === words.at(-1) && (words.every((word) => record.words.includes(word)) || record.words.every((word) => words.includes(word))))
    return close.length === 1 ? close[0] : null
  }
  return {
    ...race,
    entries: race.entries.map((entry) => {
      const record = entry.name.includes("/") ? null : recordOf(entry.name)
      return record ? { ...entry, name: record.name, playerId: record.id } : entry
    }),
  }
}

// WEC writes "Qualifying - Hypercar" and also "Hyperpole LMGT3"; IMSA's classes are GTP, LMP2, GTD Pro and GTD.
/**
 * A pasted "Top 10" over a 22-car session loses twelve places the results endpoint holds. The
 * longer order wins, and keeps the pasted teams, laps and grid, its pole, fastest lap and table.
 * A pasted multi-class table always stays: the endpoint has one order for every class.
 */
function fuller(pasted: RaceResult, listed: RaceResult | null): RaceResult {
  if (!listed || pasted.classes || pasted.className || listed.entries.length <= pasted.entries.length) return pasted
  const byName = new Map(pasted.entries.map((entry) => [fold(entry.name), entry]))
  const entries = listed.entries.map((entry) => {
    const known = byName.get(fold(entry.name))
    return known && known.position === entry.position ? { ...known, ...entry, team: known.team, time: known.time ?? entry.time } : entry
  })
  return { ...pasted, entries, ...(listed.out || pasted.out ? { out: listed.out ?? pasted.out } : {}) }
}

const CLASS_IN_TITLE = /\s+(?:[-–]\s+)?((?:Hypercar|LMGT3|LMP2|GTP|GTD Pro|GTD)(?:\s*&\s*(?:Hypercar|LMGT3|LMP2|GTP|GTD Pro|GTD))?)$/i
// Supercars name each qualifying after the race it sets the grid for: "Qualifying Race 33".
const FOR_RACE = /\s+Race\s+\d+$/i

/**
 * Every title layout in the 2026 seasons of the major series. Rally stages ("SS12"), warm-ups,
 * pre-season running ("Valencia Test", "Roar Before The Rolex 24") and SBK's Superpole Race
 * each have a title of their own, and none of them is the weekend's race.
 */
export function sessionOf(title: string): { session: MotorsportSession; number: number | null; weekend: string; className: string | null } {
  const className = title.match(CLASS_IN_TITLE)?.[1] ?? null
  const name = title.replace(CLASS_IN_TITLE, "").replace(/\s+/g, " ").trim()
  if (/^Roar Before\b|\bPrologue\b/i.test(name)) return { session: "testing", number: null, weekend: name.replace(/\s+(?:Morning|Afternoon|Night)?\s*Session$/i, ""), className }
  const qualifying = name.replace(FOR_RACE, "")
  const found: [string, RegExp, MotorsportSession][] = [
    [name, /\s*\b(?:(?:High Line and )?Final\s+)?(?:Free Practice|Practice|FP|Warm[- ]?Up|Shakedown)\s*(\d)?$/i, "practice"],
    [name, /\s*\bTest(?:ing)?\s*\d?\s*(?:Day\s*(\d))?$/i, "testing"],
    [name, /\s*\bSS\s?(\d{1,2})$|\s*\bPower Stage$/i, "stage"],
    [name, /\s*\bSprint Qualifying\s*(\d)?$/i, "sprint-qualifying"],
    [qualifying, /\s*\b(?:Hyperpole\s+)?(?:Top 10 Shootout|Qualifying|Qualifing|Hyperpole|Shootout|Superpole)\s*Q?(\d)?$/i, "qualifying"],
    [name, /\s*\b(?:Sprint(?: Race)?|Superpole Race)\s*(\d)?$/i, "sprint"],
  ]
  for (const [text, pattern, session] of found) {
    const match = text.match(pattern)
    if (match) return { session, number: match[1] ? Number(match[1]) : null, weekend: text.slice(0, match.index).trim() || text, className }
  }
  // "Race 2", F2's "Feature Race" and MotoGP's "Thailand GP" end in words the other sessions lack.
  const heat = name.match(/\s+(?:Feature\s+)?Race\s*(\d+)$|\s+Feature Race$|\s+GP$/i)
  return { session: "race", number: heat?.[1] ? Number(heat[1]) : null, weekend: heat ? name.slice(0, heat.index).trim() || name : name, className }
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
  const race = pasted ? fuller(linked(pasted, raw.resultRows), raceFromRows(raw.resultRows)) : raceFromRows(raw.resultRows)
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
