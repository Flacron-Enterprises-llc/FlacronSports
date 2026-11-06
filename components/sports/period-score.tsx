import type { Dictionary } from "@/lib/i18n"
import { lineScore, type LineCell } from "@/lib/sports/adapters/line-score"
import type { SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { SpoilerGuard } from "./parts"

function Cell({ cell, t, strong }: { cell: LineCell | undefined; t: Dictionary; strong?: boolean }) {
  const value = cell?.value ?? null
  return (
    <td className={cn("tabular px-1.5 py-1 text-center", strong ? "font-semibold text-ink" : "text-ink-2")}>
      {value ?? <><span aria-hidden>–</span><span className="sr-only">{t.match.notAvailable}</span></>}
    </td>
  )
}

/**
 * A sport's own scoring table: quarters, periods, sets, or a baseball line score. Every
 * column states the result, so all of it stays behind the spoiler reveal. `compact` is
 * the card's size, where the short headings fit.
 */
export function PeriodScore({ event, t, compact }: { event: SportEvent; t: Dictionary; compact?: boolean }) {
  const table = lineScore(event, t, compact ? "short" : "long")
  if (!table) return null
  return (
    <SpoilerGuard label={t.spoiler.revealResult} quiet={compact}>
      <div className={cn("overflow-x-auto", !compact && "rounded-lg border border-line")}>
        <table className={cn("w-full", compact ? "text-xs" : "text-sm")}>
          <caption className="sr-only">{table.caption}</caption>
          <thead>
            <tr className={cn("text-ink-2", compact ? "text-[11px]" : "bg-surface-muted text-xs")}>
              <th scope="col" className={cn("text-left font-medium", compact ? "py-1 pr-2" : "px-3 py-2")}><span className="sr-only">{t.event.name}</span></th>
              {table.columns.map((column) => <th key={column.key} scope="col" title={column.title} className="whitespace-nowrap px-1.5 py-1 text-center font-medium">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.side} className={cn(!compact && "border-t border-line")}>
                <th scope="row" className={cn("truncate text-left font-medium text-ink", compact ? "max-w-24 py-1 pr-2" : "max-w-40 px-3 py-2")}>{row.name}</th>
                {table.columns.map((column, index) => <Cell key={column.key} cell={row.cells[index]} t={t} strong={column.total} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SpoilerGuard>
  )
}
