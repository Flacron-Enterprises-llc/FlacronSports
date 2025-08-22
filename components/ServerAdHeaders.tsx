import { cookies } from 'next/headers'
import { verifyIdToken } from '@/lib/firebase-admin'
import Stripe from "stripe"
import { API_CONFIG } from "@/lib/api-config"

// Initialize Stripe
const stripe = new Stripe(API_CONFIG.payments.stripe.secretKey, {
  apiVersion: "2025-05-28.basil",
});

async function isUserPremium(userId: string): Promise<boolean> {
  try {
    // Find the Stripe customer by userId in metadata
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    });
    const customer = customers.data[0];
    if (!customer) {
      return false;
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
    return isPremium;
  } catch (error) {
    console.error("Error checking premium status:", error);
    return false;
  }
}

export default async function ServerAdHeaders() {
  // TEMPORARILY DISABLED - Testing to see if this stops all ads
  console.log('🚫 ServerAdHeaders temporarily disabled for testing')
  return (
    <>
      {/* All ad headers temporarily disabled for testing */}
      <meta name="ad-testing" content="disabled" />
    </>
  )
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('firebase_id_token')?.value;
    const decoded = token ? await verifyIdToken(token) : null;
    const isPremium = decoded ? await isUserPremium(decoded.uid) : false;

    // Only render ad headers for non-premium users
    if (isPremium) {
      return (
        <>
          {/* Premium user - no ad headers */}
          <meta name="premium-user" content="true" />
        </>
      )
    }

    return (
      <>
        {/* Non-premium user - include ad optimization headers */}
        <meta name="monetag-site-verification" content="flacron-sports-verification" />
        <link rel="preconnect" href="https://publishers.monetag.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fpyf8.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//grookilteepsou.net" />
        {/* Ad network hints for better performance */}
        <link rel="preload" as="script" href="https://fpyf8.com/88/tag.min.js" crossOrigin="anonymous" />
      </>
    )
  } catch (error) {
    // If we can't determine premium status, default to no ad headers for safety
    return null
  }
}
