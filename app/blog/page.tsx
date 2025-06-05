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
    const snapshot = await db.collection("articles").get();
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
        date: parsed.date || doc.data().date || "",
      };
    });
    console.debug("[Firestore] Fetched articles:", posts);
    return posts;
  } catch (error) {
    console.error("[Firestore] Error fetching articles:", error);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Latest News</h1>
        <p className="text-lg text-[var(--color-gray-dark)] mb-8">Catch up on the latest sports stories, match highlights, and expert analysis from around the world. Powered by FlacronSport AI.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => (
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
                <Button
                  className="w-full bg-[var(--color-primary)] text-[var(--color-white)] font-semibold rounded-full py-2 px-4 shadow hover:bg-[var(--color-black)] hover:text-[var(--color-primary)] border-2 border-[var(--color-primary)] hover:border-[var(--color-black)] transition-all duration-150"
                  asChild
                >
                  <Link href={`/blog/${post.id}`}>Read Full</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
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
  );
} 