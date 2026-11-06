import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getDictionary, isLocale, localePath, type Dictionary, type Locale } from "@/lib/i18n"

export type LocaleParams = { params: Promise<{ locale: string }> }

export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current: Locale = locale
  return { locale: current, t: getDictionary(current), href: (path: string) => localePath(current, path) }
}

/** A page title in the visitor's language. */
export function titled(pick: (t: Dictionary) => string, extra: Metadata = {}) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params
    return { ...extra, title: pick(getDictionary(isLocale(locale) ? locale : "en")) }
  }
}
