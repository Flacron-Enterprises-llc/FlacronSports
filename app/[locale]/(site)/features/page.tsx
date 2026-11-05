import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CtaBand, PageHeader, reveal, StatusBadge } from "@/components/site/marketing/blocks"
import { buttonClass } from "@/components/site/marketing/button"
import { HeroMock } from "@/components/site/marketing/mocks"
import { FeatureIcon } from "@/components/site/feature-icon"
import { FEATURES, getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await pageContext(params)
  return { title: t.nav.features, description: getMarketing(locale).featuresPage.seoDescription }
}

export default async function FeaturesPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const p = m.featuresPage

  return (
    <main id="main">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-16">
        <PageHeader
          crumbs={[[m.common.home, href("/")], [t.nav.features, href("/features")]]}
          title={p.title}
          lead={p.lead}
          actions={<Link href={href("/signup")} className={buttonClass("primary", "lg")}>{m.common.createAccount} <ArrowRight aria-hidden className="size-4" /></Link>}
        />
        <div className="fs-rise min-w-0"><HeroMock m={m} locale={locale} caption={p.caption} /></div>
      </div>

      <section aria-labelledby="all-features" className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <h2 id="all-features" className="sr-only">{p.listTitle}</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature, index) => {
            const copy = feature[locale]
            return (
              <li key={feature.slug} data-reveal style={reveal(index % 2)}>
                <Link href={href(`/features/${feature.slug}`)} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white dark:bg-white/10 dark:text-brand"><FeatureIcon k={feature.icon} /></span>
                      <h3 className="min-w-0 text-lg font-semibold text-ink">{copy.name}</h3>
                    </div>
                    {feature.comingSoon && <StatusBadge soon>{m.common.comingSoon}</StatusBadge>}
                  </div>
                  <p className="mt-4 flex-1 text-[15px] leading-7 text-ink-2">{copy.lead}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-hot-text">
                    {m.common.learnMore} <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="included" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <h2 id="included" data-reveal className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink">{p.includedTitle}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.included.map((item, index) => (
            <li key={item.title} data-reveal style={reveal(index)} className="h-full rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-2">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <CtaBand title={m.cta.title} body={m.cta.body} primary={{ href: href("/signup"), label: m.common.createAccount }} secondary={{ href: href("/pricing"), label: m.common.comparePlans }} />
    </main>
  )
}
