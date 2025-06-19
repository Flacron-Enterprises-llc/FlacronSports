import { notFound } from 'next/navigation';
import { getDb } from "@/lib/firebase-config";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getBlogPost(id: string) {
  const db = getDb();
  const doc = await db.collection("articles").doc(id).get();
  
  if (!doc.exists) return null;
  
  const data = doc.data();
  if (!data) return null;

  try {
    const content = typeof data.content === "string"
      ? JSON.parse(data.content.replace(/^```json/, "").replace(/```$/, "").trim())
      : data.content;

    return {
      id: doc.id,
      ...content
    };
  } catch {
    return null;
  }
}

export default async function BlogPost({ params }: { params: { id: string } }) {
  const { id } = params;
  
  // Get the blog post
  const post = await getBlogPost(id);
  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{post.title}</CardTitle>
            <div className="text-xs text-gray-500 mt-1">
              {post.date ? new Date(post.date).toLocaleDateString() : ""}
            </div>
          </CardHeader>
          <CardContent>
            {post.headings?.map((section: any, idx: number) => (
              <section key={idx} className="mb-6">
                <h2 className="text-xl font-semibold mb-2">{section.heading}</h2>
                <p className="text-base text-gray-800">{section.content}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 