import { notFound } from 'next/navigation';
import { getDb } from "@/lib/firebase-config";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/firebase-admin';
import TranslateButtonWrapper from '@/components/blog/TranslateButtonWrapper';
import { API_CONFIG } from "@/lib/api-config";
import Stripe from "stripe";

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

async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    });
    const customer = customers.data[0];
    if (!customer) {
      return false;
    }

    const subs = await stripe.subscriptions.list({ customer: customer.id });
    const hasActive = subs.data.some(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

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

async function getUserPreferredLanguage(db: any, email: string): Promise<string | null> {
  try {
    const doc = await db.collection('dashboard_settings').doc(email).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return data?.language || null;
  } catch (error) {
    console.error("Error getting user language:", error);
    return null;
  }
}

async function getBlogPost(id: string) {
  const db = getDb();
  const doc = await db.collection("articles").doc(id).get();
  
  if (!doc.exists) return null;
  
  const data = doc.data();
  if (!data) return null;

  try {
    let articleData: any;
    if (data.content && typeof data.content === 'string') {
        articleData = JSON.parse(data.content.replace(/^```json/, "").replace(/```$/, "").trim());
    } else {
        articleData = data;
    }

    return {
      id: doc.id,
      ...articleData,
      title: articleData?.matchData?.title || articleData?.title
    };
  } catch {
    return null;
  }
}

export default async function BlogPost({ params }: { params: { id: string } }) {
  const { id } = params;
  
  // Decode the document ID to handle spaces and special characters
  const decodedId = decodeURIComponent(id);
  
  // Get the blog post
  const post = await getBlogPost(decodedId);
  if (!post) {
    notFound();
  }

  const article = post.matchData || post;

  // Check if user is premium and get preferred language
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  const decoded = token ? await verifyIdToken(token) : null;
  const isPremium = decoded ? await isUserPremium(decoded.uid) : false;
  const preferredLanguage = decoded && decoded.email ? await getUserPreferredLanguage(getDb(), decoded.email) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            {article.sport && (
              <div className="text-center mb-4">
                <Badge variant="secondary" className="uppercase tracking-wider text-sm font-semibold">{article.sport}</Badge>
              </div>
            )}
            <CardTitle className="text-3xl font-bold text-center mb-2">{article.title || id}</CardTitle>
            <p className="text-xl text-gray-600 text-center">{article.headline}</p>
            <div className="text-sm text-gray-500 mt-2 text-center">
              {article.date ? new Date(article.date).toLocaleDateString() : ""}
            </div>
            {article.stats && article.stats.teamA && article.stats.teamB && (
              <p className="text-md text-gray-600 text-center mt-1">{article.stats.teamA} vs {article.stats.teamB}</p>
            )}
          </CardHeader>
          <CardContent className="prose max-w-none">
            {article.hook && (
              <p className="text-lg font-semibold italic text-gray-700 my-4 text-center">{article.hook}</p>
            )}
            <p className="lead">{article.details}</p>
            
            {article.stats && (
              <div className="my-8 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-xl font-bold mb-4 text-center">Match Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="font-bold text-lg">{article.stats.teamA}</p>
                    <p className="text-3xl font-bold">{article.stats.scoreA}</p>
                  </div>
                  <div>
                    <p className="font-bold text-lg">{article.stats.teamB}</p>
                    <p className="text-3xl font-bold">{article.stats.scoreB}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mt-4 text-center">
                  <p>Competition: {article.stats.competition}</p>
                </div>
              </div>
            )}

            {article.keyMoments && article.keyMoments.length > 0 && (
              <div className="my-8">
                <h3 className="text-xl font-bold mb-4">Key Moments</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {article.keyMoments.map((moment: string, idx: number) => (
                    <li key={idx}>{moment}</li>
                  ))}
                </ol>
              </div>
            )}
            
            {article.summary && (
              <div className="my-8">
                <h3 className="text-xl font-bold mb-4">Summary</h3>
                <blockquote className="p-4 bg-gray-100 border-l-4 border-gray-500 text-gray-600 italic">
                  <p>{article.summary}</p>
                </blockquote>
              </div>
            )}

            {isPremium && preferredLanguage && preferredLanguage !== 'en' && (
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">🌐 Translate This Article</h3>
                <p className="text-sm text-gray-600 mb-4">
                  As a premium member, you can read this article in your preferred language.
                </p>
                <TranslateButtonWrapper
                  postId={id}
                  language={preferredLanguage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 