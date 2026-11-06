import { notFound } from "next/navigation"
import { ListOrdered } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { pageContext, titled } from "@/lib/page-context"
import { getStandings, type StandingRow } from "@/lib/sports/service"

export const generateMetadata = titled((t) => t.standings.title)
export const revalidate = 300

type Props = { params: Promise<{ locale: string; leagueId: string }> }

export default async function StandingsPage({ params }: Props) {
  const { leagueId } = await params
  const { t, href } = await pageContext(params)
  if (!/^\d{1,8}$/.test(leagueId)) notFound()

  const table = await getStandings(leagueId)
  const copy = t.standings

  const columns: [keyof StandingRow, string][] = [
    ["played", copy.played], ["won", copy.won], ["drawn", copy.drawn], ["lost", copy.lost],
    ["scoredFor", copy.scoredFor], ["scoredAgainst", copy.scoredAgainst], ["difference", copy.difference], ["points", copy.points],
  ]
  // A column the feed never fills is dropped. A single gap shows a dash, never zero.
  const shown = columns.filter(([key]) => table.rows.some((row) => row[key] !== null))

  return (
    <AppPage>
      <PageHeader title={table.league ?? copy.title} lead={table.season ? `${copy.season}: ${table.season}` : undefined} icon={<ListOrdered aria-hidden />} />

      {table.state === "unavailable" && <ErrorNotice>{copy.unavailable}</ErrorNotice>}
      {table.state === "empty" && <EmptyState icon={<ListOrdered aria-hidden />} title={copy.empty} body={copy.emptyBody} action={{ href: href("/app/scores"), label: copy.browse }} />}

      {table.state === "ok" && (
        <div className="fs-rise overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]">
          <table className="w-full text-sm">
            <caption className="sr-only">{table.league ?? copy.title}</caption>
            <thead>
              <tr className="border-b border-line bg-surface-muted text-left text-xs text-ink-2">
                <th scope="col" className="px-3 py-2.5 font-medium">{copy.rank}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{copy.team}</th>
                {shown.map(([key, label]) => <th key={key} scope="col" className="px-3 py-2.5 text-right font-medium">{label}</th>)}
                <th scope="col" className="px-3 py-2.5 font-medium">{copy.form}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={`${row.rank}-${row.team}`} className="border-b border-line transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="tabular px-3 py-2.5 font-semibold text-ink-2">{row.rank ?? "–"}</td>
                  <th scope="row" className="whitespace-nowrap px-3 py-2.5 text-left font-medium text-ink">{row.team}</th>
                  {shown.map(([key]) => <td key={key} className={`tabular px-3 py-2.5 text-right ${key === "points" ? "font-semibold text-ink" : "text-ink-2"}`}>{row[key] ?? "–"}</td>)}
                  <td className="tabular whitespace-nowrap px-3 py-2.5 text-ink-2">{row.form ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-1 text-xs leading-5 text-ink-3">
        {table.limited && table.state === "ok" && <p>{copy.limited}</p>}
        <p>
          {t.feed.updated}: <LocalTime iso={table.fetchedAt} mode="datetime" />
          {table.state === "ok" && <> · {copy.sourceUpdated}: {table.sourceUpdatedAt ? <LocalTime iso={table.sourceUpdatedAt} mode="datetime" /> : copy.notSupplied}</>}
        </p>
      </div>
    </AppPage>
  )
}
