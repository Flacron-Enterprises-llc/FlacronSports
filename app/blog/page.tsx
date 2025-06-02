import fs from "fs"
import path from "path"
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Navbar from "@/components/Navbar"

// Load service account JSON directly
const serviceAccountPath = path.join(process.cwd(), "flacronsport-firebase-adminsdk-fbsvc-fefc044fc6.json")
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  })
}
const db = getFirestore()

async function getNewsPosts() {
  try {
    const snapshot = await db.collection("generated_content").get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    console.debug("[Firestore] Fetched generated_content:", posts);
    return posts;
  } catch (error) {
    console.error("[Firestore] Error fetching generated_content:", error);
    return [];
  }
}

export default async function NewsPage() {
  const posts = await getNewsPosts();
  console.debug("[NewsPage] Posts received:", posts);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Latest News</h1>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => (
            <Card key={post.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">{post.sport}</span>
                </div>
                <CardTitle className="text-lg leading-tight">{post.title || post.id}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/blog/${post.slug || post.id}`}>Read Article</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
} 