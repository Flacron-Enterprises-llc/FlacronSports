import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { CheckList, CtaBand, PageHeader, reveal, rise, StatusBadge } from "@/components/site/marketing/blocks"
import { buttonClass } from "@/components/site/marketing/button"
import { FeatureMock } from "@/components/site/marketing/mocks"
import { FeatureIcon } from "@/components/site/feature-icon"
import { FEATURES, getFeature, getMarketing } from "@/lib/marketing"
import { pageContext } from "@/lib/page-context"

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return FEATURES.map((feature) => ({ slug: feature.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { locale } = await pageContext(params)
  const copy = getFeature(slug)?.[locale]
  return copy ? { title: copy.seoTitle, description: copy.description } : {}
}

const H2 = "text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2.1rem]"

export default async function FeaturePage({ params }: Props) {
  const { slug } = await params
  const { locale, t, href } = await pageContext(params)
  const feature = getFeature(slug)
  if (!feature) notFound()

  const m = getMarketing(locale)
  const p = m.featurePage
  const copy = feature[locale]
  const soon = Boolean(feature.comingSoon)
  const others = FEATURES.filter((other) => other.slug !== feature.slug).slice(0, 3)

  return (
    <main id="main">
      <div className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1fr_0.92fr] lg:pt-16">
          <div className="min-w-0">
            <PageHeader
              crumbs={[[m.common.home, href("/")], [t.nav.features, href("/features")], [copy.name, href(`/features/${feature.slug}`)]]}
              title={copy.h1}
              lead={copy.lead}
              actions={
                <>
                  <Link href={href("/signup")} className={buttonClass("primary", "lg")}>{m.common.createAccount} <ArrowRight aria-hidden className="size-4" /></Link>
                  <Link href={href("/pricing")} className={buttonClass("outline", "lg")}>{p.seePlans}</Link>
                </>
              }
            />
            <p className="fs-rise mt-6 flex flex-wrap items-center gap-2 text-sm text-ink-2" style={rise(4)}>
              <StatusBadge soon={soon}>{soon ? m.common.comingSoon : m.common.available}</StatusBadge>
              <span>{soon ? m.common.soonLine : m.common.onEveryPlan}</span>
            </p>
          </div>
          <div className="fs-rise relative min-w-0" style={rise(2)}>
            <FeatureMock kind={feature.scene} m={m} locale={locale} />
          </div>
        </div>
      </div>

      <section aria-labelledby="what" className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div data-reveal className="flex items-center gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white dark:bg-white/10 dark:text-brand"><FeatureIcon k={feature.icon} /></span>
          <h2 id="what" className={H2}>{p.what}</h2>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {copy.points.map((point, index) => (
            <li key={point.title} data-reveal style={reveal(index % 2)} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <h3 className="text-lg font-semibold text-ink">{point.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink-2">{point.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <h2 id="how" data-reveal className={H2}>{p.how}</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {copy.steps.map((step, index) => (
            <li key={step.title} data-reveal style={reveal(index)} className="relative rounded-2xl border border-line bg-surface p-6">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-hot font-display text-sm font-semibold text-hot-on">{index + 1}</span>
              <h3 className="mt-4 font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-[15px] leading-7 text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="benefits" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <div data-reveal className="grid gap-10 rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-12">
          <div>
            <span className="fs-tint-good inline-flex size-11 items-center justify-center rounded-xl text-good"><ShieldCheck aria-hidden className="size-5" /></span>
            <h2 id="benefits" className="mt-5 text-[1.6rem] font-semibold tracking-[-0.025em] text-ink">{soon ? p.benefitsSoon : p.benefits}</h2>
            <p className="mt-3 text-sm leading-6 text-ink-3">{soon ? p.benefitsSoonLead : p.benefitsLead}</p>
          </div>
          <div>
            <CheckList items={copy.benefits} />
            {feature.broadcastNote && <p className="mt-6 border-t border-line pt-5 text-sm leading-6 text-ink-2">{t.watch.disclaimer}</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="more" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <h2 id="more" className="text-xl font-semibold text-ink">{p.explore}</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {others.map((other) => (
            <li key={other.slug}>
              <Link href={href(`/features/${other.slug}`)} className="group flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand"><FeatureIcon k={other.icon} /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{other[locale].name}</span>
                  <span className="mt-1 block text-sm leading-6 text-ink-2">{other[locale].blurb}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CtaBand
        title={(soon ? p.ctaSoonTitle : p.ctaTitle).replace("{name}", copy.name)}
        body={soon ? p.soonCta : p.ctaBody}
        primary={{ href: href("/signup"), label: m.common.createAccount }}
        secondary={{ href: href("/pricing"), label: m.common.comparePlans }}
      />
    </main>
  )
}
