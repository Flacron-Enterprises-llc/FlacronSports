"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Medal } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { EmptyState, ListSkeleton, Panel } from "@/components/site/states"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { pickWords, type PickFields } from "@/lib/community/pick-words"
import type { PredictionGame, PredictionStatus } from "@/lib/community/predictions"
import { useLocale } from "@/lib/use-locale"
import { UpcomingGames } from "./upcoming-games"

interface MyPick extends PickFields {
  matchId: string
  game: PredictionGame | null
  kickoffUTC: string
  status: PredictionStatus
  points: number | null
}

const CHIP = "inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] font-semibold text-ink-2"

/** A settled or void pick says how the game went, so both wait behind spoiler mode. */
function PickStatus({ pick }: { pick: MyPick }) {
  const { t } = useLocale()
  if (pick.status === "open") return <span data-status="open" className={CHIP}>{t.community.statusOpen}</span>
  if (pick.status === "locked") return <span data-status="locked" className={CHIP}>{t.community.statusLocked}</span>
  return (
    <SpoilerGuard label={t.spoiler.revealResult}>
      {pick.status === "void" ? (
        <span data-status="void" className={CHIP}>{t.community.statusVoid}</span>
      ) : (
        <span data-status="settled" className={CHIP}>{t.community.statusSettled} · {t.community.pointsEarned.replace("{count}", String(pick.points ?? 0))}</span>
      )}
    </SpoilerGuard>
  )
}

export function MyPredictions() {
  const { t, href } = useLocale()
  const [picks, setPicks] = useState<MyPick[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/predictions/mine").catch(() => null)
    if (response?.ok) setPicks((await response.json()).predictions)
    else setFailed(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel id="my-predictions" title={t.community.myPredictions} description={t.community.myPredictionsLead} icon={<Medal aria-hidden />}>
        {failed && !picks && <ErrorNotice onRetry={load}>{t.community.myPredictionsFailed}</ErrorNotice>}
        {!picks && !failed && <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={3} /></div>}
        {picks?.length === 0 && <EmptyState compact icon={<Medal aria-hidden />} title={t.community.noPredictions} body={t.community.noPredictionsBody} action={{ href: href("/app/scores?status=upcoming"), label: t.community.browseUpcoming }} />}
        {picks && picks.length > 0 && (
          <ul className="space-y-2 text-sm">
            {picks.map((pick) => (
              <li key={pick.matchId} data-testid="my-prediction" className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg border border-line px-3 py-2.5">
                <div className="min-w-0 flex-1 basis-56">
                  <Link href={href(`/app/match/${pick.matchId}?tab=chat`)} className="block truncate font-semibold text-ink underline-offset-2 hover:underline">{pick.game?.title ?? t.community.gameUnavailable}</Link>
                  <p className="mt-0.5 break-words font-medium text-hot-text">{pickWords(pick, pick.game, t.community)}</p>
                  <p className="mt-0.5 text-xs text-ink-2"><LocalTime iso={pick.kickoffUTC} mode="datetime" /></p>
                </div>
                <PickStatus pick={pick} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <UpcomingGames picked={picks?.map((pick) => pick.matchId) ?? []} />
    </div>
  )
}
