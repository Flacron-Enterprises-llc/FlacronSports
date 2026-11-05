import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/site/marketing/blocks"
import { APPEALS_EMAIL, COMMUNITY_GUIDELINES, GUIDELINES_DATE } from "@/lib/legal/community-guidelines"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await pageContext(params)
  const { title, description } = COMMUNITY_GUIDELINES[locale]
  return { title, description }
}

export default async function CommunityGuidelinesPage({ params }: LocaleParams) {
  const { locale, t, href } = await pageContext(params)
  const guidelines = COMMUNITY_GUIDELINES[locale]
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(GUIDELINES_DATE))
  const { before, terms, and, privacy } = guidelines.related

  return (
    <main id="main" className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_260px]">
      <article>
        <PageHeader crumbs={[[getMarketing(locale).common.home, href("/")], [guidelines.title, href("/community-guidelines")]]} title={guidelines.title} lead={guidelines.lead} />
        <p className="mt-4 text-sm text-ink-2">{t.legal.effective}: {date}</p>
        <div className="fs-prose mt-6">
          {guidelines.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h3>{section.title}</h3>
              {section.blocks.map((block, index) =>
                typeof block === "string" ? (
                  <p key={index}>{block}</p>
                ) : (
                  <ul key={index}>{block.list.map((item) => <li key={item}>{item}</li>)}</ul>
                ),
              )}
              {section.id === "appeals" && <p><a href={`mailto:${APPEALS_EMAIL}`}>{APPEALS_EMAIL}</a></p>}
            </section>
          ))}
          <p>{before} <Link href={href("/terms-of-service")}>{terms}</Link> {and} <Link href={href("/privacy-policy")}>{privacy}</Link>.</p>
        </div>
      </article>
      <nav aria-label={t.legal.contents} className="hidden lg:block">
        <div className="sticky top-24">
          <p className="text-sm font-semibold text-ink">{t.legal.contents}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {guidelines.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`} className="text-ink-2 hover:text-ink">{section.title}</a></li>
            ))}
          </ul>
        </div>
      </nav>
    </main>
  )
}
