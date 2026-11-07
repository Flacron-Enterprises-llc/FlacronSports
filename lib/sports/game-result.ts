// Who won a finished game, read by each sport's own score. Form, comparison, predictions
// and tables all ask this one question, so they cannot give different answers.

import type { EventScore, SportEvent, SportId } from "./types"

/** A side this low with no result text is a game rained off, not a collapse. */
const LOWEST_CRICKET_TOTAL = 30
const VOLLEYBALL_MOST_SETS = 3
/** These never finish nil-nil, so a finished 0-0 is a result nobody entered. */
const NEVER_NIL = new Set<SportId>(["basketball", "baseball", "american-football", "volleyball", "rugby", "ice-hockey"])

type Decided = { winner: 0 | 1 | null }

function cricketDecided(event: Pick<SportEvent, "participants" | "details">, score: Extract<EventScore, { kind: "innings" }>, guess: boolean): Decided | null {
  if (score.outcome === "drawn" || score.outcome === "tied") return { winner: null }
  if (score.outcome === "no-result") return null
  if (score.outcome === "won") {
    const at = event.participants.findIndex((side) => side.name === score.winner)
    return at === 0 || at === 1 ? { winner: at } : null
  }
  // Only a calculated table guesses, and says so: a rain-revised target can make the lower
  // total the winner, so picks, form and comparisons wait for a stated result.
  if (!guess) return null
  // Across two innings a higher total can still be a draw, and an equal one may have gone to a super over.
  const format = event.details?.kind === "cricket" ? event.details.format : null
  if (format === "test" || format === "first-class" || !score.home || !score.away || score.home.runs === score.away.runs) return null
  if (Math.min(score.home.runs, score.away.runs) < LOWEST_CRICKET_TOTAL) return null
  return { winner: score.home.runs > score.away.runs ? 0 : 1 }
}

function teamDecided(event: Pick<SportEvent, "sportId" | "conclusion" | "shootout">, score: Extract<EventScore, { kind: "team" }>): Decided | null {
  const { home, away } = score
  if (event.sportId === "volleyball" && (home === away || Math.max(home, away) > VOLLEYBALL_MOST_SETS)) return null
  if (home === 0 && away === 0 && NEVER_NIL.has(event.sportId)) return null
  if (home !== away) return { winner: home > away ? 0 : 1 }
  // Level after a shootout means the source did not say who won it unless it gives the kicks.
  if (event.conclusion !== "penalties" && event.conclusion !== "shootout") return { winner: null }
  if (!event.shootout || event.shootout.home === event.shootout.away) return null
  return { winner: event.shootout.home > event.shootout.away ? 0 : 1 }
}

/** The side that won, null for a draw, or no answer when the source does not settle it. */
export function decidedSide(event: Pick<SportEvent, "sportId" | "status" | "participants" | "details" | "score" | "conclusion" | "shootout">, options: { guessCricket?: boolean } = {}): Decided | null {
  if (event.status !== "finished") return null
  if (event.score.kind === "innings") return cricketDecided(event, event.score, options.guessCricket === true)
  return event.score.kind === "team" ? teamDecided(event, event.score) : null
}

/** A tennis match the source gave no winner for still has one when a side retired: the other side. */
export function setsWinner(score: Extract<EventScore, { kind: "sets" }>): string | null {
  if (score.winner) return score.winner
  return score.retired ? score.lines.find((line) => line.name !== score.retired)?.name ?? null : null
}
