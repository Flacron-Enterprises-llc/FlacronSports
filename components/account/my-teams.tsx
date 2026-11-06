"use client"

import Link from "next/link"
import { ArrowRight, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAccount } from "@/components/dashboard/account-context"
import { EmptyState, Meter, Panel } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { Crest, useFavorites } from "@/components/sports/parts"
import { PLANS } from "@/lib/billing/plans"
import { followsEvent } from "@/lib/sports/following"
import type { EventFeed } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"

export function MyTeams({ feed }: { feed: EventFeed }) {
  const { t, href } = useLocale()
  const { names, toggle } = useFavorites()
  const { plan, loaded } = useAccount()
  const limit = PLANS[plan].favoritesLimit

  if (names.length === 0) {
    return <EmptyState icon={<Star aria-hidden />} title={t.myTeams.empty} body={t.myTeams.emptyBody} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />
  }

  const remove = async (name: string) => {
    if ((await toggle(name)) === "failed") toast(t.ui.saveFailed)
  }
  const today = feed.events.filter((event) => followsEvent(names, event))

  return (
    <div className="space-y-6">
      {loaded && limit !== null && (
        <Panel className="p-4 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{t.ui.favoritesUsed.replace("{count}", String(names.length)).replace("{limit}", String(limit))}</span>
            <Link href={href("/app/billing#plans")} className="font-semibold text-hot-text hover:underline">{t.dash.upgrade}</Link>
          </div>
          <Meter value={names.length} max={limit} label={t.myTeams.following} className="mt-2" />
        </Panel>
      )}

      <section aria-label={t.myTeams.following}>
        <ul className="fs-stagger grid gap-3 sm:grid-cols-2">
          {names.map((name) => (
            <li key={name} className="fs-lift flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
              <Crest name={name} />
              <Link href={href(`/app/team/${encodeURIComponent(name)}`)} className="min-w-0 flex-1 truncate font-medium text-ink underline-offset-2 hover:underline">{name}</Link>
              <Link href={href(`/app/scores?q=${encodeURIComponent(name)}`)} aria-label={`${t.nav.scores}: ${name}`} title={t.nav.scores} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-muted hover:text-ink"><ArrowRight aria-hidden className="size-4" /></Link>
              <button type="button" onClick={() => remove(name)} aria-label={`${t.myTeams.remove}: ${name}`} title={t.myTeams.remove} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-muted hover:text-bad"><Trash2 aria-hidden className="size-4" /></button>
            </li>
          ))}
        </ul>
      </section>

      {today.length > 0 && (
        <section aria-label={t.dash.favorites}>
          <h2 className="text-[17px] font-semibold text-ink">{t.dash.favorites}</h2>
          <div className="fs-stagger mt-3 grid gap-4 sm:grid-cols-2">
            {today.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
          </div>
        </section>
      )}
    </div>
  )
}
