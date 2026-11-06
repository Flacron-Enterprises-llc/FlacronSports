// Combat sports: one record is a whole card or a single bout. Cards carry a pasted bout
// table, single bouts carry a sentence or two, and names sit in the title. Only checked
// facts leave this file: provider prose can name other publishers, and one sampled card
// contradicted itself, so when the sentence and the table disagree neither is believed.

import type { RawEvent, RawResult } from "../thesportsdb"
import type { CombatBout, CombatDetails, CombatDiscipline, CombatMethod, EventScore, EventStatus, SportEvent } from "../types"

type Combat = Omit<Extract<EventScore, { kind: "combat" }>, "kind">

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

/** A card title may give only a surname; two full names must match outright. */
function sameFighter(a: string, b: string): boolean {
  const [x, y] = [fold(a), fold(b)]
  return x === y || x.endsWith(` ${y}`) || y.endsWith(` ${x}`)
}

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim())

/** "UFC 333 A vs B" names its card and headliners. A title with no number has no safe split. */
export function parseCard(title: string, isSingleBout: boolean): { card: string | null; names: [string, string] } | null {
  // A rematch is written "Name vs Name 2" or "Name vs Name II".
  const text = title.replace(/\s+(?:II|III|IV|\d)\s*$/, "")
  const carded = text.match(/^(.*\d)\s+(\S.*?)\s+vs\.?\s+(.+)$/)
  if (carded) return { card: carded[1].trim(), names: [carded[2].trim(), carded[3].trim()] }
  const single = isSingleBout ? text.match(/^(\D+?)\s+vs\.?\s+(\D+)$/) : null
  return single ? { card: null, names: [single[1].trim(), single[2].trim()] } : null
}

function combatMethod(text: string): CombatMethod | null {
  const value = text.toLowerCase()
  if (/unanimous/.test(value)) return "unanimous-decision"
  if (/split/.test(value)) return "split-decision"
  if (/majority/.test(value)) return "majority-decision"
  if (/decision/.test(value)) return "decision"
  if (/\btko\b|technical knockout|stoppage|\bstopp?(?:ed)?\b|threw in the towel/.test(value)) return "tko"
  if (/\bko\b|knockout|knocked out/.test(value)) return "ko"
  if (/submission/.test(value)) return "submission"
  if (/disqualif/.test(value)) return "disqualification"
  return null
}

interface Bout {
  winner: string
  loser: string
  method: CombatMethod | null
  round: number | null
  time: string | null
}

// ONE puts the fighter's country in the same cell as the name.
const NATION = /^(?:Argentina|Australia|Austria|Brazil|Bulgaria|Cambodia|Canada|China|England|France|Germany|Great Britain|India|Indonesia|Iran|Ireland|Italy|Japan|Kazakhstan|Kyrgyzstan|Laos|Malaysia|Mexico|Mongolia|Myanmar|Netherlands|New Zealand|Philippines|Poland|Russia|Scotland|Singapore|South Korea|Spain|Sweden|Thailand|Turkey|Ukraine|United Kingdom|United States|Uzbekistan|Vietnam)\s+/
const cleanName = (name: string) => name.replace(/\([^)]*\)/g, "").replace(NATION, "").replace(/\s+/g, " ").trim()
/** Names read by name, so the order in a row can never give the winner away. */
const pair = (a: string, b: string): [string, string] => (a.localeCompare(b) <= 0 ? [a, b] : [b, a])

interface TableBout extends Bout {
  weightClass: string | null
  scorecards: string | null
  champion: boolean
  section: CombatBout["section"]
}

function sectionOf(row: string, current: CombatBout["section"]): CombatBout["section"] {
  if (/^main card\b/i.test(row)) return "main"
  return /^(?:early )?prelim/i.test(row) ? "preliminary" : current
}

/** A card announced but not fought: the same table with "vs." where the result goes. */
function plannedBouts(rows: string[]): CombatBout[] {
  let section: CombatBout["section"] = null
  return rows.flatMap((row) => {
    section = sectionOf(row, section)
    const cells = row.split("\t").map((cell) => cell.trim())
    const at = cells.indexOf("vs.")
    if (at < 1 || !cells[at + 1]) return []
    return [{ names: pair(cleanName(cells[at - 1]), cleanName(cells[at + 1])), winner: null, method: null, round: null, time: null, weightClass: at >= 2 ? cells[at - 2] || null : null, scheduledRounds: null, section, scorecards: null }]
  })
}

const LIST_ROW = /^(?:(?:main event|co-main(?: event)?|[A-Z][\w' -]*?weight)\s*:\s*)?(.+?)\s+def\.\s+(.+?)(?:\s+-\s+|\s+by\s+|,\s*)(.+)$/i

/** "Name def. Name - TKO (slam), R5 1:38 (Main Event)", and the same with "by" or "Round 2, 0:13". */
function listBout(row: string): TableBout | null {
  const match = row.includes("\t") ? null : row.match(LIST_ROW)
  if (!match) return null
  const how = match[3]
  const round = how.match(/\b(?:R|Round\s+)(\d{1,2})\b/i)
  const weight = row.match(/^([A-Z][\w' -]*?weight)\s*:/i)?.[1]
  return {
    winner: cleanName(match[1]), loser: cleanName(match[2]), method: combatMethod(how), round: round ? Number(round[1]) : null,
    time: how.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? null, weightClass: weight ?? null,
    scorecards: how.match(/\((\d{2}-\d{2}(?:,\s*\d{2}-\d{2})+)\)/)?.[1] ?? null, champion: false, section: null,
  }
}

function tableBouts(rows: string[]): TableBout[] {
  let section: CombatBout["section"] = null
  return rows.flatMap((row): TableBout[] => {
    section = sectionOf(row, section)
    const cells = row.split("\t").map((cell) => cell.trim())
    const at = cells.indexOf("def.")
    if (at < 1) {
      const listed = listBout(row)
      return listed ? [listed] : []
    }
    const round = Number(cells[at + 3])
    const decision = cells[at + 2]?.match(/\(([\d–-]+(?:,\s*[\d–-]+)+)\)/)?.[1]
    return [{
      winner: cleanName(cells[at - 1]),
      loser: cleanName(cells[at + 1]),
      method: combatMethod(cells[at + 2] ?? ""),
      round: Number.isInteger(round) && round > 0 ? round : null,
      time: /^\d+:\d{2}$/.test(cells[at + 4] ?? "") ? cells[at + 4] : null,
      weightClass: at >= 2 ? cells[at - 2] || null : null,
      scorecards: decision?.replace(/–/g, "-") ?? null,
      champion: /\(c\)/.test(cells[at - 1]),
      section,
    }]
  })
}

/**
 * The results endpoint numbers each bout and marks WIN or LOSS. It has listed a fighter on
 * both sides of two bouts on one card, so only a clean pair counts, and it stands in only
 * when an event has no result text at all.
 */
export function boutsFromRows(rows: RawResult[] | null | undefined): TableBout[] {
  const bouts = new Map<string, RawResult[]>()
  const seen = new Map<string, number>()
  for (const row of rows ?? []) {
    const key = String(row.intPosition)
    bouts.set(key, [...(bouts.get(key) ?? []), row])
    if (row.strPlayer) seen.set(row.strPlayer, (seen.get(row.strPlayer) ?? 0) + 1)
  }
  return [...bouts.values()].flatMap((group) => {
    const winner = group.find((row) => row.strDetail === "WIN")?.strPlayer
    const loser = group.find((row) => row.strDetail === "LOSS")?.strPlayer
    if (group.length !== 2 || !winner || !loser || seen.get(winner) !== 1 || seen.get(loser) !== 1) return []
    return [{ winner, loser, method: null, round: null, time: null, weightClass: null, scorecards: null, champion: false, section: null }]
  })
}

const ORDINALS: Record<string, number> = { opening: 1, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 }

function roundOf(text: string): number | null {
  const match = text.match(/\b(opening|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d{1,2}(?:st|nd|rd|th))[- ]round\b|\bround (\d{1,2})\b/i)
  if (!match) return null
  const word = (match[1] ?? match[2]).toLowerCase()
  return ORDINALS[word] ?? (Number.parseInt(word, 10) || null)
}

const VERBS = /\b(?:def\.|defeat|defeated|defeats|beat|beats|dethroned|stopped|stop|knocked out|outpointed|stoppage of|knockout of|decision over|victory over|win over|won over)\b/

/** The opening sentence, which is where the source states the outcome. */
function proseBout(rows: string[], names: [string, string] | null): Bout | null {
  const first = rows.find((row) => row && !row.includes("\t"))
  if (!first) return null
  const sentence = first.split(/(?<!\bdef)(?<=[a-z)])\.\s/)[0]
  const stated = sentence.match(/^(.+?)\s+(?:def\.|defeated|beat|dethroned|stopped|knocked out|outpointed)\s+(.+?)\s+by\s+(.+?)(?:[.,]|\s+in\s|\s+to\s|$)/)
  if (stated) return { winner: cleanName(stated[1]), loser: cleanName(stated[2]), method: combatMethod(stated[3]), round: roundOf(first), time: first.match(/\bat (\d{1,2}:\d{2})\b/)?.[1] ?? null }
  if (!names || !VERBS.test(sentence)) return null
  // Otherwise the winner comes before the verb and the other name after it.
  const [a, b] = names
  const verb = sentence.search(VERBS)
  const surname = (name: string) => fold(name).split(" ").at(-1) as string
  const [before, after] = [fold(sentence.slice(0, verb)), fold(sentence.slice(verb))]
  const wins = (name: string, other: string) => before.includes(surname(name)) && !before.includes(surname(other)) && after.includes(surname(other))
  const winner = wins(a, b) ? a : wins(b, a) ? b : null
  if (!winner) return null
  return { winner, loser: winner === a ? b : a, method: combatMethod(sentence), round: roundOf(first), time: first.match(/\bat (\d{1,2}:\d{2})\b/)?.[1] ?? null }
}

/**
 * A result needs the winner and the loser to be the two named fighters. When the
 * prose and the bout table disagree, neither is believed.
 */
export function parseCombatResult(text: string | null | undefined, names: [string, string]): Combat | null {
  if (!text) return null
  const rows = lines(text)
  const concerns = (bout: Bout) =>
    (sameFighter(bout.winner, names[0]) && sameFighter(bout.loser, names[1])) ||
    (sameFighter(bout.winner, names[1]) && sameFighter(bout.loser, names[0]))

  const tabled = tableBouts(rows).find(concerns)
  const prose = proseBout(rows, names)
  const told = prose && concerns(prose) ? prose : null
  if (tabled && told && !sameFighter(tabled.winner, told.winner)) return null

  const bout = tabled ?? told
  if (!bout) return null
  const winner = sameFighter(bout.winner, names[0]) ? names[0] : names[1]
  return { winner, method: bout.method ?? told?.method ?? null, round: bout.round, time: bout.time }
}

const WORD_ROUNDS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12 }

function scheduledRounds(text: string): number | null {
  const match = text.match(/\b(three|four|five|six|eight|ten|twelve|\d{1,2})[- ]rounds?\b(?! of)|\((\d{1,2}) rounds\)/i)
  if (!match) return null
  const word = (match[1] ?? match[2]).toLowerCase()
  return WORD_ROUNDS[word] ?? (Number(word) || null)
}

const WEIGHT = /\b((?:women's\s+)?(?:(?:super|junior|light)[- ])?(?:strawweight|atomweight|flyweight|bantamweight|featherweight|lightweight|welterweight|middleweight|cruiserweight|heavyweight|catchweight))\b/i
const TITLE = /\b((?:vacant\s+)?(?:WBC|WBA|WBO|IBF|UFC|BKFC|OKTAGON|ONE)\b[\w' -]*?\b(?:title|championship|belt))\b/

function disciplineOf(league: string | null | undefined): CombatDiscipline | null {
  const name = league ?? ""
  if (/^boxing$|top rank/i.test(name)) return "boxing"
  if (/bkfc/i.test(name)) return "bare-knuckle"
  if (/kickboxing|glory|k-1|\brise\b/i.test(name)) return "kickboxing"
  if (/muay thai/i.test(name)) return "muay-thai"
  return /^one$/i.test(name) ? null : "mma"
}

const cased = (text: string) => text.replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/'S\b/g, "'s")
const hidesResult = (status: EventStatus) => status === "scheduled" || status === "postponed" || status === "canceled"
const competitor = (name: string) => ({ id: null, name, role: "competitor" as const, badgeUrl: null })
const count = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value))

/** "BKFC 96 Glasgow Weir vs Cohoon" runs a place into the name. The preview text settles it. */
function trimmedNames(names: [string, string], text: string): [string, string] {
  return names.map((name) => {
    const last = name.split(/\s+/).at(-1) as string
    return name !== last && text && !text.includes(name) && text.includes(last) ? last : name
  }) as [string, string]
}

export function combatFields(raw: RawEvent, infer: (settled: boolean) => EventStatus): Pick<SportEvent, "eventType" | "participantType" | "participants" | "eventName" | "status" | "score" | "details"> {
  const title = raw.strEvent?.trim() || null
  const single = /^boxing$/i.test(raw.strLeague ?? "")
  const found = title ? parseCard(title, single) : null
  const text = raw.strResult ?? ""
  const parsed = found ? { ...found, names: trimmedNames(found.names, `${raw.strDescriptionEN ?? ""} ${text}`) } : null
  const rows = lines(text)
  const stated = tableBouts(rows)
  const table = stated.length > 0 || text.trim() ? stated : boutsFromRows(raw.resultRows)
  const fromRows = !text.trim() && parsed ? table.find((bout) => parsed.names.some((name) => sameFighter(bout.winner, name)) && parsed.names.some((name) => sameFighter(bout.loser, name))) : undefined
  const result = parsed ? parseCombatResult(text, parsed.names) ?? (fromRows ? { winner: parsed.names.find((name) => sameFighter(fromRows.winner, name)) as string, method: null, round: null, time: null } : null) : null
  const prose = parsed ? proseBout(rows, parsed.names) : null
  // A sentence that says the opposite of the table's headline bout discredits the table.
  const headline = parsed ? table.find((bout) => [parsed.names[0], parsed.names[1]].every((name) => sameFighter(bout.winner, name) || sameFighter(bout.loser, name))) : null
  const tableStands = !(headline && prose && (sameFighter(prose.winner, parsed?.names[0] ?? "") || sameFighter(prose.winner, parsed?.names[1] ?? "")) && !sameFighter(headline.winner, prose.winner))

  const status = infer(Boolean(result) || (tableStands && table.length > 0))
  const about = `${raw.strDescriptionEN ?? ""} ${text}`
  const rounds = scheduledRounds(about)
  const weight = about.match(WEIGHT)?.[1]
  const shown = !hidesResult(status)

  const planned = plannedBouts(rows)
  const bouts: CombatBout[] = planned.length > 0 && table.length === 0 ? planned : table.length > 0
    ? table.map((bout) => ({ names: pair(bout.winner, bout.loser), winner: shown && tableStands ? bout.winner : null, method: shown && tableStands ? bout.method : null, round: shown && tableStands ? bout.round : null, time: shown && tableStands ? bout.time : null, weightClass: bout.weightClass, scheduledRounds: null, section: bout.section, scorecards: shown && tableStands ? bout.scorecards : null }))
    : parsed
      ? [{ names: pair(parsed.names[0], parsed.names[1]), winner: shown ? result?.winner ?? null : null, method: shown ? result?.method ?? null : null, round: shown ? result?.round ?? null : null, time: shown ? result?.time ?? null : null, weightClass: weight ? cased(weight) : null, scheduledRounds: rounds, section: null, scorecards: null }]
      : []

  const details: CombatDetails = {
    kind: "combat",
    discipline: disciplineOf(raw.strLeague),
    card: parsed?.card ?? (parsed ? null : title),
    bouts,
    weightClass: table[0]?.weightClass ?? (weight ? cased(weight) : null),
    scheduledRounds: rounds,
    title: (raw.strDescriptionEN ?? "").match(TITLE)?.[1] ?? null,
    city: raw.strCity?.trim() || null,
    country: raw.strCountry?.trim() || null,
    season: raw.strSeason?.trim() || null,
    spectators: count(raw.intSpectators),
  }
  return {
    eventType: parsed && !parsed.card ? "bout" : "fight-card",
    participantType: "individual",
    participants: parsed ? parsed.names.map(competitor) : [],
    eventName: parsed ? parsed.card : title,
    status,
    score: result && shown ? { kind: "combat", ...result } : { kind: "none" },
    details,
  }
}
