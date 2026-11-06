import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ListOrdered } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { pageContext, titled } from "@/lib/page-context"
import { CUP_COMPETITIONS } from "@/lib/sports/seasons"
import { getStandings, type StandingRow } from "@/lib/sports/service"
import { standingZones, type StandingZone } from "@/lib/sports/zones"

export const generateMetadata = titled((t) => t.standings.title)
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string; leagueId: string }> }

// Each zone also lists its places in the legend, so colour is never the only signal.
const ZONE_TONES: Record<StandingZone["tone"], string> = { first: "bg-good", second: "bg-navy", third: "bg-orange", fourth: "bg-ink-3", fifth: "bg-warn", down: "bg-bad" }

export default async function StandingsPage({ params }: Props) {
  const { leagueId } = await params
  const { t, href } = await pageContext(params)
  if (!/^\d{1,8}$/.test(leagueId)) notFound()

  const table = await getStandings(leagueId)
  if (table.state === "withheld") return <MemberDataPending />
  const copy = t.standings

  const columns: [keyof StandingRow, string][] = [
    ["played", copy.played], ["won", copy.won], ["drawn", copy.drawn], ["lost", copy.lost],
    ["scoredFor", copy.scoredFor], ["scoredAgainst", copy.scoredAgainst], ["difference", copy.difference], ["points", copy.points],
  ]
  // A column the feed never fills is dropped. A single gap shows a dash, never zero.
  const shown = columns.filter(([key]) => table.rows.some((row) => row[key] !== null))
  const zones = standingZones(table.rows)
  const zoneOf = (row: StandingRow) => zones.find((zone) => zone.label === row.zone)

  return (
    <AppPage>
      <PageHeader title={table.league ?? copy.title} lead={table.season ? `${copy.season}: ${table.season}` : undefined} icon={<ListOrdered aria-hidden />} />

      {CUP_COMPETITIONS.some((cup) => cup.id === leagueId) && (
        <Link href={href(`/app/cups?competition=${leagueId}`)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-hot-text hover:underline">{t.cups.link}<ArrowRight aria-hidden className="size-3.5" /></Link>
      )}
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
                  <td className="tabular relative px-3 py-2.5 font-semibold text-ink-2">
                    {zoneOf(row) && <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${ZONE_TONES[(zoneOf(row) as StandingZone).tone]}`} />}
                    {row.rank ?? "–"}
                    {row.zone && <span className="sr-only"> ({row.zone})</span>}
                  </td>
                  <th scope="row" className="whitespace-nowrap px-3 py-2.5 text-left font-medium text-ink">{row.team}</th>
                  {shown.map(([key]) => <td key={key} className={`tabular px-3 py-2.5 text-right ${key === "points" ? "font-semibold text-ink" : "text-ink-2"}`}>{row[key] ?? "–"}</td>)}
                  <td className="tabular whitespace-nowrap px-3 py-2.5 text-ink-2">{row.form ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {table.state === "ok" && zones.length > 0 && (
        <section aria-label={copy.zones} className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
          <h2 className="font-semibold text-ink">{copy.zones}</h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {zones.map((zone) => (
              <li key={zone.label} className="flex min-w-0 items-center gap-2 text-ink-2">
                <span aria-hidden className={`h-4 w-1 shrink-0 rounded-full ${ZONE_TONES[zone.tone]}`} />
                <span className="tabular shrink-0 font-semibold text-ink">{zone.places}</span>
                <span lang="en" className="min-w-0">{zone.label}</span>
              </li>
            ))}
          </ul>
        </section>
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
