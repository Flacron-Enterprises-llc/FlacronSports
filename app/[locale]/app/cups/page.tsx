import Link from "next/link"
import { Network } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, chipClass, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { Crest, LocalTime, SpoilerGuard } from "@/components/sports/parts"
import type { Dictionary } from "@/lib/i18n"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { resultLine } from "@/lib/sports/presentation"
import { CUP_COMPETITIONS } from "@/lib/sports/seasons"
import { getCupRounds } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"

export const generateMetadata = titled((t) => t.cups.title, { robots: { index: false } })
export const dynamic = "force-dynamic"

type Props = LocaleParams & { searchParams: Promise<{ competition?: string }> }

function CupGame({ game, t, tbd, href }: { game: SportEvent; t: Dictionary; tbd: string; href(path: string): string }) {
  const { score, shootout, aggregate, conclusion } = game
  const scores = score.kind === "team" ? [score.home, score.away] : null
  const ranked = shootout ? [shootout.home, shootout.away] : scores
  // A leg can be won and the tie lost on kicks the source does not give, so neither side is marked.
  const open = conclusion === "penalties" && !shootout
  const won = (index: number) => !open && ranked !== null && ranked[0] !== ranked[1] && ranked[index] > ranked[1 - index]
  const other = score.kind === "team" ? null : resultLine(game, t)
  const when = game.scheduledStartUTC && !game.dateOnly ? <LocalTime iso={game.scheduledStartUTC} mode="datetime" /> : tbd
  return (
    <li className="min-w-0">
      <Link href={href(`/app/match/${game.id}`)} aria-label={game.participants.map((side) => side.name).join(" / ")} className="fs-lift block h-full rounded-lg border border-line bg-surface px-3 py-2">
        <ul>
          {game.participants.map((side, index) => (
            <li key={side.name} className="flex min-h-7 items-center gap-2 text-sm">
              <Crest name={side.name} url={side.badgeUrl} size="xs" />
              <span className={cn("min-w-0 flex-1 truncate", won(index) ? "font-semibold text-ink" : scores ? "text-ink-2" : "font-medium text-ink")}>{side.name}</span>
              {shootout && <span className="tabular text-xs text-ink-2">({index === 0 ? shootout.home : shootout.away})</span>}
              {scores && <span className={cn("tabular font-display text-[15px] font-semibold", won(index) ? "text-ink" : "text-ink-2")}>{scores[index]}</span>}
            </li>
          ))}
        </ul>
        {!scores && <p className="tabular mt-1 truncate border-t border-line pt-1 text-xs text-ink-2">{other ?? when}</p>}
        {aggregate && <SpoilerGuard label={t.spoiler.revealResult} quiet><p className="tabular mt-1 truncate border-t border-line pt-1 text-xs text-ink-2">{t.match.aggregateScore.replace("{home}", String(aggregate.home)).replace("{away}", String(aggregate.away))}</p></SpoilerGuard>}
      </Link>
    </li>
  )
}

export default async function CupsPage({ params, searchParams }: Props) {
  const { t, href } = await pageContext(params)
  const { competition } = await searchParams
  const chosen = CUP_COMPETITIONS.find((item) => item.id === competition) ?? CUP_COMPETITIONS[0]
  const cup = await getCupRounds(chosen.id)
  if (cup.state === "withheld") return <MemberDataPending />
  const copy = t.cups

  return (
    <AppPage>
      <PageHeader title={copy.title} lead={copy.lead} icon={<Network aria-hidden />} />
      <nav aria-label={copy.choose} className="fs-noscrollbar fs-rise -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {CUP_COMPETITIONS.map((item) => (
          <Link key={item.id} href={href(`/app/cups?competition=${item.id}`)} aria-current={item.id === chosen.id ? "page" : undefined} className={chipClass(item.id === chosen.id)}>{item.name}</Link>
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
                <Panel key={round.key} title={copy.rounds[round.key]} actions={<span className="tabular text-xs text-ink-2">{(round.games.length === 1 ? t.scores.oneGame : t.scores.games).replace("{count}", String(round.games.length))}</span>}>
                  <ul className="fs-settle grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {round.games.map((game) => <CupGame key={game.id} game={game} t={t} tbd={copy.tbd} href={href} />)}
                  </ul>
                </Panel>
              ))}
            </div>
          </SpoilerGuard>
        </>
      )}

      {cup.state !== "unavailable" && <p className="mt-4 text-xs leading-5 text-ink-2">{t.feed.updated}: <LocalTime iso={cup.fetchedAt} mode="datetime" /></p>}
    </AppPage>
  )
}
