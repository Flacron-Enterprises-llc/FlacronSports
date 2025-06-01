// Firebase configuration for storing match data
import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

let db: any = null

// Initialize Firebase Admin SDK only when needed
function initializeFirebase() {
  if (db) return db

  try {
    if (!getApps().length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        console.warn("Firebase environment variables not found")
        return null
      }

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      })
    }

    db = getFirestore()
    return db
  } catch (error) {
    console.error("Firebase initialization error:", error)
    return null
  }
}

// Export a getter function instead of direct db export
export function getDb() {
  return initializeFirebase()
}

// Database collections
export const COLLECTIONS = {
  MATCHES: "matches",
  BLOG_POSTS: "blog-posts",
}

// Mock functions for now to avoid Firebase initialization errors
export async function saveMatchData(matches: any[]) {
  console.log(`Would save ${matches.length} matches to Firebase`)
  return matches.length
}

export async function getStoredMatches(date?: string) {
  console.log("Would get stored matches from Firebase")
  return []
}

export async function saveBlogPost(content: any) {
  console.log("Would save blog post to Firebase")
  return content
}

// Health check function
export async function testFirebaseConnection() {
  console.log("Firebase connection test skipped")
  return false
}
