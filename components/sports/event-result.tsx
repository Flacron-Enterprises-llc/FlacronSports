import type { Dictionary } from "@/lib/i18n"
import { inningsLine, resultNote } from "@/lib/sports/presentation"
import type { ClassificationEntry, SportEvent } from "@/lib/sports/types"
import { FavoriteStar, SpoilerGuard } from "./parts"

/** The outcome in words. It names the winner, so it stays behind the spoiler reveal. */
export function ResultNote({ event, t, quiet }: { event: SportEvent; t: Dictionary; quiet?: boolean }) {
  const note = resultNote(event, t)
  if (!note) return null
  return (
    <SpoilerGuard label={t.spoiler.revealResult} quiet={quiet}>
      <p className="text-sm font-medium text-ink">{note}</p>
    </SpoilerGuard>
  )
}

/** Entrants appear only inside the reveal: their order is the result. */
export function Classification({ entries, t, limit, quiet }: { entries: ClassificationEntry[]; t: Dictionary; limit?: number; quiet?: boolean }) {
  const shown = limit ? entries.slice(0, limit) : entries
  return (
    <SpoilerGuard label={t.spoiler.revealResult} quiet={quiet}>
      <ol aria-label={limit ? t.event.podium : t.event.classification} className="space-y-1">
        {shown.map((entry) => (
          <li key={entry.position} className="flex items-center gap-1 text-sm text-ink">
            <span className="tabular w-6 shrink-0 font-semibold text-ink-2">{entry.position}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
            <FavoriteStar team={entry.name} />
            {!limit && entry.team && <span className="hidden min-w-0 truncate text-ink-2 sm:block">{entry.team}</span>}
            {!limit && typeof entry.laps === "number" && <span className="tabular hidden shrink-0 text-xs text-ink-2 sm:block">{t.event.laps.replace("{laps}", String(entry.laps))}</span>}
            {!limit && typeof entry.grid === "number" && <span className="tabular shrink-0 text-xs text-ink-2">{t.event.grid.replace("{grid}", String(entry.grid))}</span>}
            {entry.time && <span className="tabular shrink-0 text-ink-2">{entry.time}</span>}
          </li>
        ))}
      </ol>
    </SpoilerGuard>
  )
}

function SetsTable({ event, t }: { event: SportEvent; t: Dictionary }) {
  if (event.score.kind !== "sets") return null
  const { lines, tiebreaks } = event.score
  const rows = event.participants.flatMap((participant) => lines.filter((line) => line.name === participant.name))
  // A walkover has no sets to show, only the note below.
  if (rows.every((row) => row.games.length === 0)) return null
  return (
    <SpoilerGuard label={t.spoiler.revealResult}>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">{t.event.sets}</caption>
          <thead>
            <tr className="bg-surface-muted text-xs text-ink-2">
              <th scope="col" className="px-3 py-2 text-left font-medium">{t.event.name}</th>
              {rows[0]?.games.map((_, index) => <th key={index} scope="col" className="px-2 py-2 text-center font-medium">{t.event.set.replace("{n}", String(index + 1))}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-semibold text-ink">{row.name}</th>
                {row.games.map((games, index) => {
                  const other = rows.find((line) => line !== row)?.games[index]
                  const lost = other !== undefined && games < other
                  return <td key={index} className="tabular px-2 py-2 text-center font-semibold text-ink">{games}{lost && tiebreaks?.[index] != null && <sup className="ml-0.5 font-medium text-ink-2">{tiebreaks[index]}</sup>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SpoilerGuard>
  )
}

function InningsTable({ event, t }: { event: SportEvent; t: Dictionary }) {
  if (event.score.kind !== "innings") return null
  const { home, away, homeInnings, awayInnings } = event.score
  const rows = [{ innings: home, list: homeInnings, name: event.participants[0]?.name }, { innings: away, list: awayInnings, name: event.participants[1]?.name }]
  return (
    <SpoilerGuard label={t.spoiler.revealResult}>
      <dl aria-label={t.event.innings} className="divide-y divide-line rounded-lg border border-line text-sm">
        {rows.map(({ innings, list, name }) => innings && (
          <div key={name} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
            <dt className="min-w-0 truncate font-semibold text-ink">{name}</dt>
            <dd className="tabular shrink-0 text-ink">
              <span className="font-display font-semibold">{inningsLine(list, innings)}</span>
              {innings.overs && <span className="ml-2 text-ink-2">{t.event.overs.replace("{overs}", innings.overs)}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </SpoilerGuard>
  )
}

/** The result block of a match page for every sport-specific score form. */
export function EventResult({ event, t }: { event: SportEvent; t: Dictionary }) {
  const { score } = event
  if (score.kind === "none" || score.kind === "team") return null
  return (
    <div className="space-y-3">
      <h2 className="text-[15.5px] font-semibold text-ink">
        {score.kind === "sets" ? t.event.sets : score.kind === "innings" ? t.event.innings : score.kind === "classification" ? t.event.classification : t.event.result}
      </h2>
      <SetsTable event={event} t={t} />
      <InningsTable event={event} t={t} />
      {score.kind === "classification" && <Classification entries={score.entries} t={t} />}
      <ResultNote event={event} t={t} />
    </div>
  )
}
