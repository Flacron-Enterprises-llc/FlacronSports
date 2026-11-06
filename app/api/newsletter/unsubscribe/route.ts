import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getDictionary, isLocale, type Locale } from "@/lib/i18n"
import { verifyUnsubscribeToken } from "@/lib/newsletter/token"
import { rateLimitClient } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const page = (locale: Locale, title: string, content: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.6"><h1 style="font-size:1.5rem">${title}</h1>${content}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  )

function read(request: Request) {
  const params = new URL(request.url).searchParams
  const value = params.get("locale") ?? undefined
  const locale: Locale = isLocale(value) ? value : "en"
  const token = params.get("token")
  return { locale, token, uid: verifyUnsubscribeToken(token) }
}

/** GET only confirms: mail scanners follow links, and that must not unsubscribe anyone. */
export async function GET(request: Request) {
  const { locale, token, uid } = read(request)
  const copy = getDictionary(locale).newsletter
  if (!uid || !token) return page(locale, copy.invalidTitle, `<p>${copy.invalidBody}</p>`, 400)
  const action = `/api/newsletter/unsubscribe?${new URLSearchParams({ token, locale }).toString().replace(/&/g, "&amp;")}`
  return page(locale, copy.confirmTitle, `<p>${copy.confirmBody}</p><form method="post" action="${action}"><button type="submit" style="padding:.6rem 1rem;font:inherit;font-weight:600">${copy.confirmButton}</button></form>`)
}

/** RFC 8058 one-click target. The signed token is the only credential a mail client can send. */
export async function POST(request: Request) {
  const { locale, uid } = read(request)
  const copy = getDictionary(locale).newsletter
  try {
    rateLimitClient(request, "unsubscribe", { visitor: 30, shared: 300 }, 60_000)
    if (!uid) return page(locale, copy.invalidTitle, `<p>${copy.invalidBody}</p>`, 400)
    const db = getAdminDb()
    if (!db) throw new ApiError(503, "storage_unavailable", "Please try again shortly")
    const ref = db.collection("user_preferences").doc(uid)
    // A link in old mail must not recreate the record of a deleted account.
    if ((await ref.get()).exists) await ref.set({ newsletter: { optedIn: false, unsubscribedAt: new Date().toISOString() } }, { merge: true })
    return page(locale, copy.doneTitle, `<p>${copy.doneBody}</p>`)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
