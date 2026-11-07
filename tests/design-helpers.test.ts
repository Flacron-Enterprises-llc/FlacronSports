import { describe, expect, it } from "vitest"
import { volleyballBreakdown } from "@/lib/sports/adapters/volleyball"
import { liveClock, setsWon } from "@/lib/sports/presentation"
import { sessionStatus, type RaceSession } from "@/lib/sports/seasons"
import type { SportEvent } from "@/lib/sports/types"
import type { Broadcast } from "@/lib/sports/service"
import { groupListings } from "@/lib/video/listings"

const sides = [{ id: null, name: "Lehecka", role: "home", badgeUrl: null }, { id: null, name: "Vacherot", role: "away", badgeUrl: null }] as SportEvent["participants"]
const sets = (home: number[], away: number[], extra = {}) => ({ participants: sides, score: { kind: "sets", lines: [{ name: "Vacherot", games: away }, { name: "Lehecka", games: home }], winner: "Vacherot", retired: null, ...extra } }) as Pick<SportEvent, "score" | "participants">

describe("liveClock", () => {
  it("drops a clock that only repeats the phase", () => {
    expect(liveClock({ status: "live", clock: "IN4" }, "Inning 4")).toBeNull()
  })

  it("keeps a running clock, and marks bare minutes", () => {
    expect(liveClock({ status: "live", clock: "8" }, "Q1")).toBe("8′")
    expect(liveClock({ status: "live", clock: "11:32" }, "Q1")).toBe("11:32")
  })

  it("keeps the feed's own words when no phase states them", () => {
    expect(liveClock({ status: "live", clock: "HT" }, null)).toBe("HT")
  })

  it("shows nothing once the game is not live", () => {
    expect(liveClock({ status: "finished", clock: "90" }, null)).toBeNull()
  })
})

describe("setsWon", () => {
  it("counts sets in participant order, whatever order the lines came in", () => {
    expect(setsWon(sets([6, 3, 3], [2, 6, 6]))).toEqual([1, 2])
  })

  it("makes no claim for a retirement or a walkover", () => {
    expect(setsWon(sets([6, 3], [2, 1], { retired: "Vacherot" }))).toBeNull()
    expect(setsWon(sets([], [], { walkover: true }))).toBeNull()
  })
})

describe("volleyball sets", () => {
  const text = "Home First:<br>25 23<br>Second:<br>17 25<br>Third:<br>18 25<br>Forth:<br><br>Fifth:<br>"

  it("keeps a place for a set the source left empty", () => {
    const breakdown = volleyballBreakdown(text, { home: "Home", away: "Away", homeScore: 1, awayScore: 3 })
    expect(breakdown?.segments).toHaveLength(4)
    expect(breakdown?.segments[3]).toMatchObject({ number: 4, home: null, away: null })
  })

  it("adds nothing to a match that ended in three sets", () => {
    const three = "Home First:<br>25 23<br>Second:<br>25 17<br>Third:<br>25 18<br>Forth:<br><br>Fifth:<br>"
    expect(volleyballBreakdown(three, { home: "Home", away: "Away", homeScore: 3, awayScore: 0 })?.segments).toHaveLength(3)
  })
})

describe("sessionStatus", () => {
  const session = (status: RaceSession["status"], startUTC: string): RaceSession => ({ id: "1", name: null, startUTC, dateOnly: false, status })
  const now = new Date("2026-11-07T06:00:00Z")

  it("does not call a session from last week upcoming", () => {
    expect(sessionStatus(session("scheduled", "2026-11-01T06:00:00Z"), now)).toBe("finished")
  })

  it("leaves a session still to come alone", () => {
    expect(sessionStatus(session("scheduled", "2026-11-08T06:00:00Z"), now)).toBe("scheduled")
  })

  it("leaves a stated status alone", () => {
    expect(sessionStatus(session("postponed", "2026-11-01T06:00:00Z"), now)).toBe("postponed")
  })
})

describe("groupListings", () => {
  const row = (id: string, matchId: string | null, channel: string, country: string | null, eventName = "Arsenal vs Hull City"): Broadcast => ({ id, matchId, eventName, sportId: "football", channel, country, logoUrl: null, startUTC: "2026-11-07T15:00:00Z" })

  it("gathers a game's channels under one entry, keeping the order given", () => {
    const groups = groupListings([row("1", "m1", "Peacock", "United States"), row("2", "m2", "Sky", "United Kingdom", "Fulham vs Newcastle"), row("3", "m1", "Arena Sport", "Slovenia")])
    expect(groups.map((group) => group.matchId)).toEqual(["m1", "m2"])
    expect(groups[0].channels.map((channel) => channel.channel)).toEqual(["Peacock", "Arena Sport"])
  })

  it("lists a repeated channel once, but the same name in another country stays", () => {
    const groups = groupListings([row("1", "m1", "DAZN", "Spain"), row("2", "m1", "DAZN", "Spain"), row("3", "m1", "DAZN", "Canada")])
    expect(groups[0].channels.map((channel) => channel.country)).toEqual(["Spain", "Canada"])
  })

  it("groups a game with no match by its name and start", () => {
    expect(groupListings([row("1", null, "A", "X"), row("2", null, "B", "Y")])).toHaveLength(1)
  })
})
