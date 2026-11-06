import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { PlanCards } from "@/components/billing/plan-cards"
import { CtaBand, PageHeader } from "@/components/site/marketing/blocks"
import { FaqSection } from "@/components/site/marketing/faq"
import { ADDON_ORDER, addonPrice, EVERY_PLAN, PLAN_MATRIX } from "@/lib/billing/matrix"
import { PLANS } from "@/lib/billing/plans"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

const PLAN_IDS = ["free", "plus", "premium"] as const

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await pageContext(params)
  return { title: t.nav.pricing, description: getMarketing(locale).pricingPage.seoDescription }
}

export default async function PricingPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value)

  return (
    <main id="main">
      <div className="relative overflow-hidden">
        <div aria-hidden className="fs-dots pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:pt-16">
          <PageHeader crumbs={[[m.common.home, href("/")], [t.nav.pricing, href("/pricing")]]} title={t.pricing.title} lead={t.pricing.lead} />
          <div className="mt-12"><PlanCards /></div>
          <p className="mt-6 max-w-4xl text-sm leading-6 text-ink-2">{t.pricing.disclaimer}</p>
        </div>
      </div>

      <section aria-labelledby="compare" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <h2 id="compare" data-reveal className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink">{t.pricing.compare}</h2>
        <div data-reveal className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">{t.pricing.compare}</caption>
            <thead className="bg-surface-muted text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">{t.pricing.benefit}</th>
                {PLAN_IDS.map((id) => <th key={id} scope="col" className="px-5 py-3 font-semibold">{PLANS[id].name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PLAN_MATRIX.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-5 py-3.5 align-top font-medium text-ink">{row.label[locale]}</th>
                  {PLAN_IDS.map((id) => <td key={id} className="px-5 py-3.5 align-top text-ink-2">{row.cells[id].text[locale]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="every-plan" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <h2 id="every-plan" data-reveal className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink">{t.pricing.everyPlan}</h2>
        <ul data-reveal className="mt-6 grid gap-3 text-sm text-ink-2 sm:grid-cols-2 lg:grid-cols-3">
          {EVERY_PLAN.map((item) => (
            <li key={item.en} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-good" />
              {item[locale]}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="add-ons" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <h2 id="add-ons" data-reveal className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink">{t.pricing.addonsTitle}</h2>
        <p data-reveal className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">{t.pricing.addonsLead}</p>
        <div data-reveal className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADDON_ORDER.map((sku) => (
            <article key={sku} className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <h3 className="font-semibold text-ink">{t.addons.items[sku][0]}</h3>
              <p className="tabular mt-2 font-display text-2xl font-bold text-ink">{money(addonPrice(sku))}</p>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-2">{t.addons.items[sku][1]}</p>
            </article>
          ))}
        </div>
        <p data-reveal className="mt-4 text-xs leading-5 text-ink-2">{t.addons.note} {t.pricing.tax}</p>
        <Link data-reveal href={href("/signup")} className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-hot-text underline-offset-2 hover:underline">{m.common.createAccount}</Link>
      </section>

      <FaqSection
        id="billing-faq"
        title={m.pricingPage.faqTitle}
        intro={m.pricingPage.faqIntro}
        faqs={m.pricingPage.faqs}
        more={{ before: m.common.moreAnswers, label: m.common.fullFaq, href: href("/faq") }}
      />

      <CtaBand title={m.pricingPage.ctaTitle} body={m.pricingPage.ctaBody} primary={{ href: href("/signup"), label: m.common.createAccount }} secondary={{ href: href("/features"), label: t.nav.allFeatures }} />
    </main>
  )
}
