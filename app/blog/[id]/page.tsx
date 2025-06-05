import { getDb } from "@/lib/firebase-config";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const db = getDb();
  const doc = await db.collection("articles").doc(params.id).get();
  const data = doc.exists ? doc.data() : null;

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Article Not Found</h1>
        </main>
      </div>
    );
  }

  // Parse the JSON content if needed
  let article;
  try {
    article = typeof data.content === "string"
      ? JSON.parse(
          data.content
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim()
        )
      : data.content;
  } catch {
    article = null;
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Article Format</h1>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{article.title}</CardTitle>
            <div className="text-xs text-gray-500 mt-1">
              {article.date ? new Date(article.date).toLocaleDateString() : ""}
            </div>
          </CardHeader>
          <CardContent>
            {article.headings?.map((section: any, idx: number) => (
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