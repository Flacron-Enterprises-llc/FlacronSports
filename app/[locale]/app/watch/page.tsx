import { CalendarClock, Clapperboard, History, PlayCircle, Radio } from "lucide-react"
import { AppPage, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.watch.title)

const ICONS = [Radio, CalendarClock, Clapperboard, History]

export default async function WatchPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  const feed = await getEvents()
  const live = feed.events.filter((event) => event.status === "live").slice(0, 3)
  return (
    <AppPage>
      <PageHeader title={t.watch.title} lead={t.watch.lead} icon={<PlayCircle aria-hidden />} />
      <EmptyState icon={<PlayCircle aria-hidden />} title={t.watch.empty} body={t.watch.emptyBody} action={{ href: href("/app/scores"), label: t.watch.cta }} />
      <ul className="fs-stagger mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {t.watch.sections.map((section, index) => {
          const Icon = ICONS[index]
          return (
            <li key={section}>
              <Panel className="h-full p-4 sm:p-4" title={section} icon={<Icon aria-hidden />}><p className="text-sm text-ink-2">{t.ui.nothingYet}</p></Panel>
            </li>
          )
        })}
      </ul>
      {live.length > 0 && (
        <section aria-label={t.ui.followInstead} className="mt-7">
          <h2 className="text-[17px] font-semibold text-ink">{t.ui.followInstead}</h2>
          <div className="fs-stagger mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
          </div>
        </section>
      )}
      <Notice className="mt-6" role="note">{t.watch.disclaimer}</Notice>
    </AppPage>
  )
}
