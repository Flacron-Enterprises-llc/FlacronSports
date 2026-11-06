import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { firestoreBillingStore, ownsCustomer } from "@/lib/billing/firestore-store"
import { getStripe, liveModeApproved } from "@/lib/billing/stripe-client"
import { processStripeEvent } from "@/lib/billing/webhook-core"
import { awardReferral, reverseReferral } from "@/lib/community/referrals"
import { firestoreDocDb } from "@/lib/doc-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 })

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })

  const stripe = getStripe()
  const payload = await request.text() // must stay raw: signature covers the exact bytes

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    const outcome = await processStripeEvent(event, {
      store: firestoreBillingStore,
      retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
      retrieveCheckoutSession: (id) => stripe.checkout.sessions.retrieve(id, { expand: ["line_items", "payment_intent.latest_charge"] }),
      ownsCustomer,
      invoiceForPayment: async (id) => {
        const { data } = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: id }, limit: 1, expand: ["data.invoice"] })
        const invoice = data[0]?.invoice
        return invoice && typeof invoice === "object" && !invoice.deleted ? invoice : null
      },
      listSubscriptions: async (customer) => (await stripe.subscriptions.list({ customer, status: "all", limit: 20 })).data,
      cancelSubscription: async (id) => void (await stripe.subscriptions.cancel(id)),
      onPaidInvoice: (uid, invoiceId) => awardReferral(firestoreDocDb(), { uid, paymentId: invoiceId }, new Date()),
      onRefundedInvoice: (invoiceId) => reverseReferral(firestoreDocDb(), { paymentId: invoiceId }, new Date()),
      allowLivemode: liveModeApproved(),
    })
    return NextResponse.json({ received: true, outcome })
  } catch (error) {
    // A non-2xx response makes Stripe retry; the event was not claimed, so the retry is safe.
    console.error("Stripe webhook failed", event.id, error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
