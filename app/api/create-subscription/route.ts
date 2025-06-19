import { NextResponse } from "next/server"
import Stripe from "stripe"
import { API_CONFIG } from "@/lib/api-config"

// Validate required environment variables
const stripeSecretKey = API_CONFIG.payments.stripe.secretKey
const PREMIUM_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables")
}

if (!PREMIUM_PRICE_ID) {
  throw new Error("STRIPE_MONTHLY_PRICE_ID is not set in environment variables")
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-05-28.basil",
})

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("Creating/retrieving customer for userId:", userId)

    // First, check if customer already exists
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    let customer = customers.data[0]

    if (!customer) {
      console.log("Creating new customer for userId:", userId)
      // Create a new customer if one doesn't exist
      customer = await stripe.customers.create({
        email: email,
        metadata: { userId: userId }
      })
    } else {
      console.log("Found existing customer:", customer.id)
    }

    // Fetch subscriptions for this customer
    const subs = await stripe.subscriptions.list({ customer: customer.id })
    const existingSubscription = subs.data.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    )

    if (existingSubscription) {
      return NextResponse.json(
        { error: "Customer already has an active subscription" },
        { status: 400 }
      )
    }

    console.log("Creating subscription for customer:", customer.id)

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PREMIUM_PRICE_ID }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    })

    console.log("Subscription created:", subscription.id)

    let invoice = subscription.latest_invoice as Stripe.Invoice;
    let paymentIntent = (invoice as any).payment_intent;

    // Only finalize if invoice is in draft status
    if (!paymentIntent && invoice.status === 'draft' && invoice.id) {
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {
        expand: ['payment_intent'],
      });
      paymentIntent = (finalizedInvoice as any).payment_intent;
      invoice = finalizedInvoice;
    }

    // If still no paymentIntent, create one for the invoice
    if (!paymentIntent && invoice.id) {
      const newPaymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount_due,
        currency: invoice.currency,
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
        metadata: { invoice_id: invoice.id }
      });
      paymentIntent = newPaymentIntent;
    }

    // Debug: log the full subscription and invoice objects
    console.log('Full subscription object:', JSON.stringify(subscription, null, 2));
    console.log('Latest invoice:', JSON.stringify(invoice, null, 2));

    if (!paymentIntent?.client_secret) {
      console.error("No payment intent or client secret found")
      return NextResponse.json(
        { error: "Failed to create payment intent" },
        { status: 500 }
      )
    }

    console.log("Returning client secret for payment intent:", paymentIntent.id);

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      status: subscription.status,
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subscription" },
      { status: 500 }
    )
  }
} 