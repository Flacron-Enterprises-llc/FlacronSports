import type { Metadata } from "next"
import { PlanCards } from "@/components/billing/plan-cards"
import { CtaBand, PageHeader } from "@/components/site/marketing/blocks"
import { FaqSection } from "@/components/site/marketing/faq"
import { PLANS } from "@/lib/billing/plans"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await pageContext(params)
  return { title: t.nav.pricing, description: getMarketing(locale).pricingPage.seoDescription }
}

export default async function PricingPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const fr = locale === "fr"
  const soon = t.pricing.soon
  const rows: [string, string, string, string][] = [
    [fr ? "Scores et calendriers" : "Scores and schedules", ...(Array(3).fill(fr ? "Sports activés" : "All enabled sports") as [string, string, string])],
    [fr ? "Vidéo publique autorisée" : "Authorized public video", ...(Array(3).fill(fr ? "Si disponible" : "Where available") as [string, string, string])],
    [fr ? "Favoris" : "Favorite teams or athletes", fr ? "5 au total" : "5 total", fr ? "Illimités" : "Unlimited", fr ? "Illimités" : "Unlimited"],
    [fr ? "Publicités FlacronSport" : "FlacronSport display ads", fr ? "Incluses" : "Included", fr ? "Retirées" : "Removed", fr ? "Retirées" : "Removed"],
    [fr ? "Assistant sportif par mois" : "Sports assistant per month", ...(["free", "plus", "premium"] as const).map((id) => String(PLANS[id].assistantRequestsPerMonth)) as [string, string, string]],
    [`${fr ? "Création de salons privés" : "Private room creation"} (${soon})`, fr ? "Rejoindre uniquement" : "Join only", fr ? "3 salons actifs" : "3 active rooms", fr ? "10 salons actifs" : "10 active rooms"],
    [`${fr ? "Participants par salon" : "Room participant limit"} (${soon})`, fr ? "Selon l'hôte" : "Host plan applies", "20", "50"],
  ]

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
                {(["free", "plus", "premium"] as const).map((id) => <th key={id} scope="col" className="px-5 py-3 font-semibold">{PLANS[id].name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([label, ...values]) => (
                <tr key={label}>
                  <th scope="row" className="px-5 py-3.5 align-top font-medium text-ink">{label}</th>
                  {values.map((value, index) => <td key={index} className="px-5 py-3.5 align-top text-ink-2">{value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
