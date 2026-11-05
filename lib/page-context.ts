import { notFound } from "next/navigation"
import { getDictionary, isLocale, localePath, type Locale } from "@/lib/i18n"

export type LocaleParams = { params: Promise<{ locale: string }> }

export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current: Locale = locale
  return { locale: current, t: getDictionary(current), href: (path: string) => localePath(current, path) }
}
