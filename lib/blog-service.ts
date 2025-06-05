// Blog publishing automation service
// Handles content generation, formatting, and publishing

import { getDb, COLLECTIONS, saveBlogPost } from "./firebase-config"
import { geminiService } from "./gemini-service"
import { sportsApiService } from "./sports-api"
import { generateFeaturedImage } from "./image-service"
import type { QueryDocumentSnapshot } from "firebase-admin/firestore"

interface BlogPost {
  id: string
  title: string
  content: string
  summary: string
  tags: string[]
  seoMetaDescription: string
  publishedAt: Date
  status: "draft" | "published"
  aiGenerated: boolean
  slug: string
  featuredImage?: string
  author: string
  views: number
  likes: number
  language: string
  translations?: Record<string, string> // Maps language code to post ID
  teams?: string[]
  categories?: string[]
  structuredData?: Record<string, any>
}

export class BlogService {
  /**
   * Generate and publish blog posts from match data
   */
  async generateAndPublishContent(language = "en"): Promise<BlogPost | null> {
    try {
      console.log(`Starting blog generation in ${language}...`)

      // 1. Fetch yesterday's match results
      const yesterdayMatches = await sportsApiService.getYesterdayMatches()

      if (yesterdayMatches.length === 0) {
        console.log("No matches found for content generation")
        return null
      }

      // 2. Filter significant matches (completed games with goals)
      const significantMatches = yesterdayMatches.filter(
        (match) => match.status === "FT" && (match.homeScore > 0 || match.awayScore > 0),
      )

      if (significantMatches.length === 0) {
        console.log("No significant matches found")
        return null
      }

      // 3. Generate blog content using Gemini
      const content = await geminiService.generateBlogPost(significantMatches, language)

      // 4. Generate a featured image
      const featuredImage = await generateFeaturedImage(content.title)

      // 5. Create slug from title
      const slug = this.createSlug(content.title)

      // 6. Create structured data for SEO
      const structuredData = this.generateStructuredData(content, language)

      // 7. Create blog post object
      const blogPost: BlogPost = {
        id: `post-${Date.now()}`,
        title: content.title,
        content: content.content,
        summary: content.summary,
        tags: content.tags,
        seoMetaDescription: content.seoMetaDescription,
        publishedAt: new Date(),
        status: "published",
        aiGenerated: true,
        slug,
        featuredImage,
        author: "FlacronSport AI",
        views: 0,
        likes: 0,
        language,
        teams: this.extractTeams(significantMatches),
        categories: ["Sports", "Match Summary", "AI Generated"],
        structuredData,
      }

      // 8. Save to database
      await saveBlogPost(blogPost)

      // 9. Generate translations if needed
      if (language === "en") {
        await this.generateTranslations(blogPost, significantMatches)
      }

      console.log(`Blog post "${content.title}" published successfully`)
      return blogPost
    } catch (error) {
      console.error("Error in blog generation:", error)
      return null
    }
  }

  /**
   * Generate translations for a blog post
   */
  private async generateTranslations(originalPost: BlogPost, matchData: any[]): Promise<Record<string, string> | null> {
    try {
      const languages = ["es", "fr", "de", "it"] // Spanish, French, German, Italian
      const translations: Record<string, string> = {}

      for (const lang of languages) {
        console.log(`Generating ${lang} translation...`)
        const translatedContent = await geminiService.generateBlogPost(matchData, lang)

        // Create translated blog post
        const translatedPost: BlogPost = {
          ...originalPost,
          id: `post-${Date.now()}-${lang}`,
          title: translatedContent.title,
          content: translatedContent.content,
          summary: translatedContent.summary,
          seoMetaDescription: translatedContent.seoMetaDescription,
          language: lang,
          translations: {
            ...originalPost.translations,
            en: originalPost.id,
          },
        }

        // Save translated post
        await saveBlogPost(translatedPost)
        translations[lang] = translatedPost.id

        // Update original post with translation reference
        if (!originalPost.translations) {
          originalPost.translations = {}
        }
        originalPost.translations[lang] = translatedPost.id
      }

      // Update original post with all translation references
      await getDb().collection(COLLECTIONS.BLOG_POSTS).doc(originalPost.id).update({
        translations,
      })

      return translations
    } catch (error) {
      console.error("Error generating translations:", error)
      return null
    }
  }

  /**
   * Create URL-friendly slug from title
   */
  private createSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
  }

  /**
   * Extract team names from match data
   */
  private extractTeams(matches: any[]): string[] {
    const teams = new Set<string>()
    matches.forEach((match) => {
      if (match.homeTeam) teams.add(match.homeTeam)
      if (match.awayTeam) teams.add(match.awayTeam)
    })
    return Array.from(teams)
  }

  /**
   * Generate structured data for SEO
   */
  private generateStructuredData(content: any, language: string): Record<string, any> {
    return {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: content.title,
      description: content.seoMetaDescription,
      image: content.featuredImage,
      datePublished: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      author: {
        "@type": "Organization",
        name: "FlacronSport AI",
        url: "https://flacronsport.com",
      },
      publisher: {
        "@type": "Organization",
        name: "FlacronSport Daily",
        logo: {
          "@type": "ImageObject",
          url: "https://flacronsport.com/logo.png",
        },
      },
      inLanguage: language,
      keywords: content.tags.join(", "),
    }
  }

  /**
   * Get recent blog posts
   */
  async getRecentPosts(language = "en", limit = 10): Promise<Partial<BlogPost>[]> {
    try {
      const snapshot = await getDb()
        .collection("articles")
        .orderBy("publishedAt", "desc")
        .limit(limit)
        .get()

      // Only return id, title, and publishedAt
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
        id: doc.id,
        title: doc.data().title,
        publishedAt: doc.data().publishedAt,
      }))
    } catch (error) {
      console.error("Error fetching recent posts:", error)
      return []
    }
  }

  /**
   * Get blog post by slug
   */
  async getPostBySlug(slug: string, language = "en"): Promise<BlogPost | null> {
    try {
      const snapshot = await getDb()
        .collection(COLLECTIONS.BLOG_POSTS)
        .where("slug", "==", slug)
        .where("language", "==", language)
        .limit(1)
        .get()

      if (snapshot.empty) {
        return null
      }

      return snapshot.docs[0].data() as BlogPost
    } catch (error) {
      console.error("Error fetching post by slug:", error)
      return null
    }
  }

  /**
   * Get posts by team
   */
  async getPostsByTeam(team: string, language = "en", limit = 10): Promise<BlogPost[]> {
    try {
      const snapshot = await getDb()
        .collection(COLLECTIONS.BLOG_POSTS)
        .where("teams", "array-contains", team)
        .where("language", "==", language)
        .orderBy("publishedAt", "desc")
        .limit(limit)
        .get()

      return snapshot.docs.map((doc) => doc.data() as BlogPost)
    } catch (error) {
      console.error("Error fetching posts by team:", error)
      return []
    }
  }

  /**
   * Get posts by tag
   */
  async getPostsByTag(tag: string, language = "en", limit = 10): Promise<BlogPost[]> {
    try {
      const snapshot = await getDb()
        .collection(COLLECTIONS.BLOG_POSTS)
        .where("tags", "array-contains", tag)
        .where("language", "==", language)
        .orderBy("publishedAt", "desc")
        .limit(limit)
        .get()

      return snapshot.docs.map((doc) => doc.data() as BlogPost)
    } catch (error) {
      console.error("Error fetching posts by tag:", error)
      return []
    }
  }

  /**
   * Increment post view count
   */
  async incrementViewCount(postId: string): Promise<void> {
    try {
      await getDb()
        .collection(COLLECTIONS.BLOG_POSTS)
        .doc(postId)
        .update({
          views: getDb().FieldValue.increment(1),
        })
    } catch (error) {
      console.error("Error incrementing view count:", error)
    }
  }

  /**
   * Like/unlike a post
   */
  async toggleLike(postId: string, userId: string): Promise<boolean> {
    try {
      // Check if user already liked the post
      const likeRef = getDb().collection(COLLECTIONS.BLOG_POSTS).doc(postId).collection("likes").doc(userId)
      const likeDoc = await likeRef.get()

      if (likeDoc.exists) {
        // Unlike
        await likeRef.delete()
        await getDb()
          .collection(COLLECTIONS.BLOG_POSTS)
          .doc(postId)
          .update({
            likes: getDb().FieldValue.increment(-1),
          })
        return false
      } else {
        // Like
        await likeRef.set({ userId, timestamp: new Date() })
        await getDb()
          .collection(COLLECTIONS.BLOG_POSTS)
          .doc(postId)
          .update({
            likes: getDb().FieldValue.increment(1),
          })
        return true
      }
    } catch (error) {
      console.error("Error toggling like:", error)
      return false
    }
  }
}

export const blogService = new BlogService()
