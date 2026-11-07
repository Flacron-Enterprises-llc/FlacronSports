import { describe, expect, it } from "vitest"
import { entrantProfile } from "@/lib/sports/compare"
import { kindOf } from "@/lib/sports/score-filters"
import { isCovered, normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"
import type { CombatDetails, SportEvent } from "@/lib/sports/types"

// Row shapes as the feed sent them on 2026-11-07, cut to the fields that matter.
const NOW = new Date("2026-11-07T14:00:00Z")
const normalize = (raw: Partial<RawEvent>) => normalizeEvent({ idEvent: "1", strSport: "Fighting", strTimestamp: "2026-11-06T13:30:00", strTime: "13:30:00", ...raw } as RawEvent, "combat-sports", NOW)
const card = (event: SportEvent) => event.details as CombatDetails
const T = " \t"

const fridayFights = normalize({
  strEvent: "ONE Friday Fights 177 Isannuea vs Jack", strLeague: "ONE", strStatus: "FT",
  strResult: [
    "ONE Friday Fights 177 (YouTube / Facebook)",
    `Weight Class${T}${T}${T}${T}Method${T}Round${T}Time${T}Notes`,
    `Bantamweight Muay Thai${T}Thailand Jack Siatarnyokkrok P.K${T}def.${T}Thailand Isannuea Chotbangsaen${T}Decision (unanimous)${T}3${T}3:00${T}`,
    `Flyweight Kickboxing${T}Latvia Marats Jankovskis${T}def.${T}Japan Retsu Sashida${T}Decision (unanimous)${T}3${T}3:00`,
  ].join("\r\n"),
})

const innerCircle = normalize({
  strEvent: "ONE The Inner Circle 37", strLeague: "ONE", strStatus: "FT",
  strDescriptionEN: "The Inner Circle 37 was a combat sports event produced by ONE Championship that took place on November 6, 2026.",
  strResult: [
    "The Inner Circle 37 (Superfans at Live ONE)",
    `Weight Class${T}${T}${T}${T}Method${T}Round${T}Time${T}Notes`,
    `Lightweight MMA${T}United States Tye Ruotolo${T}def.${T}United States Christian Lee (c)${T}Submission (rear-naked choke)${T}1${T}2:08${T}For the ONE Lightweight World Championship.`,
    `Flyweight Muay Thai${T}Egypt Tantawy Ahmed Hafez${T}def.${T}Thailand Kongchai Chanaidonmuang${T}Decision (unanimous)${T}3${T}3:00`,
  ].join("\r\n"),
})

describe("combat cards from real rows", () => {
  it("scores a card whose title gives only given names, with the table's full names", () => {
    expect(fridayFights.participants.map((item) => item.name)).toEqual(["Isannuea Chotbangsaen", "Jack Siatarnyokkrok P.K"])
    expect(fridayFights.score).toEqual({ kind: "combat", winner: "Jack Siatarnyokkrok P.K", method: "unanimous-decision", round: 3, time: "3:00" })
    expect(card(fridayFights).bouts[1].names).toEqual(["Marats Jankovskis", "Retsu Sashida"])
    expect(kindOf(fridayFights)).toBe("muay-thai")
  })

  it("leads a card named after no one with its main event and keeps the belt", () => {
    expect(innerCircle.participants.map((item) => item.name)).toEqual(["Christian Lee", "Tye Ruotolo"])
    expect(innerCircle.score).toEqual({ kind: "combat", winner: "Tye Ruotolo", method: "submission", round: 1, time: "2:08" })
    expect(card(innerCircle)).toMatchObject({ title: "ONE Lightweight World Championship", discipline: "mma" })
    expect(card(innerCircle).bouts[0]).toMatchObject({ title: "ONE Lightweight World Championship", titleFight: true, note: null })
    expect(card(innerCircle).bouts[1].names).toEqual(["Kongchai Chanaidonmuang", "Tantawy Ahmed Hafez"])
  })

  it("keeps a first name that is also a country on a table without flags", () => {
    const ufc = normalize({ strEvent: "UFC 400 Adesanya vs Imavov", strLeague: "UFC", strResult: `Main card${T}\r\nMiddleweight${T}Israel Adesanya${T}def.${T}Nassourdine Imavov${T}KO (punch)${T}2${T}1:10` })
    expect(card(ufc).bouts[0].winner).toBe("Israel Adesanya")
    const ksw = normalize({ strEvent: "XTB KSW 113 Bartosiński vs Tulshaev", strLeague: "KSW", strResult: `Heavyweight 120 kg${T}Croatia Stjepan Bekavac${T}def.${T}Marcin Różalski${T}KO (punch)${T}1${T}2:59` })
    expect(card(ksw).bouts[0].names).toEqual(["Marcin Różalski", "Stjepan Bekavac"])
  })

  it("puts a fight card before its preliminary card", () => {
    const event = normalize({
      strEvent: "UFC Fight Night 292 Moicano vs Nolan", strLeague: "UFC",
      strResult: [
        "Fight card (Paramount+)",
        `Lightweight${T}Tom Nolan${T}def.${T}Renato Moicano${T}TKO (punches and elbows)${T}3${T}1:28${T}`,
        "Preliminary card (Paramount+)",
        `Catchweight (148 lb)${T}Dakota Hope${T}def.${T}Francis Marshall${T}Decision (split) (28–29, 29–28, 29–28)${T}3${T}5:00${T}`,
      ].join("\r\n"),
    })
    expect(card(event).bouts.map((bout) => bout.section)).toEqual(["main", "preliminary"])
    expect(card(event).bouts[1].scorecards).toBe("28-29, 29-28, 29-28")
    expect(event.participants.map((item) => item.name)).toEqual(["Renato Moicano", "Tom Nolan"])
  })

  it("reads a draw and a results list line by line", () => {
    const event = normalize({
      strEvent: "Cage Warriors 211 Rome", strLeague: "Cage Warriors",
      strResult: "Cage Warriors 211: Rome (Oct 17, 2026) - Full Card Results\r\nMain Event: Dario Bellandi def. Aldo Pereira - TKO (punches), Round 2, 0:13\r\nAngelo Coppola vs. Jonathan Rivera - Split Draw (29-27, 27-29, 28-28)\r\nSource: example.com",
    })
    expect(event.score).toEqual({ kind: "combat", winner: "Dario Bellandi", method: "tko", round: 2, time: "0:13" })
    expect(card(event).bouts[1]).toMatchObject({ names: ["Angelo Coppola", "Jonathan Rivera"], winner: null, outcome: "draw", scorecards: "29-27, 27-29, 28-28" })
  })

  it("finds the main event and its belt in a note that bills both", () => {
    const event = normalize({
      strEvent: "Cage Warriors 210 Dublin", strLeague: "Cage Warriors", strStatus: "FT",
      strResult: "CAGE WARRIORS 210: DUBLIN (26 Sep 2026, RDS Arena)\r\nGustavo Souza def. Paddy McCorry - Submission (D'Arce choke), R1 1:02 (Middleweight Title, Main Event)\r\nMaximus Lally def. Joao Pedro Saldanha - TKO (punches), R1 2:13 (Co-Main)",
    })
    expect(event.score).toEqual({ kind: "combat", winner: "Gustavo Souza", method: "submission", round: 1, time: "1:02" })
    expect(card(event).bouts[0]).toMatchObject({ title: "Middleweight Title", titleFight: true })
  })

  it("splits a one-line card into its sections", () => {
    const event = normalize({
      strEvent: "BKFC Fight Night Clearwater Reber vs Street", strLeague: "BKFC", strStatus: "FT",
      strResult: "BKFC Fight Night Clearwater: Reber vs Street, Oct 23, 2026. Main event: Ryan Reber def. Justin Street by unanimous decision (49-46, 49-46, 48-47), bantamweight. Main card: Michael Larrimore def. Nate Morrow, KO R2 (1:31), bantamweight; Doug Coltrane def. Tony Murphy, KO R2 (0:53), middleweight. Prelims: Tyler Baker def. Yari Kaganovsky, TKO R1 (0:43).",
    })
    expect(event).toMatchObject({ eventName: "BKFC Fight Night Clearwater", eventType: "fight-card" })
    expect(event.participants.map((item) => item.name)).toEqual(["Ryan Reber", "Justin Street"])
    expect(card(event).bouts.map((bout) => [bout.winner, bout.section, bout.weightClass])).toEqual([
      ["Ryan Reber", "main", "Bantamweight"], ["Michael Larrimore", "main", "Bantamweight"], ["Doug Coltrane", "main", "Middleweight"], ["Tyler Baker", "preliminary", null],
    ])
    expect(card(event).bouts[1]).toMatchObject({ method: "ko", round: 2, time: "1:31" })
  })

  it("reads the via format and scorecards written once for three judges", () => {
    const event = normalize({
      strEvent: "PFL MENA 10 Riyadh", strLeague: "Professional Fighters League",
      strResult: "Main Event: Hattan Alsaif def. Dania Ouhachi via TKO (R2, 3:38)\r\nBadreddine Diani def. Yousef Adel via unanimous decision (29-28 x3)\r\nStew Martin def. Joshua Williams - TKO (doctor stoppage before R3)",
    })
    expect(event.score).toEqual({ kind: "combat", winner: "Hattan Alsaif", method: "tko", round: 2, time: "3:38" })
    expect(card(event).bouts[1].scorecards).toBe("29-28, 29-28, 29-28")
    expect(card(event).bouts[2].round).toBeNull()
  })

  it("takes no round from a knockdown in a decision, and reads the judges from prose", () => {
    const event = normalize({
      strEvent: "Prime Video Boxing 16 Inoue vs Nasukawa II", strLeague: "Boxing", strStatus: "FT",
      strDescriptionEN: "Takuma Inoue and Tenshin Nasukawa meet again in Tokyo with the WBC bantamweight world championship at stake.",
      strResult: "Takuma Inoue retained the WBC bantamweight world championship with a unanimous-decision victory over Tenshin Nasukawa in their Tokyo rematch, surviving the most dangerous moment of the fight after being dropped in the seventh round. The final scorecards read 116-111, 116-111 and 114-113.",
    })
    expect(event.participants.map((item) => item.name)).toEqual(["Takuma Inoue", "Tenshin Nasukawa"])
    expect(event.score).toEqual({ kind: "combat", winner: "Takuma Inoue", method: "unanimous-decision", round: null, time: null })
    expect(card(event).bouts[0]).toMatchObject({ scorecards: "116-111, 116-111, 114-113", title: "WBC bantamweight world championship" })
  })

  it("splits a card title with no number when the preview names the fighter", () => {
    const event = normalize({
      strEvent: "PFL Chicago Carmouche vs Bishop 2", strLeague: "Professional Fighters League", strStatus: "FT",
      strResult: "Jena Bishop avenged her previous loss to Liz Carmouche with a unanimous-decision victory. Bishop won all three scorecards 48-47.",
    })
    expect(event).toMatchObject({ eventName: "PFL Chicago", eventType: "fight-card" })
    expect(event.score).toMatchObject({ kind: "combat", winner: "Jena Bishop", method: "unanimous-decision" })
    expect(card(event).bouts[0].scorecards).toBe("48-47, 48-47, 48-47")
    expect(normalize({ strEvent: "PFL Dubai Nemkov vs Bilostenniy", strLeague: "Professional Fighters League" }).participants).toEqual([])
  })

  it("names headliners of an upcoming card from its preview, and only belts that are at stake", () => {
    const ufc334 = normalize({ strEvent: "UFC 334 Gane vs Hokit", strLeague: "UFC", strTimestamp: "2026-11-14T22:00:00", strTime: "22:00:00", strDescriptionEN: "Ciryl Gane defends the UFC heavyweight title against undefeated challenger Josh Hokit at Madison Square Garden." })
    expect(ufc334.participants.map((item) => item.name)).toEqual(["Ciryl Gane", "Josh Hokit"])
    expect(card(ufc334)).toMatchObject({ title: "UFC heavyweight title" })
    expect(card(ufc334).bouts[0]).toMatchObject({ winner: null, titleFight: true })
    const fightNight = normalize({ strEvent: "UFC Fight Night 293 Cortes Acosta vs Walker", strLeague: "UFC", strTimestamp: "2026-11-07T22:00:00", strTime: "22:00:00", strDescriptionEN: "Cortes-Acosta enters ranked No. 6 and looks to strengthen his position in the UFC heavyweight title picture." })
    expect(card(fightNight).title).toBeNull()
    const zuffa = normalize({ strEvent: "Zuffa Boxing 12 Billam-Smith vs Clarke", strLeague: "Boxing", strTimestamp: "2026-11-07T17:00:00", strTime: "17:00:00", strDescriptionEN: "The former WBO world champion looks to remain in the title picture." })
    expect(card(zuffa).title).toBeNull()
    const mvpw = normalize({ strEvent: "MVPW 07 Turhan vs Baumgardner", strLeague: "Boxing", strTimestamp: "2026-11-08T22:15:00", strTime: "22:15:00", strDescriptionEN: "Elif Nur Turhan defends the IBF lightweight world title against unified super featherweight champion Alycia Baumgardner." })
    expect(mvpw.participants.map((item) => item.name)).toEqual(["Turhan", "Alycia Baumgardner"])
  })

  it("lists an announced card with its weights and belt", () => {
    const event = normalize({
      strEvent: "XTB KSW 118 Kuberski vs Michalski", strLeague: "KSW", strTimestamp: "2026-11-16T16:00:00", strTime: "16:00:00",
      strResult: "Main Event:\r\n83.9 kg — Piotr Kuberski (17–1) vs Michał Michalski (14–5) – interim middleweight title fight\r\nPreliminary Card:\r\n93.0 kg — Michał Dreczkowski (6–1) vs Cedric Lushima (7–1)",
    })
    expect(card(event).bouts).toMatchObject([
      { names: ["Michał Michalski", "Piotr Kuberski"], weightClass: "83.9 kg", title: "interim middleweight title", winner: null },
      { names: ["Cedric Lushima", "Michał Dreczkowski"], section: "preliminary", title: null },
    ])
    expect(event.participants.map((item) => item.name)).toEqual(["Piotr Kuberski", "Michał Michalski"])
  })

  it("covers kickboxing promotions with plain short names, and still not wrestling", () => {
    expect(isCovered({ idEvent: "1", strLeague: "KO" }, "combat-sports")).toBe(true)
    expect(isCovered({ idEvent: "1", strLeague: "KJP" }, "combat-sports")).toBe(true)
    expect(isCovered({ idEvent: "1", strLeague: "MLP" }, "combat-sports")).toBe(false)
    expect(kindOf(normalize({ strEvent: "KNOCK OUT 2026 vol.5", strLeague: "KO" }))).toBe("kickboxing")
  })

  it("counts each bout a fighter had on a card in Compare", () => {
    const profile = entrantProfile("Tye Ruotolo", "combat-sports", [innerCircle, fridayFights], NOW)
    expect(profile.record).toMatchObject({ played: 1, wins: 1, losses: 0 })
    expect(profile.combat).toEqual({ ko: 0, submission: 1, decision: 0 })
    expect(entrantProfile("Christian Lee", "combat-sports", [innerCircle], NOW).form).toEqual(["L"])
  })
})
