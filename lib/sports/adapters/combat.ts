// Combat sports: one record is a whole card or a single bout. Cards carry a pasted bout
// table or a results list, single bouts carry a sentence or two, and names sit in the title.
// Only checked facts leave this file: provider prose can name other publishers, and one
// sampled card contradicted itself, so when the sentence and the table disagree neither is believed.

import type { RawEvent, RawResult } from "../thesportsdb"
import type { CombatBout, CombatDetails, CombatDiscipline, CombatMethod, EventScore, EventStatus, SportEvent } from "../types"

type Combat = Omit<Extract<EventScore, { kind: "combat" }>, "kind">

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

/** A card title may give only a surname, or a given name for fighters known by it; two full names must match outright. */
function sameFighter(a: string, b: string): boolean {
  const [x, y] = [fold(a), fold(b)]
  return x === y || x.endsWith(` ${y}`) || y.endsWith(` ${x}`) || x.startsWith(`${y} `) || y.startsWith(`${x} `)
}

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim())

const REMATCH = /\s+(?:II|III|IV|\d)\s*$/

/** "UFC 333 A vs B" names its card and headliners. A title with no number has no safe split. */
export function parseCard(title: string, isSingleBout: boolean): { card: string | null; names: [string, string] } | null {
  // A rematch is written "Name vs Name 2" or "Name vs Name II".
  const text = title.replace(REMATCH, "")
  const carded = text.match(/^(.*\d)\s+(\S.*?)\s+vs\.?\s+(.+)$/)
  if (carded) return { card: carded[1].trim(), names: [carded[2].trim(), carded[3].trim()] }
  const single = isSingleBout ? text.match(/^(\D+?)\s+vs\.?\s+(\D+)$/) : null
  return single ? { card: null, names: [single[1].trim(), single[2].trim()] } : null
}

/**
 * "PFL Chicago Carmouche vs Bishop" has no number to split on. The source's own text
 * settles it: the longest tail before "vs" that the text names is the fighter.
 */
function namedCard(title: string, text: string): { card: string; names: [string, string] } | null {
  const match = title.replace(REMATCH, "").match(/^(.+?)\s+vs\.?\s+(.+)$/)
  const known = fold(text)
  if (!match || !known.includes(fold(match[2]))) return null
  const words = match[1].trim().split(/\s+/)
  for (let take = Math.min(3, words.length - 1); take >= 1; take--) {
    const name = words.slice(-take).join(" ")
    if (known.includes(fold(name))) return { card: words.slice(0, -take).join(" "), names: [name, match[2].trim()] }
  }
  return null
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

const DECIDED = new Set<CombatMethod>(["unanimous-decision", "split-decision", "majority-decision", "decision"])
const SCORE = String.raw`\d{2,3}[-–]\d{2,3}`
const JOIN = String.raw`(?:\s*,\s*|,?\s+and\s+)`

/** "(30–27, 29–28, 29–28)", "115-112, 116-111 and 117-110", "49-46 x3" and "all three scorecards 48-47". */
function scorecardsOf(text: string): string | null {
  const dash = (score: string) => score.replace(/–/g, "-")
  const same = text.match(new RegExp(String.raw`\b(${SCORE})\s*x\s*3\b`, "i")) ?? text.match(new RegExp(String.raw`\ball three (?:scorecards|judges)\D{0,25}\b(${SCORE})\b`, "i"))
  if (same) return Array(3).fill(dash(same[1])).join(", ")
  const three = text.match(new RegExp(String.raw`\b(${SCORE})${JOIN}(${SCORE})${JOIN}(${SCORE})\b`))
  return three ? three.slice(1, 4).map(dash).join(", ") : null
}

interface Bout {
  winner: string
  loser: string
  method: CombatMethod | null
  round: number | null
  time: string | null
  scorecards?: string | null
}

// ONE, Rizin and Glory put the fighter's country in the same cell as the name.
const NATIONS = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahrain", "Belarus", "Belgium", "Bolivia",
  "Bosnia and Herzegovina", "Brazil", "Bulgaria", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Chile", "China", "Chinese Taipei", "Colombia",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt", "England", "Estonia", "Finland",
  "France", "Georgia", "Germany", "Ghana", "Great Britain", "Greece", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Lithuania", "Macau", "Malaysia", "Mexico", "Moldova", "Mongolia", "Montenegro", "Morocco", "Myanmar", "Nepal", "Netherlands", "New Zealand",
  "Nigeria", "North Macedonia", "Northern Ireland", "Norway", "Pakistan", "Panama", "Peru", "Philippines", "Poland", "Portugal", "Puerto Rico",
  "Qatar", "Romania", "Russia", "Saudi Arabia", "Scotland", "Senegal", "Serbia", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea",
  "Spain", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Thailand", "Tunisia", "Turkey", "Turkmenistan", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Wales",
].sort((a, b) => b.length - a.length)
const NATION = new RegExp(`^(?:${NATIONS.join("|")})\\s+(?=\\S)`)
const bare = (name: string) => name.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim()
// Countries that are also given names come off only on a table that writes a country before most names.
const GIVEN_NAMES = new Set(["Georgia", "India", "Israel", "Jordan", "Kenya"])
/** "Croatia Stjepan Bekavac" loses the country, but "Israel Adesanya" keeps his first name. */
function cleanName(name: string, nations = false): string {
  const plain = bare(name)
  const country = plain.match(NATION)?.[0].trim()
  return country && (nations || !GIVEN_NAMES.has(country)) ? plain.replace(NATION, "") : plain
}
/** Names read by name, so the order in a row can never give the winner away. */
const pair = (a: string, b: string): [string, string] => (a.localeCompare(b) <= 0 ? [a, b] : [b, a])

interface TableBout extends Bout {
  weightClass: string | null
  scorecards: string | null
  section: CombatBout["section"]
  outcome: CombatBout["outcome"]
  title: string | null
  titleFight: boolean
  note: string | null
  /** Marked as the main event, or the top row of a results table, which is how those tables run. */
  lead: boolean
}

const cased = (text: string) => text.replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/'S\b/g, "'s")
const PRELIM = /^(?:early )?prelim/i

function sectionOf(row: string, current: CombatBout["section"], split: boolean): CombatBout["section"] {
  if (/^main card\b/i.test(row)) return "main"
  if (PRELIM.test(row)) return "preliminary"
  // "Fight card" heads the main card only when a preliminary card follows it.
  return split && /^(?:fight card|main event|co-main)\b/i.test(row) ? "main" : current
}

/** "For the ONE Lightweight World Championship." is the belt; anything else is a note. */
function notesOf(text: string | undefined): Pick<TableBout, "title" | "note"> {
  const value = (text ?? "").trim().replace(/\.$/, "")
  const belt = value.match(/^For the (.+\b(?:title|championship|belt))$/i)?.[1]
  return { title: belt ?? null, note: belt || !value ? null : value }
}

const OUTCOME = /^((?:split |majority |unanimous |technical )?draw|no contest)\b/i
const outcomeOf = (text: string): CombatBout["outcome"] => (/no contest/i.test(text) ? "no-contest" : "draw")

/** Whether a table writes a country before most fighters. */
function flagged(rows: string[]): boolean {
  const names = rows.flatMap((row) => {
    const cells = row.split("\t").map((cell) => cell.trim())
    const at = cells.findIndex((cell) => cell === "def." || cell === "vs.")
    return at >= 1 ? [cells[at - 1], cells[at + 1] ?? ""] : []
  })
  return names.length > 0 && names.filter((name) => NATION.test(name)).length * 2 > names.length
}

/** A card announced but not fought: the same table with "vs." where the result goes, or "83.9 kg — A (17–1) vs B (14–5) – title fight". */
function plannedBouts(rows: string[]): CombatBout[] {
  const split = rows.some((row) => PRELIM.test(row))
  const nations = flagged(rows)
  let section: CombatBout["section"] = null
  return rows.flatMap((row): CombatBout[] => {
    section = sectionOf(row, section, split)
    const cells = row.split("\t").map((cell) => cell.trim())
    const at = cells.indexOf("vs.")
    if (at >= 1 && cells[at + 1] && !cells.slice(at + 2).some((cell) => OUTCOME.test(cell))) {
      const { title, note } = notesOf(cells.slice(at + 2).find(Boolean))
      return [{ names: pair(cleanName(cells[at - 1], nations), cleanName(cells[at + 1], nations)), winner: null, method: null, round: null, time: null, weightClass: at >= 2 ? cells[at - 2] || null : null, scheduledRounds: null, section, scorecards: null, title, titleFight: Boolean(title) || /\(c\)/.test(row), note }]
    }
    const listed = row.includes("\t") ? null : row.match(/^(\d+(?:\.\d+)?\s*kg|[A-Z][\w' ]*?weight(?:\s*\([^)]*\))?)\s+[—–-]\s+(.+?)\s+vs\.?\s+(.+?)(?:\s+[—–]\s+(.+))?$/i)
    if (!listed) return []
    const about = listed[4]?.trim() ?? null
    const title = about && /\b(?:title|championship|belt)\b/i.test(about) ? about.replace(/\s+fight$/i, "") : null
    return [{ names: pair(cleanName(listed[2]), cleanName(listed[3])), winner: null, method: null, round: null, time: null, weightClass: listed[1], scheduledRounds: null, section, scorecards: null, title, titleFight: Boolean(title), note: title ? null : about }]
  })
}

/** One results line can hold a whole card, so it is read clause by clause. "def." and "Jr." do not end a clause. */
const clauses = (row: string) => row.split(/;\s+|(?<!\b(?:def|vs|Jr|Sr|St|Mt|No|Dr))\.\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean)
const LABEL = /^([^:]{1,60}?):\s+(?=.*\s(?:def\.|vs\.?)\s)/i
const WON = /^(.+?)\s+def\.\s+(.+?)(?:(?:\s+-\s+|\s+by\s+|\s+via\s+|,\s*)(.+))?$/i
const DREW = /^(.+?)\s+vs\.?\s+(.+?)\s+[-–]\s+(.+)$/i
const WEIGHT_LABEL = /((?:women's\s+)?(?:(?:super|junior|light)[- ])?[a-z]*weight(?:\s*\(\d[^)]*\))?)/i

/** "Main Event (Light Heavyweight): A def. B via TKO (R2, 3:38)", "A def. B - TKO, R3 (UK Middleweight Title)", "A vs. B - Split Draw (29-27, 27-29, 28-28)". */
function listBout(clause: string): Omit<TableBout, "section"> | null {
  const label = clause.match(LABEL)?.[1] ?? ""
  const body = label ? clause.slice(clause.indexOf(":") + 1).trim() : clause
  const won = body.match(WON)
  const drew = won ? null : body.match(DREW)
  if (!won && !(drew && OUTCOME.test(drew[3]))) return null
  const [first, second] = won ? [won[1], won[2]] : [drew![1], drew![2]]
  const how = won ? won[3] ?? second.match(/\(([^)]*)\)/)?.[1] ?? "" : drew![3]
  const round = how.match(/(?<!before )\b(?:R|Round\s+)(\d{1,2})\b/i)
  const method = won ? combatMethod(how) : null
  // "(Middleweight Title, Main Event)" holds the belt and the billing together.
  const billed = how.match(/\(([^()]*\b(?:title|championship)\b[^()]*)\)/i)?.[1].split(/\s*,\s*/).filter((part) => /\b(?:title|championship)\b/i.test(part)).join(", ")
  const title = billed || how.match(TITLE)?.[1] || null
  const weight = label.match(WEIGHT_LABEL)?.[1] ?? how.match(WEIGHT)?.[1]
  return {
    winner: cleanName(first), loser: cleanName(second), method, round: round ? Number(round[1]) : null,
    time: how.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? null, weightClass: weight ? cased(weight) : null,
    scorecards: !won || (method && DECIDED.has(method)) ? scorecardsOf(how) : null,
    outcome: won ? null : outcomeOf(drew![3]), title, titleFight: Boolean(title), note: null,
    lead: /main event/i.test(label) || /\([^()]*\bmain event\b[^()]*\)/i.test(how),
  }
}

function tableBouts(rows: string[]): TableBout[] {
  const split = rows.some((row) => PRELIM.test(row)) || /\bprelim(?:s|inary card)?\s*:/i.test(rows.join(" "))
  const nations = flagged(rows)
  let section: CombatBout["section"] = null
  let tabled = 0
  return rows.flatMap((row): TableBout[] => {
    section = sectionOf(row, section, split)
    const cells = row.split("\t").map((cell) => cell.trim())
    const won = cells.indexOf("def.")
    const drawn = won < 1 ? cells.indexOf("vs.") : -1
    const at = won >= 1 ? won : drawn >= 1 && OUTCOME.test(cells[drawn + 2] ?? "") ? drawn : -1
    if (at < 1) {
      if (row.includes("\t")) return []
      return clauses(row).flatMap((clause) => {
        section = sectionOf(clause, section, split)
        const listed = listBout(clause)
        return listed ? [{ ...listed, section }] : []
      })
    }
    const round = Number(cells[at + 3])
    const method = won >= 1 ? combatMethod(cells[at + 2] ?? "") : null
    const champion = /\(c\)/.test(`${cells[at - 1]} ${cells[at + 1]}`)
    const notes = notesOf(cells[at + 5])
    tabled += 1
    return [{
      winner: cleanName(cells[at - 1], nations),
      loser: cleanName(cells[at + 1], nations),
      method,
      round: Number.isInteger(round) && round > 0 ? round : null,
      time: /^\d+:\d{2}$/.test(cells[at + 4] ?? "") ? cells[at + 4] : null,
      weightClass: at >= 2 ? cells[at - 2] || null : null,
      scorecards: scorecardsOf(cells[at + 2] ?? ""),
      outcome: won >= 1 ? null : outcomeOf(cells[at + 2]),
      ...notes,
      titleFight: champion || Boolean(notes.title),
      section,
      lead: tabled === 1,
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
    return [{ winner, loser, method: null, round: null, time: null, weightClass: null, scorecards: null, section: null, outcome: null, title: null, titleFight: false, note: null, lead: false }]
  })
}

const ORDINALS: Record<string, number> = { opening: 1, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 }

function roundOf(text: string): number | null {
  const match = text.match(/\b(opening|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d{1,2}(?:st|nd|rd|th))[- ]round\b|\bround (\d{1,2})\b/i)
  if (!match) return null
  const word = (match[1] ?? match[2]).toLowerCase()
  return ORDINALS[word] ?? (Number.parseInt(word, 10) || null)
}

const VERBS = /\b(?:def\.|defeat|defeated|defeats|beat|beats|dethroned|avenged|stopped|stop|knocked out|outpointed|stoppage of|knockout of|decision over|victory over|win over|won over)\b/

/**
 * The opening sentence is where the source states the outcome. A knockdown in another round
 * is often told later, so a round or time is only read for a stoppage, and from that sentence first.
 */
function proseBout(rows: string[], names: [string, string] | null): Bout | null {
  const first = rows.find((row) => row && !row.includes("\t"))
  if (!first) return null
  const sentence = first.split(/(?<!\bdef)(?<=[a-z)])\.\s/)[0]
  const finish = (method: CombatMethod | null) => {
    const stopped = Boolean(method) && !DECIDED.has(method as CombatMethod)
    return {
      round: stopped ? roundOf(sentence) ?? roundOf(first) : null,
      time: stopped ? first.match(/\bat (\d{1,2}:\d{2})\b/)?.[1] ?? null : null,
      scorecards: method && DECIDED.has(method) ? scorecardsOf(first) : null,
    }
  }
  const stated = sentence.match(/^(.+?)\s+(?:def\.|defeated|beat|dethroned|stopped|knocked out|outpointed)\s+(.+?)\s+by\s+(.+?)(?:[.,]|\s+in\s|\s+to\s|$)/)
  if (stated) {
    const method = combatMethod(stated[3])
    return { winner: cleanName(stated[1]), loser: cleanName(stated[2]), method, ...finish(method) }
  }
  if (!names || !VERBS.test(sentence)) return null
  // Otherwise the winner comes before the verb and the other name after it.
  const [a, b] = names
  const verb = sentence.search(VERBS)
  const surname = (name: string) => fold(name).split(" ").at(-1) as string
  const [before, after] = [fold(sentence.slice(0, verb)), fold(sentence.slice(verb))]
  const wins = (name: string, other: string) => before.includes(surname(name)) && !before.includes(surname(other)) && after.includes(surname(other))
  const winner = wins(a, b) ? a : wins(b, a) ? b : null
  if (!winner) return null
  const method = combatMethod(sentence)
  return { winner, loser: winner === a ? b : a, method, ...finish(method) }
}

/** The same as parseCombatResult, with the judges' cards the prose or table gives. */
function readResult(text: string | null | undefined, names: [string, string]): (Combat & { scorecards: string | null }) | null {
  if (!text) return null
  const rows = lines(text)
  const concerns = (bout: Bout) =>
    (sameFighter(bout.winner, names[0]) && sameFighter(bout.loser, names[1])) ||
    (sameFighter(bout.winner, names[1]) && sameFighter(bout.loser, names[0]))

  const tabled = tableBouts(rows).find((bout) => !bout.outcome && concerns(bout))
  const prose = proseBout(rows, names)
  const told = prose && concerns(prose) ? prose : null
  if (tabled && told && !sameFighter(tabled.winner, told.winner)) return null

  const bout = tabled ?? told
  if (!bout) return null
  const winner = sameFighter(bout.winner, names[0]) ? names[0] : names[1]
  return { winner, method: bout.method ?? told?.method ?? null, round: bout.round, time: bout.time, scorecards: bout.scorecards ?? told?.scorecards ?? null }
}

/**
 * A result needs the winner and the loser to be the two named fighters. When the
 * prose and the bout table disagree, neither is believed.
 */
export function parseCombatResult(text: string | null | undefined, names: [string, string]): Combat | null {
  const result = readResult(text, names)
  return result ? { winner: result.winner, method: result.method, round: result.round, time: result.time } : null
}

const WORD_ROUNDS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12 }

function scheduledRounds(text: string): number | null {
  const match = text.match(/\b(three|four|five|six|eight|ten|twelve|\d{1,2})[- ]rounds?\b(?! of)|\((\d{1,2}) rounds\)/i)
  if (!match) return null
  const word = (match[1] ?? match[2]).toLowerCase()
  return WORD_ROUNDS[word] ?? (Number(word) || null)
}

const WEIGHT = /\b((?:women's\s+)?(?:(?:super|junior|light)[- ])?(?:strawweight|atomweight|flyweight|bantamweight|featherweight|lightweight|welterweight|middleweight|cruiserweight|heavyweight|catchweight))\b/i
// A belt is a sanctioning body or promotion and at most four words before "title"; "title picture" is not one.
const BODY = String.raw`(?:WBC|WBA|WBO|IBF|IBO|UFC|BKFC|OKTAGON|ONE|PFL|KSW|RIZIN|LFA|GLORY|Glory|Cage Warriors|Invicta FC)`
const TITLE = new RegExp(String.raw`\b((?:(?:vacant|interim)\s+)*${BODY}(?:(?:,\s*|\s+and\s+)${BODY})*\b(?:\s+[\w'’-]+){1,4}?\s+(?:[Tt]itle|[Cc]hampionship|[Bb]elt)s?)\b(?!\s+(?:picture|contention|conversation|scene|hopes?|shot|eliminator|race|mix|contenders?))`)

function disciplineOf(league: string | null | undefined): CombatDiscipline | null {
  const name = league ?? ""
  if (/kickboxing|glory|k-1|\brise\b|\bkok\b|shoot boxing|its showtime|^ko$|^kjp$/i.test(name)) return "kickboxing"
  if (/boxing|top rank/i.test(name)) return "boxing"
  if (/bkfc/i.test(name)) return "bare-knuckle"
  if (/muay thai/i.test(name)) return "muay-thai"
  return /^one$/i.test(name) ? null : "mma"
}

/** ONE runs MMA, Muay Thai and kickboxing on one card; its weight class names the discipline. */
function boutDiscipline(weightClass: string | null | undefined): CombatDiscipline | null {
  const name = weightClass ?? ""
  if (/muay thai/i.test(name)) return "muay-thai"
  if (/kickboxing/i.test(name)) return "kickboxing"
  if (/\bmma\b/i.test(name)) return "mma"
  return /\bboxing\b/i.test(name) ? "boxing" : null
}

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

/** "Gane" becomes "Ciryl Gane" when the preview names him so. A capitalised word before the given name leaves it unsure, so the name stays. */
function namedInText(name: string, text: string): string {
  if (/\s/.test(name)) return name
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const given = text.match(new RegExp(String.raw`(?:^|[^\p{L}'’.\s-]\s*|(?:^|\s)\p{Ll}[\p{L}'’-]*\s+)(\p{Lu}\p{Ll}[\p{L}'’-]*)\s+${escaped}(?![\p{L}])`, "u"))?.[1]
  return given ? `${given} ${name}` : name
}

const fights = (bout: Bout, name: string) => sameFighter(bout.winner, name) || sameFighter(bout.loser, name)

export function combatFields(raw: RawEvent, infer: (settled: boolean) => EventStatus): Pick<SportEvent, "eventType" | "participantType" | "participants" | "eventName" | "status" | "score" | "details"> {
  const title = raw.strEvent?.trim() || null
  const single = /^boxing$/i.test(raw.strLeague ?? "")
  const text = raw.strResult ?? ""
  const about = `${raw.strDescriptionEN ?? ""} ${text}`.trim()
  const found = title ? parseCard(title, single) ?? (single ? null : namedCard(title, about)) : null
  const parsed = found ? { ...found, names: found.card ? trimmedNames(found.names, about) : found.names } : null
  const rows = lines(text)
  const stated = tableBouts(rows)
  const table = stated.length > 0 || text.trim() ? stated : boutsFromRows(raw.resultRows)
  // The headline bout is the one between the named fighters; a card named after no one is led by its main event.
  const headline = parsed ? table.find((bout) => parsed.names.every((name) => fights(bout, name))) : table.find((bout) => bout.lead)
  const prose = proseBout(rows, parsed?.names ?? (headline ? [headline.winner, headline.loser] : null))
  // A sentence that says the opposite of the table's headline bout discredits the table.
  const tableStands = !(headline && prose && fights(headline, prose.winner) && !sameFighter(headline.winner, prose.winner))

  // A title often gives only a surname or a given name; the table's full name is kept for both.
  const full = (name: string) => {
    const named = headline ? [headline.winner, headline.loser].find((item) => sameFighter(item, name)) : undefined
    return named && named.split(" ").length > name.split(" ").length ? named : namedInText(name, about)
  }
  const planned = plannedBouts(rows)
  const names: [string, string] | null = parsed ? [full(parsed.names[0]), full(parsed.names[1])] : headline ? pair(headline.winner, headline.loser) : table.length === 0 ? planned[0]?.names ?? null : null
  const fromRows = !text.trim() && parsed ? table.find((bout) => parsed.names.every((name) => fights(bout, name))) : undefined
  const read = parsed ? readResult(text, parsed.names) : null
  const decided = read
    ? { ...read, winner: full(read.winner) }
    : fromRows
      ? { winner: full(parsed!.names.find((name) => sameFighter(fromRows.winner, name)) as string), method: null, round: null, time: null, scorecards: null }
      : !parsed && headline && tableStands && !headline.outcome
        ? { winner: headline.winner, method: headline.method, round: headline.round, time: headline.time, scorecards: headline.scorecards }
        : null
  const result: Combat | null = decided ? { winner: decided.winner, method: decided.method, round: decided.round, time: decided.time } : null

  const status = infer(Boolean(result) || (tableStands && table.length > 0))
  const rounds = scheduledRounds(about)
  const weight = about.match(WEIGHT)?.[1]
  const shown = !hidesResult(status)
  const belt = (raw.strDescriptionEN ?? "").match(TITLE)?.[1] ?? headline?.title ?? text.match(TITLE)?.[1] ?? null

  const told = shown && tableStands
  const bouts: CombatBout[] = planned.length > 0 && table.length === 0 ? planned : table.length > 0
    ? table.map((bout) => ({
      names: pair(bout.winner, bout.loser), winner: told && !bout.outcome ? bout.winner : null, method: told ? bout.method : null, round: told ? bout.round : null, time: told ? bout.time : null,
      weightClass: bout.weightClass ?? (bout === headline && weight ? cased(weight) : null), scheduledRounds: null, section: bout.section, scorecards: told ? bout.scorecards : null,
      outcome: told ? bout.outcome : null, title: bout.title ?? (bout === headline ? belt : null), titleFight: bout.titleFight || (bout === headline && Boolean(belt)), note: told ? bout.note : null,
    }))
    : names
      ? [{ names: pair(names[0], names[1]), winner: shown ? result?.winner ?? null : null, method: shown ? result?.method ?? null : null, round: shown ? result?.round ?? null : null, time: shown ? result?.time ?? null : null, weightClass: weight ? cased(weight) : null, scheduledRounds: rounds, section: null, scorecards: shown ? decided?.scorecards ?? null : null, title: belt, titleFight: Boolean(belt) }]
      : []

  const lead = headline ?? table[0]
  const details: CombatDetails = {
    kind: "combat",
    discipline: disciplineOf(raw.strLeague) ?? boutDiscipline(lead?.weightClass ?? planned[0]?.weightClass),
    card: parsed?.card ?? (parsed ? null : title),
    bouts,
    weightClass: lead?.weightClass ?? (weight ? cased(weight) : null),
    scheduledRounds: rounds,
    title: belt,
    city: raw.strCity?.trim() || null,
    country: raw.strCountry?.trim() || null,
    season: raw.strSeason?.trim() || null,
    spectators: count(raw.intSpectators),
  }
  return {
    eventType: parsed && !parsed.card ? "bout" : "fight-card",
    participantType: "individual",
    participants: names ? names.map(competitor) : [],
    eventName: parsed ? parsed.card : title,
    status,
    score: result && shown ? { kind: "combat", ...result } : { kind: "none" },
    details,
  }
}
