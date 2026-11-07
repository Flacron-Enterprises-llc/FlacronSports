import { describe, expect, it } from "vitest"
import { cricketFormat, matchSide } from "@/lib/sports/adapters/cricket"
import { getDictionary } from "@/lib/i18n"
import { rowValues } from "@/lib/sports/presentation"
import { sportFacts } from "@/lib/sports/sport-terms"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"
import type { EventScore } from "@/lib/sports/types"

const NOW = new Date("2026-11-07T14:00:00Z")
const row = (extra: Partial<RawEvent>): RawEvent => ({
  idEvent: "1", strSport: "Cricket", strLeague: "Indian Premier League", strEvent: "Home Side vs Away Side", strHomeTeam: "Home Side", strAwayTeam: "Away Side",
  strTimestamp: "2026-05-01T14:00:00", dateEvent: "2026-05-01", strTime: "14:00:00", strStatus: "FT", ...extra,
})
const read = (extra: Partial<RawEvent>) => normalizeEvent(row(extra), "cricket", NOW)
const innings = (score: EventScore) => {
  if (score.kind !== "innings") throw new Error(`expected innings, got ${score.kind}`)
  return score
}

describe("cricket rows with the sides crossed", () => {
  it("turns totals round when only that fits a win by runs (2435704)", () => {
    const score = innings(read({ strLeague: "ICC Mens T20 World Cup", strHomeTeam: "Sri Lanka Cricket", strAwayTeam: "England Cricket", intHomeScore: "146", intAwayScore: "95", strResult: "England won by 51 runs" }).score)
    expect(score).toMatchObject({ winner: "England Cricket", home: { runs: 95 }, away: { runs: 146 } })
  })

  it("turns totals and wickets round when the winner of a chase has the lower total (2466441)", () => {
    const score = innings(read({ strLeague: "Major League Cricket", strHomeTeam: "Seattle Orcas", strAwayTeam: "San Francisco Unicorns", intHomeScore: "194", intAwayScore: "190", intHomeScoreExtra: "4", intAwayScoreExtra: "7", strResult: "SF won by 6 wickets (with 6 balls remaining)" }).score)
    expect(score).toMatchObject({ home: { runs: 190, wickets: 7 }, away: { runs: 194, wickets: 4 } })
  })

  it("turns wickets alone round when the totals already fit (2482907)", () => {
    const score = innings(read({ strLeague: "Global Super League", strHomeTeam: "Desert Vipers", strAwayTeam: "San Francisco Unicorns", intHomeScore: "152", intAwayScore: "151", intHomeScoreExtra: "7", intAwayScoreExtra: "1", strResult: "Vipers won by 9 wickets (with 23 balls remaining)" }).score)
    expect(score).toMatchObject({ home: { runs: 152, wickets: 1 }, away: { runs: 151, wickets: 7 } })
  })

  it("drops a wicket figure the margin contradicts (2578489)", () => {
    const score = innings(read({ strLeague: "Caribbean Premier League", strHomeTeam: "Guyana Amazon Warriors", strAwayTeam: "Saint Lucia Kings", intHomeScore: "122", intAwayScore: "119", intHomeScoreExtra: "5", strResult: "Amazon won by 4 wickets (with 9 balls remaining)" }).score)
    expect(score).toMatchObject({ home: { runs: 122, wickets: 6 }, away: { runs: 119, wickets: null } })
  })

  it("takes the winner's wickets from the margin, and never for the loser", () => {
    const score = innings(read({ intHomeScore: "154", intAwayScore: "153", strResult: "Home won by 5 wickets" }).score)
    expect(score).toMatchObject({ home: { wickets: 5 }, away: { wickets: null } })
  })

  it("leaves a revised-target game as the feed filed it (2524736)", () => {
    const score = innings(read({ strLeague: "One Day International Series", strHomeTeam: "South Africa Cricket", strAwayTeam: "Australia Cricket", intHomeScore: "145", intAwayScore: "322", strResult: "Australia 322 for 9 beat South Africa 145 for 4 by 45 runs (DLS method), rain-affected." }).score)
    expect(score).toMatchObject({ home: { runs: 145 }, away: { runs: 322 } })
  })

  it("leaves a two-innings match to its own reading", () => {
    const score = innings(read({ strLeague: "English County Championship Division 1", intHomeScore: "400", intAwayScore: "450", strResult: "Home won by 50 runs" }).score)
    expect(score).toMatchObject({ home: { runs: 400 }, away: { runs: 450 } })
  })
})

describe("cricket games the feed never closes", () => {
  // A feed that stopped mid-chase leaves the same row, so totals alone never settle a game.
  it("keeps a game with two totals and no result unconfirmed, with its score shown (2624746)", () => {
    for (const strStatus of [null, "NS"]) {
      const event = read({ strStatus, intHomeScore: "221", intAwayScore: "202" })
      expect(event.status).toBe("unknown")
      expect(event.score.kind).toBe("innings")
    }
  })

  it("never calls a game with one total or none finished", () => {
    expect(read({ strStatus: null, intHomeScore: "221" }).status).toBe("unknown")
    expect(read({ strStatus: null }).status).toBe("unknown")
  })

  it("takes a nil as a total nobody entered (667267, 2469214)", () => {
    const rained = read({ strLeague: "Cricket World Cup", strStatus: null, intHomeScore: "0", intAwayScore: "0" })
    expect(rained.status).toBe("unknown")
    expect(rained.score).toEqual({ kind: "none" })
    expect(innings(read({ strLeague: "English County Championship Division 1", intHomeScore: "0", intAwayScore: "325" }).score).home).toBeNull()
  })

  it("believes FT over a postponed flag left on the row (2374254)", () => {
    const event = read({ strPostponed: "yes", intHomeScore: "37" })
    expect(event.status).toBe("finished")
    expect(rowValues(event)).toEqual(["37", undefined])
  })
})

describe("cricket details in free text", () => {
  it("names the Birmingham Bears when the text says Warwickshire (2427875)", () => {
    expect(matchSide("Warwickshire", ["Northants Steelbacks", "Birmingham Bears"])).toBe(1)
    expect(read({ strLeague: "English t20 Blast", strHomeTeam: "Northants Steelbacks", strAwayTeam: "Birmingham Bears", intHomeScore: "153", intAwayScore: "154", strResult: "Warwickshire won by 5 wickets (with 10 balls remaining)" }).score).toMatchObject({ winner: "Birmingham Bears", ballsLeft: 10 })
  })

  it("reads a score no side is named beside (2231088, 2524753)", () => {
    const final = read({ strLeague: "ICC Champions Trophy", strHomeTeam: "India Cricket", strAwayTeam: "New Zealand Cricket", intHomeScore: "254", intAwayScore: "251", strResult: "India won by 4 wickets.\r\n\r\nNew Zealand won the toss and electing to bat first, they registered a score of 251/7. In the second innings, India managed to chase the score 254/6. Rohit Sharma was named Player of the Match for scoring 76." })
    expect(final.score).toMatchObject({ home: { runs: 254, wickets: 6 }, away: { runs: 251, wickets: 7 }, playerOfMatch: "Rohit Sharma" })
    expect(final.details).toMatchObject({ toss: { side: "New Zealand Cricket", choice: "bat" } })
    expect(innings(read({ strStatus: "ABD", intHomeScore: "118", strResult: "India reached 118/5 in 7.4 overs before rain returned" }).score).home).toMatchObject({ wickets: 5, overs: "7.4" })
  })

  it("does not take bowling figures for a score", () => {
    expect(innings(read({ intHomeScore: "4", intAwayScore: "164", strResult: "Motie 4/15" }).score).home).toMatchObject({ wickets: null })
    expect(innings(read({ intHomeScore: "164", intAwayScore: "164", strResult: "North 164/9" }).score).home).toMatchObject({ wickets: null })
  })

  it("reads POTM (2482906)", () => {
    expect(read({ strResult: "Guyana won by 53 runs. POTM: Gudakesh Motie (4/15)." }).score).toMatchObject({ kind: "none" })
    expect(read({ intHomeScore: "164", intAwayScore: "111", strResult: "Home Side 164/9 (20 ov) beat Away Side 111/10 (17.2 ov) by 53 runs. Providence Stadium, Guyana. POTM: Gudakesh Motie (4/15)." }).score).toMatchObject({ playerOfMatch: "Gudakesh Motie" })
  })

  it("shows the group, the phase and the umpires", () => {
    const event = read({ strGroup: "A", strDescriptionEN: "Night Match\r\nPhase 4 (Guyana and Barbados)\r\nUmpires: Stanley Gogwe and Forster Mutizwa" })
    expect(event.details).toMatchObject({ group: "A", phase: "Phase 4 (Guyana and Barbados)", umpires: "Stanley Gogwe and Forster Mutizwa", dayNight: true })
    expect(sportFacts(event, getDictionary("en")).map((fact) => fact.value)).toEqual(expect.arrayContaining(["A", "Phase 4 (Guyana and Barbados)", "Stanley Gogwe and Forster Mutizwa"]))
  })
})

describe("cricket formats across the feed's leagues", () => {
  it.each([
    ["English County Championship Division 1", "first-class"], ["English County Championship Division 2", "first-class"], ["County Championship Division 2", "first-class"], ["Sheffield Shield", "first-class"],
    ["International Test Match Series", "test"], ["ICC World Test Championship", "test"],
    ["One Day International Series", "odi"], ["Cricket World Cup", "odi"], ["Womens Cricket World Cup", "odi"], ["ICC Champions Trophy", "odi"],
    ["Indian Premier League", "t20"], ["Australian Big Bash League", "t20"], ["South African T20 Challenge", "t20"], ["English t20 Blast", "t20"], ["Twenty20 International Series", "t20"], ["Pakistan Super League", "t20"],
    ["ICC Mens T20 World Cup", "t20"], ["ICC Womens T20 World Cup", "t20"], ["New Zealand Super Smash", "t20"], ["Lanka Premier League", "t20"], ["Caribbean Premier League", "t20"], ["Commonwealth Games Cricket", "t20"],
    ["Major League Cricket", "t20"], ["International League T20", "t20"], ["Bangladesh Premier League", "t20"], ["Global Super League", "t20"], ["SA20", "t20"], ["Nepal Premier League", "t20"],
    ["Shpageeza Cricket League", "t20"], ["Zimbabwean Domestic Twenty20", "t20"], ["Cricket Ireland Inter-Provincial T20 Trophy", "t20"],
    ["The Hundred", "hundred"], ["The Hundred Women", "hundred"],
  ])("reads %s as %s", (league, format) => expect(cricketFormat(league)).toBe(format))

  it.each(["_Defunct Cricket Teams", "_No League Cricket"])("leaves %s, which lists teams and no games, without a format", (league) => expect(cricketFormat(league)).toBeNull())
})
