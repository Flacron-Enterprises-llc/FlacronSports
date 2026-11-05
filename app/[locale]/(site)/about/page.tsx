import type { Metadata } from "next"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "About" }

export default async function AboutPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.about.title} />
      <div className="fs-prose">{t.about.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
    </main>
  )
}
