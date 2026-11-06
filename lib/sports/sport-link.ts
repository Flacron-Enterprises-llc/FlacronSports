// Pages whose own content narrows to a sport. Anywhere else the switcher opens Scores.
const SPORT_PAGES = ["/app/scores", "/app/watch", "/app/search"]

export function sportSwitchPath(path: string, search: string, sport: string | null): string {
  const here = SPORT_PAGES.includes(path)
  const query = new URLSearchParams(here ? search : "")
  query.delete("page")
  if (sport) query.set("sport", sport)
  else query.delete("sport")
  const text = query.toString()
  return `${here ? path : "/app/scores"}${text ? `?${text}` : ""}`
}
