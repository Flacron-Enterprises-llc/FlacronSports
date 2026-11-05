import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { CookiePreferencesButton } from "@/components/consent/consent-ui"
import type { Dictionary } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"
import { Logo } from "./brand"

const COMPANY_URL = "https://www.flacronenterprises.com"

export function SiteFooter({ t, href }: { t: Dictionary; href: (path: string) => string }) {
  const columns = [
    { title: t.footer.product, links: [["/scores", t.nav.scores], ["/watch", t.nav.watch], ["/news", t.nav.news], ["/my-teams", t.nav.myTeams], ["/pricing", t.nav.pricing]] },
    { title: t.footer.company, links: [["/about", t.footer.about], ["/contact", t.footer.contact]] },
  ]

  return (
    <footer className="fs-band mt-24 overflow-hidden pb-14 text-white/80 lg:pb-0 print:hidden">
      <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 py-16 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo reversed href={href("/")} />
            <p className="mt-5 font-display text-lg font-semibold leading-snug text-white">{t.footer.tagline}</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-sans text-sm font-semibold text-white">{column.title}</h2>
              <ul className="mt-4 space-y-3">
                {column.links.map(([to, label]) => (
                  <li key={to}>
                    <Link href={href(to)} className="fs-link text-sm text-white/75 hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label={t.footer.legal}>
            <h2 className="font-sans text-sm font-semibold text-white">{t.footer.legal}</h2>
            <ul className="mt-4 space-y-3">
              {POLICIES.map((policy) => (
                <li key={policy.slug}>
                  <Link href={href(`/${policy.slug}`)} className="fs-link text-sm text-white/75 hover:text-white">{policy.label}</Link>
                </li>
              ))}
              <li><CookiePreferencesButton className="text-sm text-white/75 hover:text-white" /></li>
            </ul>
          </nav>
        </div>
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-white/75 hover:text-white">
            {t.footer.productOf} <span className="font-semibold text-white">Flacron Enterprises</span>
            <ArrowUpRight aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <p className="text-xs text-white/70">© {new Date().getFullYear()} Flacron Enterprises LLC. {t.footer.rights}</p>
        </div>
        <p className="border-t border-white/10 py-6 text-xs leading-5 text-white/70">{t.footer.note}</p>
      </div>
    </footer>
  )
}
