"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ThumbsUp, Share2, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface BlogContentProps {
  title: string
  content: string
  publishedAt: Date
  author: string
  tags: string[]
  postId: string
}

export function BlogContent({ title, content, publishedAt, author, tags, postId }: BlogContentProps) {
  const [likes, setLikes] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const handleLike = async () => {
    // In a real implementation, this would call an API
    setIsLiked(!isLiked)
    setLikes(isLiked ? likes - 1 : likes + 1)
  }

  const handleSave = () => {
    setIsSaved(!isSaved)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        text: `Check out this article: ${title}`,
        url: window.location.href,
      })
    } else {
      // Fallback
      navigator.clipboard.writeText(window.location.href)
      alert("Link copied to clipboard!")
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>

      <div className="flex items-center text-sm text-gray-500 mb-6">
        <span>By {author}</span>
        <span className="mx-2">•</span>
        <time dateTime={publishedAt.toISOString()}>{formatDistanceToNow(publishedAt, { addSuffix: true })}</time>
      </div>

      {/* Article content */}
      <div className="prose max-w-none mb-8" dangerouslySetInnerHTML={{ __html: content }} />

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-8">
        {tags.map((tag) => (
          <Link href={`/blog?tag=${encodeURIComponent(tag)}`} key={tag}>
            <Badge variant="outline" className="hover:bg-gray-100">
              {tag}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className={isLiked ? "text-blue-600" : ""} onClick={handleLike}>
            <ThumbsUp className="h-4 w-4 mr-2" />
            {likes > 0 ? likes : "Like"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
        <Button variant="ghost" size="sm" className={isSaved ? "text-blue-600" : ""} onClick={handleSave}>
          <Bookmark className="h-4 w-4 mr-2" />
          {isSaved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  )
}
