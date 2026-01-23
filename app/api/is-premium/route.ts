import { NextResponse } from "next/server";
import Stripe from "stripe";
import { API_CONFIG } from "@/lib/api-config";

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Lazy initialization of Stripe to avoid build-time errors
function getStripe() {
  const secretKey = API_CONFIG.payments.stripe.secretKey;
  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-05-28.basil",
  });
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe()
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ isPremium: false, error: "User ID is required" }, { status: 400 });
    }

    // Find the Stripe customer by userId in metadata
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    });
    const customer = customers.data[0];
    if (!customer) {
      return NextResponse.json({ isPremium: false });
    }

    // Check for active or trialing subscription
    const subs = await stripe.subscriptions.list({ customer: customer.id });
    const hasActive = subs.data.some(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    // If no active sub, check for recent successful payment intent
    let isPremium = hasActive;
    if (!isPremium) {
      const payments = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 1,
      });
      if (payments.data.length > 0 && payments.data[0].status === 'succeeded') {
        isPremium = true;
      }
    }
    console.log("is-premium endpoint:", { userId, isPremium });
    return NextResponse.json({ isPremium });
  } catch (error) {
    console.error("Error checking premium status:", error);
    return NextResponse.json({ isPremium: false, error: "Server error" }, { status: 500 });
  }
} 