import { describe, expect, it } from "vitest"
import { answerQuestion, normalize, type AssistantSources } from "@/lib/assistant/engine"
import { REFERENCE, REFERENCE_REVIEWED_UTC } from "@/lib/assistant/reference"
import type { Locale } from "@/lib/i18n"

const now = new Date("2026-11-07T12:00:00Z")
const noFeed = async () => {
  throw new Error("A rule question must not reach the sports feed")
}
const sources = { getEvents: noFeed, getTeamFixtures: noFeed, getStandings: noFeed } as unknown as AssistantSources
const entry = (id: string) => REFERENCE.find((item) => item.id === id)

const ask = (question: string, locale: Locale = "en") => answerQuestion(question, locale, sources, now)

const QUESTIONS: [string, Locale, string][] = [
  ["What is LBW in cricket?", "en", "cricket-lbw"],
  ["what's lbw", "en", "cricket-lbw"],
  ["What does leg before wicket mean?", "en", "cricket-lbw"],
  ["Qu'est-ce que le LBW au cricket ?", "fr", "cricket-lbw"],
  ["What is an over?", "en", "cricket-overs"],
  ["c'est quoi un over au cricket", "fr", "cricket-overs"],
  ["What is a wicket?", "en", "cricket-wicket"],
  ["Qu'est-ce qu'un guichet ?", "fr", "cricket-wicket"],
  ["What are innings in cricket?", "en", "cricket-innings"],
  ["What is a duck in cricket?", "en", "cricket-duck"],
  ["What is DLS?", "en", "cricket-dls"],
  ["Explain the Duckworth-Lewis method", "en", "cricket-dls"],
  ["What is Test cricket?", "en", "cricket-test"],
  ["What is an ODI?", "en", "cricket-odi"],
  ["What is T20?", "en", "cricket-t20"],
  ["What is a strike rate?", "en", "cricket-strike-rate"],
  ["What is a powerplay in cricket?", "en", "cricket-powerplay"],
  ["What is travelling in basketball?", "en", "traveling"],
  ["What is the shot clock?", "en", "shot-clock"],
  ["How much is a three-pointer worth?", "en", "scoring"],
  ["When does a player foul out?", "en", "fouls"],
  ["What is overtime in basketball?", "en", "overtime"],
  ["c'est quoi la prolongation au basket", "fr", "overtime"],
  ["What are downs in American football?", "en", "american-football-downs"],
  ["What is a first down?", "en", "american-football-downs"],
  ["What is a touchdown?", "en", "american-football-touchdown"],
  ["What is a field goal?", "en", "american-football-field-goal"],
  ["What's a safety in American football?", "en", "american-football-safety"],
  ["What is a two-point conversion?", "en", "two-point-conversion"],
  ["How many innings are in baseball?", "en", "baseball-innings"],
  ["Qu'est-ce qu'une manche au baseball ?", "fr", "baseball-innings"],
  ["What is a strike in baseball?", "en", "baseball-strike"],
  ["What is a ball in baseball?", "en", "baseball-ball"],
  ["What is a home run?", "en", "baseball-home-run"],
  ["What is a balk?", "en", "baseball-balk"],
  ["What is an RBI?", "en", "baseball-rbi"],
  ["What is icing in hockey?", "en", "hockey-icing"],
  ["c'est quoi l'icing", "fr", "hockey-icing"],
  ["What is offside in ice hockey?", "en", "hockey-offside"],
  ["Qu'est-ce que le hors-jeu au hockey ?", "fr", "hockey-offside"],
  ["What is a power play?", "en", "hockey-power-play"],
  ["What is the penalty box?", "en", "hockey-penalty-box"],
  ["What is a shootout in hockey?", "en", "hockey-shootout"],
  ["What is deuce in tennis?", "en", "tennis-deuce"],
  ["What is a tie-break?", "en", "tennis-tie-break"],
  ["Qu'est-ce qu'un jeu décisif ?", "fr", "tennis-tie-break"],
  ["What is a set in tennis?", "en", "tennis-set"],
  ["What is an ace?", "en", "tennis-ace"],
  ["What is a let?", "en", "tennis-let"],
  ["What is a try in rugby?", "en", "rugby-try"],
  ["Qu'est-ce qu'un essai au rugby ?", "fr", "rugby-try"],
  ["What is a conversion in rugby?", "en", "rugby-conversion"],
  ["What is a scrum?", "en", "rugby-scrum"],
  ["Qu'est-ce qu'une mêlée ?", "fr", "rugby-scrum"],
  ["What is a ruck?", "en", "rugby-ruck"],
  ["What is a lineout?", "en", "rugby-lineout"],
  ["What is a drop goal?", "en", "rugby-drop-goal"],
  ["What is rally scoring?", "en", "volleyball-rally-scoring"],
  ["What is a libero?", "en", "volleyball-libero"],
  ["What is a set in volleyball?", "en", "volleyball-set"],
  ["Qu'est-ce qu'un set au volley ?", "fr", "volleyball-set"],
  ["What is rotation in volleyball?", "en", "volleyball-rotation"],
  ["What is a TKO?", "en", "combat-tko"],
  ["What is a split decision?", "en", "combat-split-decision"],
  ["What is a submission?", "en", "combat-submission"],
  ["What are weight classes?", "en", "combat-weight-classes"],
  ["Qu'est-ce qu'une catégorie de poids ?", "fr", "combat-weight-classes"],
  ["What is pole position?", "en", "motorsport-pole-position"],
  ["What is DRS?", "en", "motorsport-drs"],
  ["What is a pit stop?", "en", "motorsport-pit-stop"],
  ["Qu'est-ce qu'un arrêt au stand ?", "fr", "motorsport-pit-stop"],
  ["What is a safety car?", "en", "motorsport-safety-car"],
  ["What is a sprint in F1?", "en", "motorsport-sprint"],
  // Words that belong to football stay with football.
  ["What is offside?", "en", "offside"],
  ["Qu'est-ce qu'un penalty ?", "fr", "penalty"],
  ["What is a penalty shootout?", "en", "extra-time"],
  ["What is a set piece?", "en", "set-piece"],
]

describe("rule notes", () => {
  it.each(QUESTIONS)("%s (%s)", async (question, locale, id) => {
    const answer = await ask(question, locale)
    expect(answer.kind).toBe("rule")
    expect(answer.text).toBe(entry(id)?.[locale])
    expect(answer.asOfUTC).toBe(REFERENCE_REVIEWED_UTC)
    expect(answer.sources[0]).toEqual({ label: entry(id)?.source.label, url: entry(id)?.source.url })
  })

  it("does not read an ordinary English word as a rule", async () => {
    const quiet = { ...sources, getEvents: async () => ({ state: "ok", events: [], source: "", fetchedAt: now.toISOString(), limited: false }) } as unknown as AssistantSources
    const answer = await answerQuestion("let me try to find something", "en", quiet, now)
    expect(answer.kind).toBe("unknown")
  })

  it("keeps every entry complete, with terms the lookup can match", () => {
    expect(new Set(REFERENCE.map((item) => item.id)).size).toBe(REFERENCE.length)
    for (const item of REFERENCE) {
      expect(item.en.length).toBeGreaterThan(30)
      expect(item.fr.length).toBeGreaterThan(30)
      expect(item.fr).not.toBe(item.en)
      expect(item.source.url).toMatch(/^https:\/\//)
      for (const term of item.terms) expect(normalize(term)).toBe(term)
    }
  })

  it("carries a valid review date", () => {
    expect(new Date(REFERENCE_REVIEWED_UTC).toISOString()).toBe(REFERENCE_REVIEWED_UTC)
    expect(Date.parse(REFERENCE_REVIEWED_UTC)).toBeLessThanOrEqual(now.getTime())
  })
})
