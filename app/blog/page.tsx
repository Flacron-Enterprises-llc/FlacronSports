import { cookies } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { verifyIdToken, getAdminDb } from '@/lib/firebase-admin'
import { API_CONFIG } from "@/lib/api-config"
import Stripe from "stripe"
import TranslateButtonWrapper from '@/components/blog/TranslateButtonWrapper'
import { usePremium } from "@/lib/contexts/PremiumContext"
import UpgradeButton from '@/components/UpgradeButton'
import { useAuthUser } from '@/lib/hooks/useAuthUser'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import type { BlogPost } from '@/lib/blog-service'
import SportFilter from '@/components/blog/sport-filter'

// Initialize Stripe
const stripe = new Stripe(API_CONFIG.payments.stripe.secretKey, {
  apiVersion: "2025-05-28.basil",
});

async function getUserPreferredLanguage(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  if (!decoded) return null;

  // Get user email from decoded token
  const userEmail = decoded.email;
  if (!userEmail) return null;

  // Fetch from dashboard_settings collection using email as doc ID
  const doc = await getAdminDb().collection('dashboard_settings').doc(userEmail).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return data?.language || null;
}

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

interface NewsPost {
  id: string;
  title?: string;
  date: string;
  hook?: string;
  sport?: string;
}

interface GroupedPosts {
  earlyAccess: NewsPost[];
  freeArticles: NewsPost[];
}

async function getNewsPosts(): Promise<GroupedPosts> {
  try {
    const snapshot = await getAdminDb().collection("articles").orderBy("date", "desc").get();
    const posts = snapshot.docs.map((doc) => {
      const data = doc.data();
      let parsed: any;

      // Handle content stored as a stringified JSON in a 'content' field (legacy)
      if (data.content && typeof data.content === 'string') {
        try {
          let content = data.content.trim();
          if (content.startsWith("```json")) {
            content = content.replace(/^```json/, "").trim();
          }
          if (content.endsWith("```")) {
            content = content.replace(/```$/, "").trim();
          }
          parsed = JSON.parse(content);
        } catch {
          parsed = {}; // Fallback for parsing errors
        }
      } else {
        // Handle content stored as top-level fields in the document
        parsed = data;
      }
      
      // Return only the specified fields for performance
      return {
        id: doc.id,
        date: data.date || parsed.date || "",
        title: parsed?.matchData?.title || parsed.title,
        hook: parsed?.matchData?.hook || parsed.hook,
        sport: parsed?.matchData?.sport || parsed.sport,
      };
    });
    console.debug("[Firestore] Fetched articles:", posts);

    // Filter posts to only include those with "vs" in their document ID
    const vsPosts = posts.filter(post => {
      const documentId = post.id.toLowerCase();
      return documentId.includes("vs");
    });

    console.debug("[Firestore] Filtered articles with 'vs':", vsPosts);

    // Group posts into Early Access and Free Articles
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

    const groupedPosts: GroupedPosts = {
      earlyAccess: vsPosts.filter(post => new Date(post.date) > twoWeeksAgo),
      freeArticles: vsPosts.filter(post => new Date(post.date) <= twoWeeksAgo)
    };

    return groupedPosts;
  } catch (error) {
    console.error("[Firestore] Error fetching articles:", error);
    return { earlyAccess: [], freeArticles: [] };
  }
}

export default async function BlogPage() {
  const preferredLanguage = await getUserPreferredLanguage();
  console.log('User preferred language:', preferredLanguage);
  const { earlyAccess, freeArticles } = await getNewsPosts();
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  const decoded = token ? await verifyIdToken(token) : null;
  const isPremium = decoded ? await isUserPremium(decoded.uid) : false;
  const userId = decoded ? decoded.uid : undefined;

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Latest News</h1>
          <p className="text-lg text-[var(--color-gray-dark)] mb-8">Catch up on the latest sports stories, match highlights, and expert analysis from around the world. Powered by FlacronSport AI.</p>
          
          <SportFilter 
            posts={{ earlyAccess, freeArticles }} 
            preferredLanguage={preferredLanguage}
            isPremium={isPremium}
            userId={userId}
          />

          {!isPremium && earlyAccess.length > 0 && (
            <div className="mt-12 p-8 bg-[var(--color-white)] rounded-2xl border-2 border-[var(--color-primary)] shadow-lg">
              <h2 className="text-2xl font-bold text-[var(--color-primary)] mb-4">Premium Early Access</h2>
              <p className="text-[var(--color-gray-dark)] mb-6">
                Get exclusive access to the latest articles and premium content. Upgrade to premium to unlock early access to all new articles.
              </p>
              <div className="flex justify-center">
                <UpgradeButton customerId={userId || ""} />
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
} 