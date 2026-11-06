// Pages whose own content narrows to a sport. Anywhere else the switcher opens Scores.
const WATCH_FILTERS = ["competition", "team", "athlete", "tournament", "race", "session", "series", "format"]
const SPORT_PAGES = ["/app/scores", "/app/watch", "/app/search"]

export function sportSwitchPath(path: string, search: string, sport: string | null): string {
  const here = SPORT_PAGES.includes(path)
  const query = new URLSearchParams(here ? search : "")
  query.delete("page")
  // Watch filters belong to one sport, and carrying them over would empty the next one.
  if (path === "/app/watch") for (const key of WATCH_FILTERS) query.delete(key)
  if (sport) query.set("sport", sport)
  else query.delete("sport")
  const text = query.toString()
  return `${here ? path : "/app/scores"}${text ? `?${text}` : ""}`
}
