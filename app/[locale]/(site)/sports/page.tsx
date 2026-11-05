import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CtaBand, PageHeader, reveal, StatusBadge } from "@/components/site/marketing/blocks"
import { buttonClass } from "@/components/site/marketing/button"
import { SportIcon } from "@/components/site/sport-icon"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"
import { SPORTS } from "@/lib/sports/types"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await pageContext(params)
  return { title: t.nav.sports, description: getMarketing(locale).sportsPage.seoDescription }
}

export default async function SportsPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const p = m.sportsPage
  const sports = SPORTS.filter((sport) => sport.enabled)

  return (
    <main id="main">
      <div className="relative overflow-hidden">
        <div aria-hidden className="fs-dots pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:pt-16">
          <PageHeader
            crumbs={[[m.common.home, href("/")], [t.nav.sports, href("/sports")]]}
            title={p.title}
            lead={p.lead}
            actions={<Link href={href("/signup")} className={buttonClass("primary", "lg")}>{m.common.createAccount} <ArrowRight aria-hidden className="size-4" /></Link>}
          />
        </div>
      </div>

      <section aria-labelledby="available" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div data-reveal className="max-w-2xl">
          <h2 id="available" className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink">{p.availableTitle}</h2>
          <p className="mt-3 text-[16px] leading-7 text-ink-2">{p.availableLead}</p>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map((sport, index) => (
            <li key={sport.id} data-reveal style={reveal(index % 3)} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-xl bg-navy text-white dark:bg-white/10 dark:text-brand">
                  <SportIcon id={sport.id} />
                </span>
                <StatusBadge>{p.available}</StatusBadge>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{sport.name[locale]}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-2">{m.sportLines[sport.id]}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mx-auto mt-8 max-w-7xl px-4 text-sm text-ink-3 sm:px-6">{p.coverageNote}</p>

      <CtaBand title={p.ctaTitle} body={p.ctaBody} primary={{ href: href("/signup"), label: m.common.createAccount }} secondary={{ href: href("/pricing"), label: m.common.comparePlans }} />
    </main>
  )
}
