import type { Metadata } from "next"
import { Mail, MapPin } from "lucide-react"
import { PageHeader, reveal } from "@/components/site/marketing/blocks"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await pageContext(params)
  return { title: t.footer.contact, description: getMarketing(locale).contactPage.seoDescription }
}

export default async function ContactPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const p = m.contactPage

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:pt-16">
      <PageHeader crumbs={[[m.common.home, href("/")], [t.footer.contact, href("/contact")]]} title={t.contact.title} lead={t.contact.lead} />

      <section aria-labelledby="reach" className="mt-14">
        <h2 id="reach" data-reveal className="text-[1.6rem] font-semibold tracking-[-0.025em] text-ink">{p.reachTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div data-reveal className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <span className="fs-tint-brand inline-flex size-10 items-center justify-center rounded-xl text-brand"><Mail aria-hidden className="size-5" /></span>
            <h3 className="mt-4 font-semibold text-ink">{t.contact.email}</h3>
            <a className="mt-1 inline-block break-all text-[15px] font-semibold text-hot-text underline underline-offset-4" href="mailto:contact@flacronenterprises.com">contact@flacronenterprises.com</a>
          </div>
          <div data-reveal style={reveal(1)} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <span className="fs-tint-brand inline-flex size-10 items-center justify-center rounded-xl text-brand"><MapPin aria-hidden className="size-5" /></span>
            <h3 className="mt-4 font-semibold text-ink">{t.contact.address}</h3>
            <p className="mt-1 text-[15px] leading-7 text-ink-2">Flacron Enterprises LLC, 410 E 95th St, Brooklyn, NY 11212, United States</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="include" className="mt-16">
        <h2 id="include" data-reveal className="text-[1.6rem] font-semibold tracking-[-0.025em] text-ink">{p.includeTitle}</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {p.include.map((item, index) => (
            <li key={item.title} data-reveal style={reveal(index)} className="rounded-2xl border border-line bg-surface p-6">
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-[15px] leading-7 text-ink-2">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
