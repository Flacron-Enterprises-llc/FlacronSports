import Link from "next/link"
import { getDictionary } from "@/lib/i18n"

export default function NotFound() {
  const t = getDictionary("en")
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-ink">{t.common.notFound}</h1>
        <Link href="/" className="mt-4 inline-block font-semibold text-hot-text underline">{t.common.home}</Link>
      </div>
    </main>
  )
}
