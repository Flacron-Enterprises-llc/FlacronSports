import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CircleCheck, Eye, ListChecks, MonitorPlay, ShieldCheck, Star, UserPlus } from "lucide-react"
import { PLANS } from "@/lib/billing/plans"
import { CheckList, CtaBand, reveal, rise, StatusBadge } from "@/components/site/marketing/blocks"
import { buttonClass } from "@/components/site/marketing/button"
import { FaqSection } from "@/components/site/marketing/faq"
import { FeatureMock, HeroMock } from "@/components/site/marketing/mocks"
import { FeatureIcon } from "@/components/site/feature-icon"
import { CountUp } from "@/components/site/motion"
import { SportIcon } from "@/components/site/sport-icon"
import { FEATURES, getMarketing, money } from "@/lib/marketing"
import { LOCALES } from "@/lib/i18n"
import { pageContext, type LocaleParams } from "@/lib/page-context"
import { SPORTS } from "@/lib/sports/types"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await pageContext(params)
  return { description: getMarketing(locale).home.seoDescription }
}

const STEP_ICONS = [UserPlus, Star, Eye]
const VIEW_ICONS = [ShieldCheck, ListChecks, MonitorPlay, CircleCheck]
const H2 = "text-[1.9rem] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[2.3rem]"
const LEAD = "mt-4 text-[16.5px] leading-7 text-ink-2"
const TEXT_LINK = "fs-link mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold text-hot-text"

export default async function HomePage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const h = m.home
  const enabled = SPORTS.filter((sport) => sport.enabled)

  return (
    <main id="main">
      <section className="fs-band overflow-hidden" aria-labelledby="hero-title">
        <div aria-hidden className="fs-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-24">
          <div className="min-w-0">
            <p className="fs-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[13px] text-white/80">
              <span className="fs-badge-dot inline-block size-1.5 shrink-0 rounded-full bg-orange" />
              {h.badge}
            </p>
            <h1 id="hero-title" className="fs-rise mt-7 text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[3.4rem] lg:text-[3.9rem]" style={rise(1)}>{h.title}</h1>
            <p className="fs-rise mt-7 max-w-xl text-lg leading-8 text-white/75" style={rise(2)}>{h.lead}</p>
            <div className="fs-rise mt-10 flex flex-wrap gap-3" style={rise(3)}>
              <Link href={href("/signup")} className={buttonClass("primary", "lg")}>{h.primary} <ArrowRight aria-hidden className="size-4" /></Link>
              <a href="#how-it-works" className={buttonClass("inverse-outline", "lg")}>{h.secondary}</a>
            </div>
            <ul className="fs-rise mt-10 grid gap-3 text-sm text-white/70 sm:grid-cols-3" style={rise(4)}>
              {h.proof.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-orange" /> {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="fs-rise relative isolate min-w-0 lg:pl-6" style={rise(2)}>
            <div aria-hidden className="pointer-events-none absolute -inset-16 -z-10 hidden lg:block">
              <div className="fs-rings absolute inset-0" />
              <div className="fs-radar absolute inset-[12%] opacity-60" />
            </div>
            <HeroMock m={m} locale={locale} />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-28 sm:px-6" aria-labelledby="how-heading">
        <div data-reveal className="max-w-2xl">
          <h2 id="how-heading" className={H2}>{h.howTitle}</h2>
          <p className={LEAD}>{h.howLead}</p>
        </div>
        <ol className="relative mt-14 grid gap-5 md:grid-cols-3">
          <span aria-hidden className="absolute left-[16%] right-[16%] top-[30px] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent md:block" />
          {h.steps.map((step, index) => {
            const Icon = STEP_ICONS[index]
            return (
              <li key={step.title} data-reveal style={reveal(index)} className="relative rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-sm)]">
                <span className="relative inline-flex size-[60px] items-center justify-center rounded-2xl border border-line bg-bg text-brand shadow-[var(--shadow-sm)]">
                  <Icon aria-hidden className="size-6" />
                  <span className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full bg-hot font-display text-xs font-semibold text-hot-on">{index + 1}</span>
                </span>
                <h3 className="mt-6 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2.5 text-[15px] leading-7 text-ink-2">{step.body}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="spot-scores">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div data-reveal className="min-w-0">
            <p className="text-sm font-medium text-hot-text">{h.spotScores.eyebrow}</p>
            <h2 id="spot-scores" className={`mt-4 ${H2}`}>{h.spotScores.title}</h2>
            <p className={LEAD}>{h.spotScores.lead}</p>
            <CheckList className="mt-7" items={h.spotScores.items} />
            <Link href={href("/features/match-center")} className={TEXT_LINK}>{h.spotScores.link} <ArrowRight aria-hidden className="size-4" /></Link>
          </div>
          <div data-reveal style={reveal(1)} className="min-w-0"><FeatureMock kind="match" m={m} locale={locale} /></div>
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="features-heading">
        <div data-reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 id="features-heading" className={H2}>{h.featuresTitle}</h2>
            <p className={LEAD}>{h.featuresLead}</p>
          </div>
          <Link href={href("/features")} className={buttonClass("outline", "md", "self-start lg:self-auto")}>{h.featuresLink}</Link>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li key={feature.slug} data-reveal style={reveal(index % 3)}>
              <Link href={href(`/features/${feature.slug}`)} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease)] hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-navy text-white shadow-[var(--shadow-sm)] transition-colors duration-300 group-hover:bg-hot group-hover:text-hot-on dark:bg-white/10 dark:text-brand">
                    <FeatureIcon k={feature.icon} />
                  </span>
                  {feature.comingSoon && <StatusBadge soon>{m.common.comingSoon}</StatusBadge>}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{feature[locale].name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-ink-2">{feature[locale].blurb}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-hot-text">
                  {m.common.learnMore} <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="spot-teams">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div data-reveal className="order-2 min-w-0 lg:order-1"><FeatureMock kind="teams" m={m} locale={locale} /></div>
          <div data-reveal style={reveal(1)} className="order-1 min-w-0 lg:order-2">
            <p className="text-sm font-medium text-hot-text">{h.spotTeams.eyebrow}</p>
            <h2 id="spot-teams" className={`mt-4 ${H2}`}>{h.spotTeams.title}</h2>
            <p className={LEAD}>{h.spotTeams.lead}</p>
            <CheckList className="mt-7" items={h.spotTeams.items} />
            <Link href={href("/features/my-teams-and-alerts")} className={TEXT_LINK}>{h.spotTeams.link} <ArrowRight aria-hidden className="size-4" /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="spot-assistant">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div data-reveal className="min-w-0">
            <p className="text-sm font-medium text-hot-text">{h.spotAssistant.eyebrow}</p>
            <h2 id="spot-assistant" className={`mt-4 ${H2}`}>{h.spotAssistant.title}</h2>
            <p className={LEAD}>{h.spotAssistant.lead}</p>
            <CheckList className="mt-7" items={h.spotAssistant.items} />
            <Link href={href("/features/sports-assistant")} className={TEXT_LINK}>{h.spotAssistant.link} <ArrowRight aria-hidden className="size-4" /></Link>
          </div>
          <div data-reveal style={reveal(1)} className="min-w-0"><FeatureMock kind="assistant" m={m} locale={locale} /></div>
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="sports-heading">
        <div data-reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 id="sports-heading" className={H2}>{h.sportsTitle}</h2>
            <p className={LEAD}>{h.sportsLead}</p>
          </div>
          <Link href={href("/sports")} className={buttonClass("outline", "md", "self-start lg:self-auto")}>{m.common.allSports}</Link>
        </div>
        <dl data-reveal className="mt-10 grid gap-4 sm:grid-cols-2">
          {([[enabled.length, h.statAvailable], [LOCALES.length, h.statLanguages]] as const).map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <dd className="font-display text-[2rem] font-semibold leading-none text-ink"><CountUp value={value} /></dd>
              <dt className="mt-2 text-sm text-ink-2">{label}</dt>
            </div>
          ))}
        </dl>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {enabled.map((sport, index) => (
            <li key={sport.id} data-reveal style={reveal(index)} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
              <SportIcon id={sport.id} className="size-7 text-brand" />
              <span className="text-sm font-semibold leading-5 text-ink">{sport.name[locale]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="viewing-heading">
        <div data-reveal className="grid gap-12 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:p-14">
          <div className="min-w-0">
            <span className="fs-tint-good inline-flex size-12 items-center justify-center rounded-2xl text-good"><ShieldCheck aria-hidden className="size-6" /></span>
            <h2 id="viewing-heading" className="mt-6 text-[1.9rem] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[2.2rem]">{h.viewingTitle}</h2>
            <p className={LEAD}>{h.viewingLead}</p>
            <p className="mt-4 text-sm leading-6 text-ink-3">{t.watch.disclaimer}</p>
            <Link href={href("/features/watch-options")} className={TEXT_LINK}>{h.viewingLink} <ArrowRight aria-hidden className="size-4" /></Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {h.viewingItems.map((item, index) => {
              const Icon = VIEW_ICONS[index]
              return (
                <li key={item.title} data-reveal style={reveal(index)} className="rounded-2xl border border-line bg-bg p-5">
                  <Icon aria-hidden className="size-5 text-brand" />
                  <p className="mt-3 font-semibold text-ink">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-ink-2">{item.body}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="pricing-heading">
        <div data-reveal className="rounded-3xl border border-line bg-surface-muted p-6 sm:p-8 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <h2 id="pricing-heading" className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-ink">{h.planTitle}</h2>
              <p className="mt-3 text-[16px] leading-7 text-ink-2">{h.planLead}</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href={href("/pricing")} className={buttonClass("navy", "lg")}>{h.planLink}</Link>
              <Link href={href("/signup")} className={buttonClass("outline", "lg")}>{h.planStart}</Link>
            </div>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {(["basic", "plus", "premium"] as const).map((id) => (
              <li key={id} className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="font-semibold text-ink">{PLANS[id].name}</h3>
                <p className="mt-2">
                  <span className="tabular font-display text-[1.75rem] font-semibold text-ink">{money(locale, PLANS[id].monthlyPriceUsd)}</span>
                  <span className="text-sm text-ink-3">{h.perMonth}</span>
                </p>
                {<p className="mt-1 text-xs text-ink-3">{h.orAnnual.replace("{price}", money(locale, PLANS[id].annualPriceUsd))}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-5 text-ink-3">{t.pricing.disclaimer}</p>
        </div>
      </section>

      <FaqSection
        id="home-faq"
        className="mt-28"
        title={h.faqTitle}
        intro={h.faqIntro}
        faqs={m.faqs.slice(0, 4)}
        more={{ before: m.common.moreAnswers, label: m.common.fullFaq, href: href("/faq") }}
      />

      <CtaBand
        title={h.ctaTitle}
        body={h.ctaBody}
        primary={{ href: href("/signup"), label: m.common.createAccount }}
        secondary={{ href: href("/pricing"), label: m.common.comparePlans }}
      />
    </main>
  )
}
