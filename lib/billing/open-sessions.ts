import type Stripe from "stripe"
import { APP_ID } from "./plans"

type Session = Stripe.Checkout.Session

/**
 * Keeps one open checkout per purchase, so a second tab cannot pay for the same thing
 * twice. Returns the link to reuse, or null when a new session is needed. Everything
 * else of that kind is expired. Other apps share this Stripe account, so only sessions
 * carrying this app's id are touched.
 */
export async function settleOpenSessions(
  stripe: Pick<Stripe, "checkout">,
  customer: string,
  options: { kind(session: Session): boolean; same(session: Session): boolean },
): Promise<string | null> {
  const open = await stripe.checkout.sessions.list({ customer, status: "open", limit: 100 })
  let reuse: string | null = null
  for (const session of open.data) {
    if (session.metadata?.app_id !== APP_ID || !options.kind(session)) continue
    if (!reuse && session.url && options.same(session)) reuse = session.url
    // A session paid a moment ago cannot be expired. The webhook handles that case.
    else await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
  }
  return reuse
}
