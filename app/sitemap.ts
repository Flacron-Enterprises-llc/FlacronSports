import type { MetadataRoute } from "next"
import { LOCALES, localePath } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"
import { FEATURES } from "@/lib/marketing"

const PATHS = ["/", "/features", ...FEATURES.map((feature) => `/features/${feature.slug}`), "/sports", "/pricing", "/faq", "/about", "/contact", "/community-guidelines", ...POLICIES.map((policy) => `/${policy.slug}`)]

/** Public marketing and legal pages only. The product sits behind a plan and is never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_BASE_URL || "https://flacronsport.com"
  return PATHS.flatMap((path) => {
    const url = (locale: (typeof LOCALES)[number]) => `${base}${localePath(locale, path)}`
    const languages = { ...Object.fromEntries(LOCALES.map((locale) => [locale, url(locale)])), "x-default": url("en") }
    return LOCALES.map((locale) => ({ url: url(locale), alternates: { languages } }))
  })
}
