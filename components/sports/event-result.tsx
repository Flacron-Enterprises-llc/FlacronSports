import type { Dictionary } from "@/lib/i18n"
import { inningsLine, resultNote, setsWon } from "@/lib/sports/presentation"
import type { ClassificationEntry, SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
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

/** Cricket's state of play in the source's words, where no result line already says it. Can reveal the result. */
export function StatusNote({ event, t, quiet }: { event: SportEvent; t: Dictionary; quiet?: boolean }) {
  const note = event.details?.kind === "cricket" ? event.details.statusNote : null
  if (!note || resultNote(event, t)) return null
  return (
    <SpoilerGuard label={t.spoiler.revealResult} quiet={quiet}>
      <p className="text-sm text-ink-2">{note}</p>
    </SpoilerGuard>
  )
}

/** Entrants appear only inside the reveal: their order is the result. */
export function Classification({ entries, t, limit, quiet }: { entries: ClassificationEntry[]; t: Dictionary; limit?: number; quiet?: boolean }) {
  const shown = limit ? entries.slice(0, limit) : entries
  return (
    <SpoilerGuard label={t.spoiler.revealResult} quiet={quiet}>
      {limit ? (
        <ol aria-label={t.event.podium} className="space-y-0.5">
          {shown.map((entry) => (
            <li key={entry.position} className="flex min-h-7 items-center gap-1 text-sm text-ink">
              <span className="tabular w-5 shrink-0 font-semibold text-ink-2">{entry.position}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
              <FavoriteStar team={entry.name} />
              {entry.time && <span className="tabular shrink-0 text-xs text-ink-2">{entry.time}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <ol aria-label={t.event.classification} className="-mx-4 divide-y divide-line sm:-mx-5">
          {shown.map((entry) => (
            <li key={entry.position} className="fs-row grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-1.5 text-sm sm:px-5">
              <span className={cn("tabular inline-flex size-7 items-center justify-center rounded-lg text-[13px] font-bold", entry.position === 1 ? "fs-chip-hot" : entry.position <= 3 ? "bg-surface-muted text-ink" : "text-ink-2")}>{entry.position}</span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1">
                  <span className="min-w-0 truncate font-semibold text-ink">{entry.name}</span>
                  <FavoriteStar team={entry.name} />
                </span>
                {entry.team && <span className="block truncate text-xs text-ink-2">{entry.team}</span>}
              </span>
              <span className="text-right">
                {entry.time && <span className="tabular block font-medium text-ink">{entry.time}</span>}
                {(typeof entry.laps === "number" || typeof entry.grid === "number") && (
                  <span className="tabular block whitespace-nowrap text-xs text-ink-2">{[typeof entry.laps === "number" ? t.event.laps.replace("{laps}", String(entry.laps)) : null, typeof entry.grid === "number" ? t.event.grid.replace("{grid}", String(entry.grid)) : null].filter(Boolean).join(" ")}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </SpoilerGuard>
  )
}

function SetsTable({ event, t }: { event: SportEvent; t: Dictionary }) {
  if (event.score.kind !== "sets") return null
  const { lines, tiebreaks, winner } = event.score
  const rows = event.participants.flatMap((participant) => lines.filter((line) => line.name === participant.name))
  // A walkover has no sets to show, only the note below.
  if (rows.every((row) => row.games.length === 0)) return null
  const totals = setsWon(event)
  return (
    <SpoilerGuard label={t.spoiler.revealResult}>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">{t.event.sets}</caption>
          <thead>
            <tr className="bg-surface-muted text-xs text-ink-2">
              <th scope="col" className="px-3 py-2 text-left font-medium"><span className="sr-only">{t.event.name}</span></th>
              {rows[0]?.games.map((_, index) => <th key={index} scope="col" className="whitespace-nowrap px-2 py-2 text-center font-medium">{t.event.set.replace("{n}", String(index + 1))}</th>)}
              {totals && <th scope="col" className="px-2 py-2 text-center font-medium">{t.match.lineSets}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.name} className="border-t border-line">
                <th scope="row" className={cn("max-w-44 truncate px-3 py-2.5 text-left text-ink", row.name === winner ? "font-semibold" : "font-medium")}>{row.name}</th>
                {row.games.map((games, index) => {
                  const other = rows.find((line) => line !== row)?.games[index]
                  const lost = other !== undefined && games < other
                  return <td key={index} className={cn("tabular px-2 py-2.5 text-center", lost ? "text-ink-2" : "font-semibold text-ink")}>{games}{lost && tiebreaks?.[index] != null && <sup className="ml-0.5 font-medium text-ink-2">{tiebreaks[index]}</sup>}</td>
                })}
                {totals && <td className="fs-foot tabular px-2 py-2.5 text-center font-display text-[15px] font-bold text-ink">{totals[rowIndex]}</td>}
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
  const { home, away, homeInnings, awayInnings, winner } = event.score
  const rows = [{ innings: home, list: homeInnings, name: event.participants[0]?.name }, { innings: away, list: awayInnings, name: event.participants[1]?.name }]
  return (
    <SpoilerGuard label={t.spoiler.revealResult}>
      <dl aria-label={t.event.innings} className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ innings, list, name }) => innings && (
          <div key={name} className={cn("min-w-0 rounded-lg border p-3", name === winner ? "border-line-strong" : "border-line")}>
            <dt className="truncate text-[13px] font-medium text-ink-2">{name}</dt>
            <dd className="mt-1">
              <span className="fs-score block break-words text-2xl font-semibold text-ink">{inningsLine(list, innings)}</span>
              {innings.overs && <span className="tabular mt-1 block text-[13px] text-ink-2">{t.event.overs.replace("{overs}", innings.overs)}</span>}
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
      <h2 className="text-[15px] font-semibold leading-6 text-ink">
        {score.kind === "sets" ? t.event.sets : score.kind === "innings" ? t.event.innings : score.kind === "classification" ? t.event.classification : t.event.result}
      </h2>
      <SetsTable event={event} t={t} />
      <InningsTable event={event} t={t} />
      {score.kind === "classification" && <Classification entries={score.entries} t={t} />}
      <ResultNote event={event} t={t} />
      <StatusNote event={event} t={t} />
    </div>
  )
}
