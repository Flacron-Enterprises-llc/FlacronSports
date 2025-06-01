import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface BlogPost {
  id: string
  title: string
  summary: string
  publishedAt: Date
  slug: string
  featuredImage?: string
}

interface BlogSidebarProps {
  relatedPosts: BlogPost[]
  tags: string[]
}

export function BlogSidebar({ relatedPosts, tags }: BlogSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Related posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Articles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {relatedPosts.length > 0 ? (
            relatedPosts.map((post) => (
              <div key={post.id} className="flex gap-3">
                {post.featuredImage && (
                  <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden">
                    <img
                      src={post.featuredImage || "/placeholder.svg"}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <Link href={`/blog/${post.slug}`} className="font-medium text-sm hover:text-blue-600">
                    {post.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(post.publishedAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No related articles found</p>
          )}
        </CardContent>
      </Card>

      {/* Popular tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Popular Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link href={`/blog?tag=${encodeURIComponent(tag)}`} key={tag}>
                <Badge variant="outline" className="hover:bg-gray-100">
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Newsletter signup */}
      <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <CardHeader>
          <CardTitle className="text-lg">Get Daily Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4 text-blue-100">
            Subscribe to our newsletter for daily sports updates and analysis.
          </p>
          <Link
            href="/#newsletter"
            className="inline-block w-full bg-white text-blue-600 text-center py-2 px-4 rounded-md font-medium text-sm"
          >
            Subscribe Now
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
