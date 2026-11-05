import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { CookiePreferencesButton } from "@/components/consent/consent-ui"
import type { Dictionary, Locale } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"
import { FEATURES } from "@/lib/marketing"
import { COMPANY_URL, SOCIAL_LINKS } from "@/lib/site"
import { Logo } from "./brand"
import { SocialIcon } from "./social-icons"

export function SiteFooter({ locale, t, href }: { locale: Locale; t: Dictionary; href: (path: string) => string }) {
  const columns = [
    {
      title: t.footer.product,
      links: [...FEATURES.map((feature) => [`/features/${feature.slug}`, feature[locale].name]), ["/sports", t.nav.sports], ["/pricing", t.nav.pricing]],
    },
    { title: t.footer.company, links: [["/about", t.footer.about], ["/faq", t.footer.faq], ["/contact", t.footer.contact]] },
  ]

  return (
    <footer className="fs-band mt-28 overflow-hidden text-white/80 print:hidden">
      <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Logo reversed href={href("/")} />
            <p className="mt-5 font-display text-lg font-semibold leading-snug text-white">{t.footer.tagline}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">{t.footer.subTagline}</p>
            <ul className="mt-7 flex flex-wrap gap-2" aria-label={t.footer.social}>
              {SOCIAL_LINKS.map((social) => (
                <li key={social.id}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.footer.socialOn.replace("{name}", social.label)}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-white/75 transition-[color,background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 hover:text-white"
                  >
                    <SocialIcon id={social.id} />
                  </a>
                </li>
              ))}
            </ul>
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
          <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer" className="group inline-flex flex-wrap items-center gap-1.5 text-sm text-white/75 hover:text-white">
            {t.footer.productOf} <span className="font-semibold text-white">Flacron Enterprises</span>
            <ArrowUpRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            <span className="sr-only">{t.footer.newTab}</span>
          </a>
          <p className="text-xs text-white/70">© {new Date().getFullYear()} Flacron Enterprises LLC. {t.footer.rights}</p>
        </div>
        <p className="border-t border-white/10 py-6 text-xs leading-5 text-white/70">{t.footer.note}</p>
      </div>
    </footer>
  )
}
