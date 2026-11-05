import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EFFECTIVE_DATE, getPolicy, LEGAL_INTRO, POLICIES } from "@/lib/legal/content"
import { pageContext } from "@/lib/page-context"

type Props = { params: Promise<{ locale: string; policy: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ policy: policy.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getPolicy((await params).policy)?.title }
}

export default async function PolicyPage({ params }: Props) {
  const { policy: slug } = await params
  const { locale, t } = await pageContext(params)
  const policy = getPolicy(slug)
  if (!policy) notFound()

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(EFFECTIVE_DATE))

  return (
    <main id="main" className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_260px]">
      <article lang="en">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{policy.title}</h1>
        <p className="mt-3 text-sm text-ink-2">{t.legal.effective}: {date}</p>
        {locale !== "en" && <p lang={locale} className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm text-ink-2">{t.legal.onlyEnglish}</p>}
        <div className="fs-prose mt-6">
          <p>{LEGAL_INTRO}</p>
          {policy.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h3>{section.title}</h3>
              {section.blocks.map((block, index) =>
                typeof block === "string" ? (
                  <p key={index}>{block}</p>
                ) : (
                  <ul key={index}>{block.list.map((item) => <li key={item}>{item}</li>)}</ul>
                ),
              )}
            </section>
          ))}
        </div>
      </article>
      <nav aria-label={t.legal.contents} className="hidden lg:block">
        <div className="sticky top-24">
          <p className="text-sm font-semibold text-ink">{t.legal.contents}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {policy.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`} className="text-ink-2 hover:text-ink">{section.title}</a></li>
            ))}
          </ul>
        </div>
      </nav>
    </main>
  )
}
