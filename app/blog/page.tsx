import fs from "fs"
import path from "path"
import { cookies } from 'next/headers'
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
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

// Load service account JSON directly
const serviceAccountPath = path.join(process.cwd(), "flacronsport-firebase-adminsdk-fbsvc-fefc044fc6.json")
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  })
}
const db = getFirestore()

const stripe = new Stripe(API_CONFIG.payments.stripe.secretKey, {
  apiVersion: "2025-05-28.basil",
});

async function getUserPreferredLanguage(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  if (!decoded) return null;
  const db = getAdminDb();

  // Get user email from decoded token
  const userEmail = decoded.email;
  if (!userEmail) return null;

  // Fetch from dashboard_settings collection using email as doc ID
  const doc = await db.collection('dashboard_settings').doc(userEmail).get();
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

async function getNewsPosts() {
  try {
    const snapshot = await db.collection("articles").orderBy("date", "desc").get();
    const posts = snapshot.docs.map((doc) => {
      let content = doc.data().content;
      let parsed: any = {};
      try {
        if (typeof content === "string") {
          // Remove triple backticks and the word 'json'
          content = content.trim();
          if (content.startsWith("```json")) {
            content = content.replace(/^```json/, "").trim();
          }
          if (content.endsWith("```")) {
            content = content.replace(/```$/, "").trim();
          }
          parsed = JSON.parse(content);
        } else {
          parsed = content;
        }
      } catch {
        parsed = {};
      }
      // Return all available fields from parsed JSON, plus id and fallback date
      return {
        id: doc.id,
        ...parsed,
        date: doc.data().date || "",
      };
    });
    console.debug("[Firestore] Fetched articles:", posts);

    // Group posts into Early Access and Free Articles
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

    const groupedPosts = {
      earlyAccess: posts.filter(post => new Date(post.date) > twoWeeksAgo),
      freeArticles: posts.filter(post => new Date(post.date) <= twoWeeksAgo)
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
          
          {isPremium && earlyAccess.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Early Access</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {earlyAccess.map((post: any) => (
                  <Card
                    key={post.id}
                    className="bg-[var(--color-white)] border-2 border-[var(--color-primary)] shadow-lg rounded-2xl hover:shadow-xl transition-all duration-200 group"
                    style={{ boxShadow: '0 4px 24px 0 rgba(255,127,0,0.08)' }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg leading-tight text-[var(--color-black)] group-hover:text-[var(--color-primary)] transition-colors">
                        {post.title || post.id}
                      </CardTitle>
                      {post.summary && (
                        <p className="text-sm text-[var(--color-gray-mid)] mt-2 line-clamp-3">{post.summary}</p>
                      )}
                      <div className="text-xs text-[var(--color-gray-mid)] mt-1">
                        {post.date ? new Date(post.date).toLocaleDateString() : ""}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {preferredLanguage && preferredLanguage !== 'en' && (
                          <TranslateButtonWrapper
                            postId={post.id}
                            language={preferredLanguage}
                          />
                        )}
                        <Button
                          className="flex-1 bg-gray-200 text-[var(--color-primary)] font-semibold rounded-full py-2 px-4 shadow border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all duration-150"
                          asChild
                        >
                          <Link href={`/blog/${post.id}`}>
                            View Original
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!isPremium && earlyAccess.length > 0 && (
            <div className="mb-12 p-8 bg-[var(--color-white)] rounded-2xl border-2 border-[var(--color-primary)] shadow-lg">
              <h2 className="text-2xl font-bold text-[var(--color-primary)] mb-4">Premium Early Access</h2>
              <p className="text-[var(--color-gray-dark)] mb-6">
                Get exclusive access to the latest articles and premium content. Upgrade to premium to unlock early access to all new articles.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {earlyAccess.map((post: any) => (
                  <Card
                    key={post.id}
                    className="bg-[var(--color-white)] border-2 border-[var(--color-primary)] shadow-lg rounded-2xl group"
                    style={{ boxShadow: '0 4px 24px 0 rgba(255,127,0,0.08)' }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg leading-tight text-[var(--color-black)] group-hover:text-[var(--color-primary)] transition-colors">
                        {post.title || post.id}
                      </CardTitle>
                      {post.summary && (
                        <p className="text-sm text-[var(--color-gray-mid)] mt-2 line-clamp-3">{post.summary}</p>
                      )}
                      <div className="text-xs text-[var(--color-gray-mid)] mt-1">
                        {post.date ? new Date(post.date).toLocaleDateString() : ""}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-gray-200 text-[var(--color-primary)] font-semibold rounded-full py-2 px-4 shadow border-2 border-[var(--color-primary)] opacity-60 cursor-not-allowed"
                          disabled
                        >
                          View Original
                        </Button>
                        {preferredLanguage && preferredLanguage !== 'en' && (
                          <Button
                            className="flex-1 bg-[var(--color-primary)] text-[var(--color-white)] font-semibold rounded-full py-2 px-4 shadow border-2 border-[var(--color-primary)] opacity-60 cursor-not-allowed"
                            disabled
                          >
                            Translate to {preferredLanguage.toUpperCase()}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-center">
                <UpgradeButton customerId={userId || ""} />
              </div>
            </div>
          )}

          {freeArticles.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-gray-dark)] mb-6">Free Articles</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {freeArticles.map((post: any) => (
                  <Card
                    key={post.id}
                    className="bg-[var(--color-white)] border-2 border-[var(--color-primary)] shadow-lg rounded-2xl hover:shadow-xl transition-all duration-200 group"
                    style={{ boxShadow: '0 4px 24px 0 rgba(255,127,0,0.08)' }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg leading-tight text-[var(--color-black)] group-hover:text-[var(--color-primary)] transition-colors">
                        {post.title || post.id}
                      </CardTitle>
                      {post.summary && (
                        <p className="text-sm text-[var(--color-gray-mid)] mt-2 line-clamp-3">{post.summary}</p>
                      )}
                      <div className="text-xs text-[var(--color-gray-mid)] mt-1">
                        {post.date ? new Date(post.date).toLocaleDateString() : ""}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {preferredLanguage && preferredLanguage !== 'en' && (
                          <TranslateButtonWrapper
                            postId={post.id}
                            language={preferredLanguage}
                          />
                        )}
                        <Button
                          className="flex-1 bg-gray-200 text-[var(--color-primary)] font-semibold rounded-full py-2 px-4 shadow border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all duration-150"
                          asChild
                        >
                          <Link href={`/blog/${post.id}`}>
                            View Original
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
        <footer className="mt-16 py-8 border-t border-[var(--color-border)] bg-[var(--color-black)] text-[var(--color-white)] text-center rounded-t-2xl shadow-lg">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3 justify-center">
              <img src="/logo.png" alt="FlacronSport Logo" width={40} height={40} className="rounded" />
              <span className="font-bold text-xl tracking-wide">FlacronSport</span>
            </div>
            <div className="text-sm text-[var(--color-gray-mid)]">&copy; {new Date().getFullYear()} FlacronSport. All rights reserved.</div>
            <div className="flex gap-4 justify-center">
              <a href="/" className="hover:text-[var(--color-primary)] transition-colors">Home</a>
              <a href="/blog" className="hover:text-[var(--color-primary)] transition-colors">Blog</a>
              <a href="mailto:contact@flacronsport.com" className="hover:text-[var(--color-primary)] transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </ProtectedRoute>
  );
} 