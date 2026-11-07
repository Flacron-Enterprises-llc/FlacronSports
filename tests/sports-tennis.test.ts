// Rows copied from the feed's tennis responses of 2026-11-07, line breaks included.
import { describe, expect, it } from "vitest"
import { splitTitle } from "@/lib/sports/adapters/tennis"
import { leaguePaths } from "@/lib/sports/collect"
import { setsWinner } from "@/lib/sports/game-result"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

const tennis = (extra: Partial<RawEvent>): RawEvent => ({ idEvent: "1", strSport: "Tennis", dateEvent: "2026-10-30", strTime: "00:00:00", strTimestamp: "2026-10-30T00:00:00", strPostponed: "no", ...extra })
const unitedCup = (title: string, draw: string[], result: string[]) => normalizeEvent(tennis({ strLeague: "United Cup", strEvent: title, strDescriptionEN: [title, "", ...draw].join("\r\n"), strResult: result.join("\r\n"), strStatus: "FT" }), "tennis")

describe("team ties", () => {
  it("counts the rubbers when the header gives no count, away side ahead", () => {
    const event = unitedCup("Germany vs Poland", ["Zverev (GER) vs Hurkacz (POL)", "Lys (GER) vs Swiatek (POL)", "Siegemund/Zverev (GER) vs Kawa/Zielinski (POL)"], ["Germany vs Poland", "", "Hurkacz (POL) def Zverev (GER) 6-3 6-4", "Swiatek (POL) def Lys (GER) 3-6 6-3 6-4", "Kawa/Zielinski (POL) def Siegemund/Zverev (GER) 7-6(6) 6-3"])
    expect(event.score).toEqual({ kind: "team", home: 0, away: 3 })
  })
  it("counts a split tie, and a header that names the winner", () => {
    const italy = unitedCup("Italy vs France", ["Cobolli (ITA) vs Rinderknech (FRA)", "Paolini (ITA) vs Jeanjean (FRA)"], ["Italy vs France", "", "Rinderknech (FRA) def Cobolli (ITA) 6-7(4) 7-6(5) 7-5", "Paolini (ITA) def Jeanjean (FRA) 6-2 6-3", "Errani/Vavassor (ITA) def Rakotomanga Rajaonah/Roger-Vasselin (FRA) 7-6(6) 7-6(6)"])
    expect(italy.score).toEqual({ kind: "team", home: 2, away: 1 })
    const czechia = unitedCup("Czechia vs Norway", ["Krejcikova (CZE) vs Helgø (NOR)", "Mensik (CZE) vs Ruud (NOR)"], ["Czechia def Norway", "", "Krejcikova (CZE) def Helgø (NOR) 6-4 6-3", "Mensik (CZE) def Ruud (NOR) 7-5 7-6(6)"])
    expect(czechia.score).toEqual({ kind: "team", home: 2, away: 0 })
  })
  it("states nothing when the header and the rubbers disagree, or a side cannot be told", () => {
    expect(unitedCup("Czechia vs Norway", ["Krejcikova (CZE) vs Helgø (NOR)"], ["Norway def Czechia", "", "Krejcikova (CZE) def Helgø (NOR) 6-4 6-3"]).score).toEqual({ kind: "none" })
    expect(unitedCup("Czechia vs Norway", ["Krejcikova vs Helgø"], ["Czechia vs Norway", "", "Krejcikova (CZE) def Helgø (NOR) 6-4 6-3"]).score).toEqual({ kind: "none" })
  })
  it("keeps the count the header states", () => {
    const event = unitedCup("Poland vs Switzerland", ["Swiatek (POL) vs Bencic (SUI)"], ["Poland def Switzerland 2-1", "", "Bencic (SUI) def Swiatek (POL) 3-6 6-0 6-3"])
    expect(event.score).toEqual({ kind: "team", home: 2, away: 1 })
  })
})

describe("the order of the players", () => {
  it("ignores a surname inside the tournament's name, so rankings stay with their player", () => {
    const event = normalizeEvent(tennis({ strLeague: "WTA Tour", strEvent: "Cerity Partners Hall of Fame Open for the Van Alen Cup Presented by the Margaret Fund Ngounoue vs Ma", strDescriptionEN: "Hall of Fame Open - Newport - 1st Round\r\nNgounoue (120) vs Ma (88)", strResult: "Ma  beat Ngounoue  2-0\r\nMa : 6 6 \r\nNgounoue : 3 4" }), "tennis")
    expect(event.participants.map((side) => side.name)).toEqual(["Ngounoue", "Ma"])
    expect(event.details).toMatchObject({ ranks: [120, 88] })
  })
  it("keeps the draw order when the result lists the winner first", () => {
    const event = normalizeEvent(tennis({ strLeague: "WTA Tour", strEvent: "Wuhan Open Muchova vs Shnaider", strDescriptionEN: "Wuhan Open - Wuhan - 3rd Round\r\nMuchova (7) vs Shnaider (13)", strResult: "Shnaider  beat Muchova  2-0\r\nShnaider : 7 6 \r\nMuchova : 5 3" }), "tennis")
    expect(event.participants.map((side) => side.name)).toEqual(["Muchova", "Shnaider"])
    expect(event.details).toMatchObject({ ranks: [7, 13], gender: "women", round: { key: "round", number: 3 } })
  })
})

describe("how a match ended", () => {
  it("gives a retirement to the other player and keeps the unfinished sets", () => {
    const event = normalizeEvent(tennis({ strLeague: "WTA Tour", strEvent: "Japan Open Stearns vs Siniakova", strResult: "Stearns  retired from the match.\r\nSiniakova : 6 0 4\r\nStearns : 4 6 0" }), "tennis")
    if (event.score.kind !== "sets") throw new Error("expected sets")
    expect(event.status).toBe("finished")
    expect(event.score.retired).toBe("Stearns")
    expect(setsWinner(event.score)).toBe("Siniakova")
    expect(event.score.lines.map((line) => line.games)).toEqual([[6, 0, 4], [4, 6, 0]])
  })
  it("reads a walkover with the winner second in the draw", () => {
    const event = normalizeEvent(tennis({ strLeague: "WTA Tour", strEvent: "Guangzhou Open Siniakova vs Liu", strResult: "Liu  w/o Siniakova" }), "tennis")
    expect(event.participants.map((side) => side.name)).toEqual(["Siniakova", "Liu"])
    expect(event.score).toMatchObject({ kind: "sets", winner: "Liu", walkover: true })
  })
  it("carries tiebreak points only where the source writes them", () => {
    const event = normalizeEvent(tennis({ strLeague: "Laver Cup", strEvent: "Alexander Zverev vs Alex de Minaur", strResult: "LAVER CUP 2026 - ALEXANDER ZVERZEV VS ALEX DE MINAUR\r\nAlex de Minaur (Team World) def. Alexander Zverev (Team Europe) 2-6, 7-6(5), 11-9\r\nSource: espn.com, wsls.com" }), "tennis")
    expect(event.score).toMatchObject({ kind: "sets", winner: "Alex de Minaur", tiebreaks: [null, 5, null] })
    expect(event.details).toMatchObject({ gender: "men" })
  })
})

describe("titles a new week may bring", () => {
  it("splits tournaments the checked seasons have not named", () => {
    expect(splitTitle("Rolex Paris Masters Sinner vs Zverev")).toEqual({ tournament: "Rolex Paris Masters", names: ["Sinner", "Zverev"] })
    expect(splitTitle("Stockholm Open Ruud vs Fils")).toEqual({ tournament: "Stockholm Open", names: ["Ruud", "Fils"] })
    expect(splitTitle("Nitto ATP Finals Alcaraz vs Sinner")).toEqual({ tournament: "Nitto ATP Finals", names: ["Alcaraz", "Sinner"] })
  })
})

describe("the tours in the collector", () => {
  const now = new Date("2026-11-07T12:00:00Z")
  const walked = (at: Date) => leaguePaths({ id: "4517", sportId: "tennis" }, at)[2]

  it("reads the season by its plain year, and one tour's turn adds the day feed for both", () => {
    expect(leaguePaths({ id: "4464", sportId: "tennis" }, now)).toEqual(["eventsseason.php?id=4464&s=2026", "eventspastleague.php?id=4464"])
    expect(leaguePaths({ id: "4517", sportId: "tennis" }, now).slice(0, 2)).toEqual(["eventsseason.php?id=4517&s=2026", "eventspastleague.php?id=4517"])
  })
  it("asks for the day under the key the day feed is stored by", () => {
    expect(walked(now)).toMatch(/^eventsday\.php\?d=\d{4}-\d{2}-\d{2}&s=Tennis$/)
  })
  it("reaches every day of the window, however the rotation lands on the hour", () => {
    for (const lap of [1, 2, 3, 6]) {
      const back = Array.from({ length: 29 }, (_, step) => {
        const at = new Date(now.getTime() + step * lap * 3_600_000)
        return (Date.parse(at.toISOString().slice(0, 10)) - Date.parse(new URLSearchParams(walked(at).split("?")[1]).get("d") as string)) / 86_400_000
      })
      expect(new Set(back).size).toBe(29)
      expect([Math.min(...back), Math.max(...back)]).toEqual([2, 30])
    }
  })
})
