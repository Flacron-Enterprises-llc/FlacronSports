import type { Dictionary, Locale } from "@/lib/i18n"
import type { Preferences } from "@/lib/me/preferences-defaults"
import { SPORTS } from "@/lib/sports/types"

const MAX_TIPS = 4

/** Chips for the team and sport the member follows, or the general ones when they follow nothing. */
export function suggestionsFor(prefs: Pick<Preferences, "favorites" | "leagues" | "players">, locale: Locale, t: Dictionary): string[] {
  const copy = t.assistant
  const team = prefs.favorites[0]
  const sport = SPORTS.find((item) => item.id === (prefs.leagues[0]?.sportId ?? prefs.players[0]?.sportId))
  const name = sport?.name[locale].toLowerCase()
  const tips = [
    ...(team ? [copy.tipTeamResult.replace("{team}", team), copy.tipTeamNext.replace("{team}", team)] : []),
    ...(name ? [copy.tipFixtures, copy.tipLive, copy.tipResults].map((tip) => tip.replace("{sport}", name)) : []),
    ...t.ui.assistantTips,
  ]
  return [...new Set(tips)].slice(0, MAX_TIPS)
}
