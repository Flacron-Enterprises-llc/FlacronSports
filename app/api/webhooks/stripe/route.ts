import { headers } from "next/headers"
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { API_CONFIG } from "@/lib/api-config"

const stripe = new Stripe(API_CONFIG.payments.stripe.secretKey, {
  apiVersion: "2025-05-28.basil",
})

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      API_CONFIG.payments.stripe.webhookSecret
    )

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
        const subscription = event.data.object as Stripe.Subscription
        // Handle subscription creation
        // Update user's subscription status in your database
        console.log("Subscription created:", subscription.id)
        break

      case "customer.subscription.updated":
        const updatedSubscription = event.data.object as Stripe.Subscription
        // Handle subscription update
        // Update user's subscription status in your database
        console.log("Subscription updated:", updatedSubscription.id)
        break

      case "customer.subscription.deleted":
        const deletedSubscription = event.data.object as Stripe.Subscription
        // Handle subscription deletion
        // Update user's subscription status in your database
        console.log("Subscription deleted:", deletedSubscription.id)
        break

      case "invoice.payment_succeeded":
        const invoice = event.data.object as Stripe.Invoice
        // Handle successful payment
        // Update user's payment status in your database
        console.log("Payment succeeded:", invoice.id)
        break

      case "invoice.payment_failed":
        const failedInvoice = event.data.object as Stripe.Invoice
        // Handle failed payment
        // Notify user and update payment status in your database
        console.log("Payment failed:", failedInvoice.id)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Webhook error:", err)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    )
  }
} 