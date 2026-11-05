import type { MetadataRoute } from "next"
import { LOCALES, localePath } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"

const PATHS = ["/", "/scores", "/watch", "/news", "/pricing", "/about", "/contact", ...POLICIES.map((policy) => `/${policy.slug}`)]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_BASE_URL || "https://flacronsport.com"
  return PATHS.flatMap((path) => LOCALES.map((locale) => ({ url: `${base}${localePath(locale, path)}` })))
}
