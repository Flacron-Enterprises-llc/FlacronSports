import type { MetadataRoute } from "next"
import { LOCALES, localePath } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"
import { FEATURES } from "@/lib/marketing"

const PATHS = ["/", "/features", ...FEATURES.map((feature) => `/features/${feature.slug}`), "/sports", "/pricing", "/faq", "/about", "/contact", "/community-guidelines", ...POLICIES.map((policy) => `/${policy.slug}`)]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_BASE_URL || "https://flacronsport.com"
  return PATHS.flatMap((path) => LOCALES.map((locale) => ({ url: `${base}${localePath(locale, path)}` })))
}
