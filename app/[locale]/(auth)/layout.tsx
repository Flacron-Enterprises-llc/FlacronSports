import Link from "next/link"
import { CircleCheck } from "lucide-react"
import { LanguageLink } from "@/components/auth/auth-ui"
import { Logo } from "@/components/site/brand"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { pageContext } from "@/lib/page-context"

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { t, href } = await pageContext(params)
  const points = [t.auth.proofTeams, t.auth.proofSpoilers, t.auth.proofViewing]
  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:overflow-hidden">
      <aside className="fs-band relative hidden overflow-hidden p-10 lg:flex lg:h-dvh lg:flex-col lg:justify-between xl:p-12">
        <div aria-hidden className="fs-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 size-[560px]">
          <div className="fs-rings absolute inset-0" />
          <div className="fs-radar absolute inset-[10%] opacity-70" />
        </div>
        <div className="relative">
          <Logo reversed href={href("/")} />
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-[2rem] font-semibold leading-[1.15] text-white xl:text-[2.25rem]">
            {t.auth.brandLead} <span className="text-orange">{t.auth.brandAccent}</span>
          </p>
          <p className="mt-3 text-[15px] leading-6 text-white/75">{t.footer.subTagline}</p>
          <ul className="mt-7 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-6 text-white/85">
                <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-orange" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">
          © {new Date().getFullYear()} Flacron Enterprises LLC ·{" "}
          <Link href={href("/privacy-policy")} className="underline-offset-2 hover:text-white hover:underline">{t.auth.privacy}</Link>
        </p>
      </aside>
      <div data-auth-scroll className="fs-noscrollbar relative flex min-h-dvh min-w-0 flex-col lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_65%)]" />
        <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:justify-end">
          <span className="lg:hidden"><Logo href={href("/")} /></span>
          <div className="flex items-center gap-1">
            <LanguageLink />
            <ThemeToggle className="size-11" />
          </div>
        </header>
        <main id="main" className="relative flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:px-8 lg:py-6">
          <div className="w-full min-w-0 max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
