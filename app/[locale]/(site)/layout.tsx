import { SiteFooter } from "@/components/site/footer"
import { SiteHeader } from "@/components/site/header"
import { RevealObserver } from "@/components/site/motion"
import { pageContext } from "@/lib/page-context"

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, t, href } = await pageContext(params)
  return (
    <>
      <RevealObserver />
      <SiteHeader />
      {children}
      <SiteFooter locale={locale} t={t} href={href} />
    </>
  )
}
