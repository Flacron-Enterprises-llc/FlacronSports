import type { Metadata } from "next"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Contact" }

export default async function ContactPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.contact.title} lead={t.contact.lead} />
      <dl className="space-y-4 rounded-2xl border border-line bg-surface p-6 text-sm">
        <div><dt className="text-ink-3">{t.contact.email}</dt><dd><a className="font-semibold text-hot-text underline" href="mailto:contact@flacronenterprises.com">contact@flacronenterprises.com</a></dd></div>
        <div><dt className="text-ink-3">{t.contact.address}</dt><dd className="text-ink">Flacron Enterprises LLC, 410 E 95th St, Brooklyn, NY 11212, United States</dd></div>
      </dl>
      <p className="mt-4 text-sm leading-6 text-ink-2">{t.contact.billing}</p>
    </main>
  )
}
