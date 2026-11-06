import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { btn } from "@/components/site/states"
import { firestoreDocDb } from "@/lib/doc-db"
import { pageContext } from "@/lib/page-context"
import { readShare, shareCard, type ShareCard } from "@/lib/share/cards"
import { fromBackend, getEvent } from "@/lib/sports/service"

type Props = { params: Promise<{ locale: string; id: string }> }

const SITE_URL = process.env.APP_BASE_URL || "https://flacronsport.com"

/** On Amplify the database is reached through the backend, like every other read. */
async function loadCard(id: string): Promise<ShareCard | null> {
  if (process.env.API_ORIGIN) return (await fromBackend<{ card?: ShareCard }>(`/api/share/${encodeURIComponent(id)}`).catch(() => null))?.card ?? null
  try {
    const share = await readShare(firestoreDocDb(), id)
    const event = share ? await getEvent(share.matchId) : null
    return share && event ? shareCard(event, share) : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const card = await loadCard(id)
  if (!card) return { robots: { index: false } }
  const images = [{ url: `${SITE_URL}/api/share/${id}/card`, width: 1200, height: 630 }]
  return {
    title: card.title,
    description: card.description,
    robots: { index: false },
    openGraph: { title: card.title, description: card.description, images },
    twitter: { card: "summary_large_image", title: card.title, description: card.description, images },
  }
}

/** The app sits behind a plan, so a shared link opens here and leads on to sign-in. */
export default async function SharePage({ params }: Props) {
  const { id } = await params
  const { t, href } = await pageContext(params)
  const card = await loadCard(id)
  if (!card) notFound()

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold text-hot-text">{card.heading}</p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight text-ink sm:text-3xl">{card.title}</h1>
      <p className="mt-1.5 text-sm text-ink-2">{card.competition}{card.when ? ` · ${card.when}` : ""}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/share/${id}/card`} alt={card.title} width={1200} height={630} className="mt-6 h-auto w-full rounded-xl border border-line" />
      <p className="mt-6 text-sm leading-6 text-ink-2">{t.share.pageSub}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={href(`/signin?next=${encodeURIComponent(card.matchPath)}`)} className={btn("primary")}>{t.share.pageCta}</Link>
        <Link href={href("/pricing")} className={btn("outline")}>{t.share.plans}</Link>
      </div>
    </main>
  )
}
