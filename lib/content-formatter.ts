// Content formatting utilities
// Converts Gemini AI responses to Markdown and HTML

import { marked } from "marked"
import { sanitize } from "isomorphic-dompurify"

/**
 * Format content to Markdown
 */
export function formatToMarkdown(content: string): string {
  // Ensure proper heading structure
  let markdown = content

  // Add front matter for metadata if not present
  if (!markdown.startsWith("---")) {
    markdown = `---
title: ${extractTitle(content) || "Sports Update"}
date: ${new Date().toISOString()}
author: FlacronSport AI
---

${markdown}`
  }

  // Ensure proper heading hierarchy
  markdown = ensureHeadingHierarchy(markdown)

  // Add table formatting if needed
  markdown = formatTables(markdown)

  return markdown
}

/**
 * Format content to HTML
 */
export function formatToHtml(content: string): string {
  // Convert markdown to HTML
  const html = marked(content)

  // Sanitize HTML to prevent XSS
  const sanitizedHtml = sanitize(html)

  // Add responsive classes to tables
  const enhancedHtml = sanitizedHtml
    .replace(/<table>/g, '<table class="w-full border-collapse">')
    .replace(/<th>/g, '<th class="border border-gray-300 px-4 py-2 bg-gray-100">')
    .replace(/<td>/g, '<td class="border border-gray-300 px-4 py-2">')

  return enhancedHtml
}

/**
 * Extract title from content
 */
function extractTitle(content: string): string | null {
  // Try to find a title in the content
  const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.+)\n={3,}$/m)
  return titleMatch ? titleMatch[1].trim() : null
}

/**
 * Ensure proper heading hierarchy
 */
function ensureHeadingHierarchy(markdown: string): string {
  // Check if there's an H1 heading
  const hasH1 = /^#\s+.+$/m.test(markdown)

  if (!hasH1) {
    // Extract title from front matter if available
    const titleMatch = markdown.match(/^---\s+title:\s*(.+?)\s*\n/m)
    if (titleMatch) {
      const title = titleMatch[1]
      // Add H1 heading after front matter
      const parts = markdown.split("---")
      if (parts.length >= 3) {
        return `${parts[0]}---${parts[1]}---\n\n# ${title}\n\n${parts.slice(2).join("---")}`
      }
    }
  }

  return markdown
}

/**
 * Format tables in markdown
 */
function formatTables(markdown: string): string {
  // Find table sections and add proper formatting
  return markdown.replace(/(\|.+\|\n\|[-:| ]+\|\n)(\|.+\|\n)+/g, (match) => {
    // Add a newline before and after the table
    return "\n" + match + "\n"
  })
}

/**
 * Extract metadata from content
 */
export function extractMetadata(content: string): Record<string, string> {
  const metadata: Record<string, string> = {}
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[1]
    const lines = frontMatter.split("\n")

    lines.forEach((line) => {
      const match = line.match(/^(\w+):\s*(.+)$/)
      if (match) {
        metadata[match[1]] = match[2].trim()
      }
    })
  }

  return metadata
}

/**
 * Generate excerpt from content
 */
export function generateExcerpt(content: string, length = 150): string {
  // Remove front matter
  let cleanContent = content.replace(/^---\n[\s\S]*?\n---\n/, "")

  // Remove markdown formatting
  cleanContent = cleanContent
    .replace(/#+\s+/g, "") // Remove headings
    .replace(/\*\*/g, "") // Remove bold
    .replace(/\*/g, "") // Remove italic
    .replace(/\[([^\]]+)\]$$[^)]+$$/g, "$1") // Replace links with just the text
    .replace(/!\[[^\]]*\]$$[^)]+$$/g, "") // Remove images
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/\n/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    .trim()

  // Truncate to desired length
  if (cleanContent.length > length) {
    cleanContent = cleanContent.substring(0, length) + "..."
  }

  return cleanContent
}
