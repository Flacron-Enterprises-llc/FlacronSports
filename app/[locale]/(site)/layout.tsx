import { SiteFooter } from "@/components/site/footer"
import { MobileTabs, SiteHeader } from "@/components/site/header"
import { pageContext } from "@/lib/page-context"

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { t, href } = await pageContext(params)
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter t={t} href={href} />
      <MobileTabs />
    </>
  )
}
