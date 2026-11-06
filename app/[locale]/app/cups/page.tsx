import Link from "next/link"
import { Network } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { resultLine } from "@/lib/sports/presentation"
import { CUP_COMPETITIONS } from "@/lib/sports/seasons"
import { getCupRounds } from "@/lib/sports/service"
import { cn } from "@/lib/utils"

export const generateMetadata = titled((t) => t.cups.title, { robots: { index: false } })
export const dynamic = "force-dynamic"

type Props = LocaleParams & { searchParams: Promise<{ competition?: string }> }

export default async function CupsPage({ params, searchParams }: Props) {
  const { t, href } = await pageContext(params)
  const { competition } = await searchParams
  const chosen = CUP_COMPETITIONS.find((item) => item.id === competition) ?? CUP_COMPETITIONS[0]
  const cup = await getCupRounds(chosen.id)
  if (cup.state === "withheld") return <MemberDataPending />
  const copy = t.cups

  return (
    <AppPage width="md">
      <PageHeader title={copy.title} lead={copy.lead} icon={<Network aria-hidden />} />
      <nav aria-label={copy.choose} className="fs-rise mb-5 flex flex-wrap gap-2">
        {CUP_COMPETITIONS.map((item) => (
          <Link key={item.id} href={href(`/app/cups?competition=${item.id}`)} aria-current={item.id === chosen.id ? "page" : undefined} className={cn("inline-flex min-h-9 items-center rounded-lg border px-3 text-[13px] font-semibold transition-colors", item.id === chosen.id ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-2 hover:text-ink")}>{item.name}</Link>
        ))}
      </nav>

      {cup.state === "unavailable" && <ErrorNotice>{copy.unavailable}</ErrorNotice>}
      {cup.state === "empty" && <EmptyState icon={<Network aria-hidden />} title={copy.empty} body={copy.emptyBody} />}
      {cup.state === "stale" && <Notice className="mb-4" tone="warning" role="status">{copy.stale}</Notice>}

      {cup.items.length > 0 && (
        <>
          <p className="mb-3 text-sm text-ink-2">{cup.competition} · {t.standings.season}: {cup.season}. {copy.basis}</p>
          {/* A later round names who went through, so the whole list stays behind one reveal. */}
          <SpoilerGuard label={copy.reveal}>
            <div className="space-y-4">
              {cup.items.map((round) => (
                <Panel key={round.key} title={copy.rounds[round.key]}>
                  <ul className="divide-y divide-line">
                    {round.games.map((game) => (
                      <li key={game.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <Link href={href(`/app/match/${game.id}`)} className="min-w-0 font-medium text-ink underline-offset-2 hover:underline">{game.participants.map((side) => side.name).join(" v ")}</Link>
                        <span className="tabular shrink-0 text-right text-ink-2">
                          {resultLine(game, t) ?? (game.scheduledStartUTC && !game.dateOnly ? <LocalTime iso={game.scheduledStartUTC} mode="datetime" /> : copy.tbd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          </SpoilerGuard>
        </>
      )}

      {cup.state !== "unavailable" && <p className="mt-4 text-xs leading-5 text-ink-3">{t.feed.updated}: <LocalTime iso={cup.fetchedAt} mode="datetime" /></p>}
    </AppPage>
  )
}
