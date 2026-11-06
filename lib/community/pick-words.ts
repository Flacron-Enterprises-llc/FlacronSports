import type { Dictionary } from "@/lib/i18n"

export interface PickFields {
  home: number | null
  away: number | null
  winner: string | null
  podium: string[] | null
}

type Words = Pick<Dictionary["community"], "pickWinnerText" | "podiumPlaces">

/** A pick in plain words. Team names are left out only when the game could not be read. */
export function pickWords(pick: PickFields, game: { home: string | null; away: string | null } | null, words: Words): string {
  if (pick.podium) return pick.podium.map((name, index) => `${words.podiumPlaces[index]}: ${name}`).join(", ")
  if (pick.winner) return words.pickWinnerText.replace("{name}", pick.winner)
  const score = `${pick.home} – ${pick.away}`
  return game?.home && game.away ? `${game.home} ${score} ${game.away}` : score
}
