import Link from "next/link"
import { Eye, EyeOff, ShieldCheck, Star } from "lucide-react"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import { EmptyState } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"
import { getEvents } from "@/lib/sports/service"
import { SPORTS } from "@/lib/sports/types"

const ICONS = [ShieldCheck, Eye, Star, EyeOff]

export default async function HomePage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const feed = await getEvents()
  const events = [...feed.events].sort((a, b) => Number(b.status === "live") - Number(a.status === "live")).slice(0, 6)

  return (
    <main id="main">
      <section className="fs-band overflow-hidden">
        <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
          <p style={{ "--i": 0 } as React.CSSProperties} className="fs-rise text-sm font-semibold text-[#ffb08a]">{t.home.eyebrow}</p>
          <h1 style={{ "--i": 1 } as React.CSSProperties} className="fs-rise mt-4 max-w-3xl text-4xl font-bold leading-[1.1] text-white sm:text-6xl">{t.home.title}</h1>
          <p style={{ "--i": 2 } as React.CSSProperties} className="fs-rise mt-5 max-w-2xl text-lg leading-8 text-white/80">{t.home.lead}</p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="fs-rise mt-8 flex flex-wrap gap-3">
            <Link href={href("/scores")} className="rounded-md bg-orange px-5 py-3 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover">{t.home.ctaScores}</Link>
            <Link href={href("/pricing")} className="rounded-md border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">{t.home.ctaPricing}</Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <li key={sport.id}>
                {sport.enabled ? (
                  <Link href={href(`/scores?sport=${sport.id}`)} className="inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20">{sport.name[locale]}</Link>
                ) : (
                  <span title={t.scores.comingSoon} className="inline-block rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">{sport.name[locale]}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="today" className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 id="today" className="text-2xl font-bold text-ink">{t.home.today}</h2>
          <Link href={href("/scores")} className="text-sm font-semibold text-hot-text hover:underline">{t.home.allScores}</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
        </div>
        {events.length === 0 && feed.state !== "unavailable" && <EmptyState title={t.scores.empty} body={t.feed.limited} />}
        <div className="mt-4"><FeedNotice feed={feed} t={t} /></div>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <h2 id="features" className="max-w-2xl text-3xl font-bold text-ink">{t.home.featuresTitle}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {t.home.features.map(([title, body], index) => {
            const Icon = ICONS[index]
            return (
              <div key={title} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
                <Icon aria-hidden className="size-6 text-hot-text" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{body}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="plans" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="fs-band overflow-hidden rounded-2xl p-8 sm:p-12">
          <h2 id="plans" className="max-w-2xl text-3xl font-bold text-white">{t.home.plansTitle}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-white/80">{t.home.plansLead}</p>
          <Link href={href("/pricing")} className="mt-6 inline-block rounded-md bg-orange px-5 py-3 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover">{t.home.ctaPricing}</Link>
        </div>
      </section>
    </main>
  )
}
