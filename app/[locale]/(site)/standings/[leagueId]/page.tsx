import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EmptyState, PageHeader } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { pageContext } from "@/lib/page-context"
import { getStandings, type StandingRow } from "@/lib/sports/service"

export const metadata: Metadata = { title: "Standings" }
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
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={table.league ?? copy.title} lead={table.season ? `${copy.season}: ${table.season}` : undefined} />

      {table.state === "unavailable" && <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-bad">{copy.unavailable}</p>}
      {table.state === "empty" && <EmptyState title={copy.empty} body={copy.emptyBody} action={{ href: href("/scores"), label: copy.browse }} />}

      {table.state === "ok" && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">{table.league ?? copy.title}</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="px-3 py-2 font-medium">{copy.rank}</th>
                <th scope="col" className="px-3 py-2 font-medium">{copy.team}</th>
                {shown.map(([key, label]) => <th key={key} scope="col" className="px-3 py-2 text-right font-medium">{label}</th>)}
                <th scope="col" className="px-3 py-2 font-medium">{copy.form}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={`${row.rank}-${row.team}`} className="border-b border-line last:border-0">
                  <td className="tabular px-3 py-2 text-ink-2">{row.rank ?? "–"}</td>
                  <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink">{row.team}</th>
                  {shown.map(([key]) => <td key={key} className="tabular px-3 py-2 text-right text-ink">{row[key] ?? "–"}</td>)}
                  <td className="tabular px-3 py-2 text-ink-2">{row.form ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-1 text-xs leading-5 text-ink-3">
        {table.limited && table.state === "ok" && <p>{copy.limited}</p>}
        <p>
          {t.feed.source}: {table.source} · {t.feed.updated}: <LocalTime iso={table.fetchedAt} mode="datetime" />
          {table.state === "ok" && <> · {copy.sourceUpdated}: {table.sourceUpdatedAt ? <LocalTime iso={table.sourceUpdatedAt} mode="datetime" /> : copy.notSupplied}</>}
        </p>
      </div>
    </main>
  )
}
