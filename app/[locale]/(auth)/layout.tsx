import Link from "next/link"
import { Logo } from "@/components/site/brand"
import { pageContext } from "@/lib/page-context"

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { t, href } = await pageContext(params)
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo href={href("/")} />
        <Link href={href("/pricing")} className="text-sm font-medium text-ink-2 hover:text-ink">{t.nav.pricing}</Link>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
