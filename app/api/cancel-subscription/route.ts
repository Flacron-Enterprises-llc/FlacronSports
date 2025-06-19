import { NextResponse } from "next/server"
import Stripe from "stripe"
import { API_CONFIG } from "@/lib/api-config"

const stripe = new Stripe(API_CONFIG.payments.stripe.secretKey, {
  apiVersion: "2025-05-28.basil",
})

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("Canceling subscription for userId:", userId)

    // Find the Stripe customer by userId in metadata
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })
    const customer = customers.data[0]

    if (!customer) {
      return NextResponse.json(
        { error: "No customer found for this user" },
        { status: 404 }
      )
    }

    // Get all subscriptions for this customer (including incomplete ones)
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
    })

    console.log("Found subscriptions:", subscriptions.data.map(sub => ({ id: sub.id, status: sub.status })))

    // Look for active, trialing, or incomplete subscriptions
    const activeSubscription = subscriptions.data.find(
      sub => sub.status === 'active' || sub.status === 'trialing' || sub.status === 'incomplete'
    )

    if (!activeSubscription) {
      // Check for recent successful payment intents as fallback
      const payments = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 1,
      })
      
      if (payments.data.length > 0 && payments.data[0].status === 'succeeded') {
        return NextResponse.json({
          success: true,
          message: "Payment found but no subscription to cancel. Your premium access will continue until the end of your billing period.",
          note: "No active subscription found, but recent payment detected"
        })
      }

      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      )
    }

    // Cancel the subscription at period end
    const subscription = await stripe.subscriptions.update(
      activeSubscription.id,
      {
        cancel_at_period_end: true,
      }
    )

    console.log("Subscription canceled:", subscription.id)

    return NextResponse.json({
      success: true,
      message: "Subscription will be canceled at the end of the current billing period",
      subscriptionId: subscription.id,
    })
  } catch (error) {
    console.error("Error canceling subscription:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel subscription" },
      { status: 500 }
    )
  }
} 