import type { Metadata } from "next"
import { CtaBand, PageHeader } from "@/components/site/marketing/blocks"
import { FaqList } from "@/components/site/marketing/faq"
import { getMarketing } from "@/lib/marketing"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await pageContext(params)
  const p = getMarketing(locale).faqPage
  return { title: p.title, description: p.seoDescription }
}

export default async function FaqPage({ params }: LocaleParams) {
  const { locale, href } = await pageContext(params)
  const m = getMarketing(locale)

  return (
    <main id="main">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:pt-16">
        <PageHeader crumbs={[[m.common.home, href("/")], [m.faqPage.title, href("/faq")]]} title={m.faqPage.title} lead={m.faqPage.lead} />
        <div className="mt-10 lg:mt-12 lg:max-w-5xl">
          <FaqList faqs={m.faqs} itemHeading="h2" />
        </div>
      </div>
      <CtaBand title={m.cta.title} body={m.cta.body} primary={{ href: href("/signup"), label: m.common.createAccount }} secondary={{ href: href("/pricing"), label: m.common.comparePlans }} />
    </main>
  )
}
