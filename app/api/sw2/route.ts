import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyIdToken } from '@/lib/firebase-admin'
import Stripe from "stripe"
import { API_CONFIG } from "@/lib/api-config"
import { readFileSync } from 'fs'
import { join } from 'path'

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

export async function GET(request: NextRequest) {
  try {
    // Check if user is premium
    const cookieStore = await cookies();
    const token = cookieStore.get('firebase_id_token')?.value;
    const decoded = token ? await verifyIdToken(token) : null;
    const isPremium = decoded ? await isUserPremium(decoded.uid) : false;

    if (isPremium) {
      // Premium users get an empty service worker
      const emptyServiceWorker = `
        // Empty service worker for premium users (sw2)
        console.log('Premium user - ads disabled (sw2)');
        
        self.addEventListener('install', function(event) {
          console.log('Empty service worker 2 installed for premium user');
          self.skipWaiting();
        });
        
        self.addEventListener('activate', function(event) {
          console.log('Empty service worker 2 activated for premium user');
          event.waitUntil(self.clients.claim());
        });
        
        // Block any fetch requests that might be ad-related
        self.addEventListener('fetch', function(event) {
          const url = event.request.url;
          if (url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication')) {
            event.respondWith(new Response('', { status: 204 }));
            return;
          }
          // Let other requests pass through normally
          event.respondWith(fetch(event.request));
        });
      `;
      
      return new NextResponse(emptyServiceWorker, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      // Non-premium users get the real service worker
      try {
        const swPath = join(process.cwd(), 'public', 'sw2-original.js');
        const swContent = readFileSync(swPath, 'utf8');
        
        return new NextResponse(swContent, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        // If we can't read the original SW, return empty one
        return new NextResponse('console.log("Service worker 2 not found");', {
          headers: {
            'Content-Type': 'application/javascript',
          }
        });
      }
    }
  } catch (error) {
    console.error('Error in service worker 2 route:', error);
    // Return empty service worker on error
    return new NextResponse('console.log("Service worker 2 error");', {
      headers: {
        'Content-Type': 'application/javascript',
      }
    });
  }
}
