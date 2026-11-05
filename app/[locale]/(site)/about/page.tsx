import type { Metadata } from "next"
import { CtaBand, PageHeader, reveal } from "@/components/site/marketing/blocks"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await pageContext(params)
  return { title: t.footer.about, description: getMarketing(locale).aboutPage.seoDescription }
}

export default async function AboutPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const m = getMarketing(locale)
  const p = m.aboutPage

  return (
    <main id="main">
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:pt-16">
        <PageHeader crumbs={[[m.common.home, href("/")], [t.footer.about, href("/about")]]} title={t.about.title} lead={p.lead} />
        <div data-reveal className="mt-10 max-w-3xl space-y-4 text-[16.5px] leading-7 text-ink-2">
          {t.about.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </div>

      <section aria-labelledby="values" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <h2 id="values" data-reveal className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2.1rem]">{p.valuesTitle}</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {p.values.map((value, index) => (
            <li key={value.title} data-reveal style={reveal(index % 2)} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <h3 className="text-lg font-semibold text-ink">{value.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink-2">{value.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <CtaBand title={m.cta.title} body={m.cta.body} primary={{ href: href("/signup"), label: m.common.createAccount }} secondary={{ href: href("/features"), label: t.nav.allFeatures }} />
    </main>
  )
}
