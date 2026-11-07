import { describe, expect, it } from "vitest"
import { parseRace, sessionOf } from "@/lib/sports/adapters/motorsport"
import { kindOf } from "@/lib/sports/score-filters"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"
import { entrantProfile } from "@/lib/sports/compare"

// Shapes and text are cut from real provider rows read on 2026-11-07.
const row = (over: Partial<RawEvent>): RawEvent => ({ idEvent: "1", idLeague: "4370", strLeague: "Formula 1", strSport: "Motorsport", strTimestamp: "2026-11-01T20:00:00", strTime: "20:00:00", intRound: "19", ...over })
const NOW = new Date("2026-11-07T10:00:00Z")

describe("motorsport sessions from real titles", () => {
  it.each([
    ["Penrite Oil Sandown 500 Qualifying Race 33", "qualifying", null, "Penrite Oil Sandown 500"],
    ["Penrite Oil Sandown 500 Top 10 Shootout Race 33", "qualifying", null, "Penrite Oil Sandown 500"],
    ["Penrite Oil Sandown 500 Race 33", "race", 33, "Penrite Oil Sandown 500"],
    ["6 Hours of Imola Hyperpole LMGT3", "qualifying", null, "6 Hours of Imola"],
    ["24 Hours of Le Mans Hyperpole Qualifying – LMP2 & LMGT3", "qualifying", null, "24 Hours of Le Mans"],
    ["Okayama Qualifying Q1", "qualifying", 1, "Okayama"],
    ["Okayama Warm Up", "practice", null, "Okayama"],
    ["Australian Superpole Race", "sprint", null, "Australian"],
    ["Australian Superpole", "qualifying", null, "Australian"],
    ["Australian Feature Race", "race", null, "Australian"],
    ["Thailand GP", "race", null, "Thailand"],
    ["Valencia Test", "testing", null, "Valencia"],
    ["Roar Before The Rolex 24", "testing", null, "Roar Before The Rolex 24"],
    ["Imola Prologue Morning Session", "testing", null, "Imola Prologue"],
    ["WRC Rallye Monte-Carlo SS12", "stage", 12, "WRC Rallye Monte-Carlo"],
    ["WRC Rallye Monte-Carlo ", "race", null, "WRC Rallye Monte-Carlo"],
    ["Mission Foods Grand Prix of Monterey Final Practice", "practice", null, "Mission Foods Grand Prix of Monterey"],
    ["São Paulo Grand Prix Practice 3", "practice", 3, "São Paulo Grand Prix"],
    ["Chinese Grand Prix Sprint Qualifying", "sprint-qualifying", null, "Chinese Grand Prix"],
  ])("%s", (title, session, number, weekend) => {
    const read = sessionOf(title)
    expect([read.session, read.number, read.weekend]).toEqual([session, number, weekend])
  })

  it("keeps WEC's class when the title has no dash", () => {
    expect(sessionOf("6 Hours of Imola Qualifying Hypercar").className).toBe("Hypercar")
  })

  it("files Supercars qualifying and rally stages under their own Scores filter", () => {
    const kind = (strEvent: string) => kindOf(normalizeEvent(row({ strEvent, idLeague: "4489" }), "motorsport", NOW))
    expect(kind("Penrite Oil Sandown 500 Qualifying Race 33")).toBe("qualifying")
    expect(kind("Penrite Oil Sandown 500 Race 33")).toBe("race")
    expect(kind("WRC Rally Sweden SS4")).toBe("stage")
  })
})

describe("motorsport results from real pasted layouts", () => {
  it("reads Super GT's slash table with crews and laps", () => {
    const text = "Pos /Number /Team /Drivers /Laps /Diff.\r\n\r\n1 /16 /ARTA MUGEN /Tomoki Nojiri--Ren Sato /52 /WIN\r\n2 /17 /Astemo REAL RACING/Tsukagoshi Hirohiro--Yuto Nomura /52 /+2.220\r\n3 /8 /Team HRC ARTA MUGEN / Kakunoshin Ota--Hiroki Otsu /52 /+3.0 11"
    const race = parseRace(text)
    expect(race?.entries).toEqual([
      { position: 1, name: "Tomoki Nojiri / Ren Sato", team: "ARTA MUGEN", time: null, laps: 52, number: 16 },
      { position: 2, name: "Tsukagoshi Hirohiro / Yuto Nomura", team: "Astemo REAL RACING", time: "+2.220", laps: 52, number: 17 },
      { position: 3, name: "Kakunoshin Ota / Hiroki Otsu", team: "Team HRC ARTA MUGEN", time: "+3.011", laps: 52, number: 8 },
    ])
  })

  it("does not read a championship table as a race", () => {
    const text = "Final Driver Standings after Sardegna \r\nPos /Driver /Team /Points\r\n\r\n1 /Elfyn Evans /Toyota Gazoo Racing /243  (Champion)\r\n2 /Oliver Solberg /Toyota Gazoo Racing /239\r\n3 /Sami Pajari /Toyota Gazoo Racing /236"
    expect(parseRace(text)).toBeNull()
  })

  it("reads a NASCAR top ten written in prose, with its retirements", () => {
    const text = "Winner: Corey Day (#17 Hendrick Motorsports Chevrolet), won by 0.287s over Carson Kvapil. Top 10: 1 Corey Day, 2 Carson Kvapil, 3 Jesse Love, 4 Brent Crews, 5 Taylor Gray, 6 Sam Mayer, 7 Jeremy Clements, 8 William Sawalich, 9 Austin Hill, 10 Anthony Alfredo. DNFs: Justin Allgaier, Brandon Jones, Dawson Cram. Note: Lee Pulliam is not included."
    const race = parseRace(text)
    expect(race?.entries.map((entry) => entry.name)).toEqual(["Corey Day", "Carson Kvapil", "Jesse Love", "Brent Crews", "Taylor Gray", "Sam Mayer", "Jeremy Clements", "William Sawalich", "Austin Hill", "Anthony Alfredo"])
    expect(race?.out?.map((item) => [item.name, item.status])).toEqual([["Justin Allgaier", "DNF"], ["Brandon Jones", "DNF"], ["Dawson Cram", "DNF"]])
  })

  it("stops a prose list where a place is missing", () => {
    const text = "Top finishers: 1. Chandler Smith; 2. Layne Riggs; 3. Shane van Gisbergen; 4. Christian Eckes; 5. Landen Lewis; 9. Corey Heim; 10. Ty Majeski. (Positions 6-8 not confirmed by available sources.)"
    expect(parseRace(text)?.entries.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5])
  })

  it("reads Formula E's qualifying groups and the duel winner's pole", () => {
    const text = "2026 TDK Tokyo E-Prix Round 15 Qualifying (Tokyo Street Circuit).\r\nGroup A: 1 A. da Costa 1:15.157, 2 M. Evans +0.105, 3 T. Barnard +0.113, 4 N. Nato +0.203, 5 N. Muller\r\nGroup B: 1 E. Mortara 1:14.216, 2 N. de Vries +0.297, 3 D. Ticktum +0.331\r\nSF1: da Costa bt Barnard; SF2: Mortara bt Ticktum.\r\nFinal: Mortara (1:12.341) bt da Costa (+0.677) — Mortara's 4th pole of the season."
    const race = parseRace(text)
    expect(race?.className).toBe("Group A")
    expect(race?.entries[0]).toEqual({ position: 1, name: "A. da Costa", team: null, time: "1:15.157" })
    expect(race?.entries).toHaveLength(5)
    expect(race?.classes?.[0].name).toBe("Group B")
    expect(race?.pole).toBe("Mortara")
  })

  it("reads IMSA's overall order with each car's class", () => {
    const text = "1 GTP Filipe Albuquerque/Ricky Taylor - Cadillac Wayne Taylor Racing - Cadillac V-Series.R - 151 laps\r\n2 GTP Laurin Heinrich/Kaylen Frederick/Tijmen van der Helm - JDC-Miller MotorSports - Porsche 963 - 151 - +1.960\r\n3 GTP Louis Deletraz/Jordan Taylor - Cadillac Wayne Taylor Racing - Cadillac V-Series.R - 151\r\n4 LMP2-1 Tom Dillmann/Bijoy Garg/Jeremy Clarke - Inter Europol Competition - ORECA LMP2 07 - 149\r\n5 GTD PRO-1 Andrea Caldarelli/Sandy Mitchell - Pfaff Motorsports - Lamborghini Temerario GT3 - 142"
    const race = parseRace(text)
    expect(race?.entries.map((entry) => [entry.position, entry.category, entry.laps])).toEqual([[1, "GTP", 151], [2, "GTP", 151], [3, "GTP", 151], [4, "LMP2", 149], [5, "GTD Pro", 142]])
    expect(race?.entries[1].time).toBe("+1.960")
  })

  it("reads Moto3 rows where one carries points after the gap", () => {
    const text = "1\t/Brian Uriarte\t\t/Red Bull KTM Ajo\t\t/33:07.801\t\r\n2\t/Alvaro Carpe\t\t/Red Bull KTM Ajo\t\t/+0.418\t\r\n3\t/Hakim Danish\t\t/AEON Credit - MT Helmets - MSI\t/+0.456\t16\r\n4\t/Adrian Fernandez\t/Leopard Racing\t\t\t/+0.482\t"
    const race = parseRace(text)
    expect(race?.entries).toHaveLength(4)
    expect(race?.entries[2]).toEqual({ position: 3, name: "Hakim Danish", team: "AEON Credit - MT Helmets - MSI", time: "+0.456" })
  })
})

describe("motorsport records and compare", () => {
  const gp = "1\t3\tNetherlands Max Verstappen\tRed Bull Racing\t71\t2:20:28.772\t5\t25\n2\t12\tItaly Kimi Antonelli\tMercedes\t71\t+0.799\t1\t18\n3\t44\tUnited Kingdom Lewis Hamilton\tFerrari\t71\t+2.100\t2\t15"
  const rows = [
    { idPlayer: "34157146", strPlayer: "Max Verstappen", intPosition: "1", strDetail: "" },
    { idPlayer: "34248269", strPlayer: "Andrea Kimi Antonelli", intPosition: "2", strDetail: "" },
  ]

  it("names a pasted driver by the source's player record", () => {
    const event = normalizeEvent(row({ strEvent: "Mexico City Grand Prix", strStatus: "FT", strResult: gp, resultRows: rows }), "motorsport", NOW)
    expect(event.score.kind === "classification" && event.score.entries.slice(0, 2).map((entry) => [entry.name, entry.playerId])).toEqual([["Max Verstappen", "34157146"], ["Andrea Kimi Antonelli", "34248269"]])
  })

  it("keeps the whole field when a pasted top ten covers only part of it", () => {
    const text = "Top 10 - FP2 Classification:\n1. Charles Leclerc (Ferrari) 1:35.291\n2. Kimi Antonelli (Mercedes) +0.042\n3. Max Verstappen (Red Bull) +0.189"
    const field = ["Charles Leclerc", "Andrea Kimi Antonelli", "Max Verstappen", "Lewis Hamilton", "Alexander Albon"].map((name, index) => ({ idPlayer: String(index + 1), strPlayer: name, intPosition: String(index + 1), strDetail: index === 0 ? "1:35.291" : `+0.${index}00s` }))
    const event = normalizeEvent(row({ strEvent: "United States Grand Prix Practice 2", strStatus: "FT", strResult: text, resultRows: field }), "motorsport", NOW)
    expect(event.score.kind === "classification" && event.score.entries.map((entry) => [entry.position, entry.name, entry.team])).toEqual([
      [1, "Charles Leclerc", "Ferrari"], [2, "Andrea Kimi Antonelli", "Mercedes"], [3, "Max Verstappen", "Red Bull"], [4, "Lewis Hamilton", null], [5, "Alexander Albon", null],
    ])
  })

  it("keeps each endpoint row's stated place when one driver is missing", () => {
    const field = ["Corey Day", "Carson Kvapil", "Jesse Love", "Parker Retzlaff"].map((name, index) => ({ idPlayer: String(index), strPlayer: name, intPosition: String(index === 3 ? 19 : index + 1), strDetail: index === 3 ? "Running" : "" }))
    const event = normalizeEvent(row({ idLeague: "4573", strEvent: "Focused Health 302", strStatus: "FT", resultRows: [...field, { idPlayer: "9", strPlayer: "Justin Allgaier", intPosition: "36", strDetail: "DNF" }] }), "motorsport", NOW)
    expect(event.score.kind === "classification" && [event.score.entries.map((entry) => entry.position), event.score.out?.map((item) => item.name)]).toEqual([[1, 2, 3, 19], ["Justin Allgaier"]])
  })

  it("adds race points only when the classification printed them", () => {
    const withPoints = normalizeEvent(row({ idEvent: "1", strEvent: "Mexico City Grand Prix", strStatus: "FT", strResult: gp }), "motorsport", NOW)
    const practice = normalizeEvent(row({ idEvent: "2", strEvent: "Mexico City Grand Prix Practice 3", strStatus: "FT", resultRows: rows.map((item) => ({ ...item, strDetail: "1:17.600" })) }), "motorsport", NOW)
    const plain = normalizeEvent(row({ idEvent: "3", strEvent: "Malaysia GP", idLeague: "4407", strStatus: "FT", resultRows: [...rows, { idPlayer: "9", strPlayer: "Lewis Hamilton", intPosition: "3", strDetail: "+1.0" }] }), "motorsport", NOW)
    expect(entrantProfile("Max Verstappen", "motorsport", [withPoints, practice]).racing).toMatchObject({ races: 1, wins: 1, points: 25 })
    expect(entrantProfile("Max Verstappen", "motorsport", [plain]).racing).toMatchObject({ races: 1, wins: 1, points: null })
  })

  it("leaves a started session with no published result unconfirmed, never finished", () => {
    const event = normalizeEvent(row({ idEvent: "2419075", idLeague: "4489", strEvent: "Penrite Oil Sandown 500 Race 33", strTimestamp: "2026-11-07T04:30:00", strTime: "04:30:00", resultRows: [] }), "motorsport", NOW)
    expect([event.status, event.score.kind]).toEqual(["unknown", "none"])
  })
})
