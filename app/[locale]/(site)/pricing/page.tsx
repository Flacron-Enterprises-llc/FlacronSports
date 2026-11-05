import type { Metadata } from "next"
import { PlanCards } from "@/components/billing/plan-cards"
import { PageHeader } from "@/components/site/states"
import { PLANS } from "@/lib/billing/plans"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Pricing" }

export default async function PricingPage({ params }: LocaleParams) {
  const { locale, t } = await pageContext(params)
  const fr = locale === "fr"
  const soon = t.pricing.soon
  const rows: [string, string, string, string][] = [
    [fr ? "Scores et calendriers" : "Scores and schedules", ...(Array(3).fill(fr ? "Sports activés" : "All enabled sports") as [string, string, string])],
    [fr ? "Vidéo publique autorisée" : "Authorized public video", ...(Array(3).fill(fr ? "Si disponible" : "Where available") as [string, string, string])],
    [fr ? "Favoris" : "Favorite teams or athletes", fr ? "5 au total" : "5 total", fr ? "Illimités" : "Unlimited", fr ? "Illimités" : "Unlimited"],
    [fr ? "Publicités FlacronSport" : "FlacronSport display ads", fr ? "Incluses" : "Included", fr ? "Retirées" : "Removed", fr ? "Retirées" : "Removed"],
    [`${fr ? "Assistant sportif par mois" : "Sports assistant per month"} (${soon})`, ...(["free", "plus", "premium"] as const).map((id) => String(PLANS[id].assistantRequestsPerMonth)) as [string, string, string]],
    [`${fr ? "Création de salons privés" : "Private room creation"} (${soon})`, fr ? "Rejoindre uniquement" : "Join only", fr ? "3 salons actifs" : "3 active rooms", fr ? "10 salons actifs" : "10 active rooms"],
    [`${fr ? "Participants par salon" : "Room participant limit"} (${soon})`, fr ? "Selon l'hôte" : "Host plan applies", "20", "50"],
  ]

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={t.pricing.title} lead={t.pricing.lead} />
      <PlanCards />
      <section aria-labelledby="compare" className="mt-14">
        <h2 id="compare" className="text-2xl font-bold text-ink">{t.pricing.compare}</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink">
                <th scope="col" className="p-3 font-semibold">{t.pricing.benefit}</th>
                {(["free", "plus", "premium"] as const).map((id) => <th key={id} scope="col" className="p-3 font-semibold">{PLANS[id].name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, ...values]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <th scope="row" className="p-3 font-medium text-ink">{label}</th>
                  {values.map((value, index) => <td key={index} className="p-3 text-ink-2">{value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-6 text-sm leading-6 text-ink-2">{t.pricing.disclaimer}</p>
    </main>
  )
}
