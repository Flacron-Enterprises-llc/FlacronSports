// User follow service for managing user subscriptions to authors, teams, and tags

import { getDb, COLLECTIONS } from "./firebase-config"
import type { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore"

interface Follow {
  userId: string
  followType: "author" | "team" | "tag"
  followId: string
  createdAt: Date
}

export class UserFollowService {
  /**
   * Follow an author, team, or tag
   */
  async followItem(userId: string, followType: "author" | "team" | "tag", followId: string): Promise<boolean> {
    try {
      const db = getDb();
      if (!db) return false;
      
      const followRef = db.collection(COLLECTIONS.USER_FOLLOWS).doc(`${userId}_${followType}_${followId}`)

      const followDoc = await followRef.get()

      if (followDoc.exists) {
        // Already following
        return true
      }

      // Create follow record
      await followRef.set({
        userId,
        followType,
        followId,
        createdAt: new Date(),
      })

      // Update follow count
      await this.updateFollowCount(followType, followId, 1)

      return true
    } catch (error) {
      console.error("Error following item:", error)
      return false
    }
  }

  /**
   * Unfollow an author, team, or tag
   */
  async unfollowItem(userId: string, followType: "author" | "team" | "tag", followId: string): Promise<boolean> {
    try {
      const db = getDb();
      if (!db) return false;
      
      const followRef = db.collection(COLLECTIONS.USER_FOLLOWS).doc(`${userId}_${followType}_${followId}`)

      const followDoc = await followRef.get()

      if (!followDoc.exists) {
        // Not following
        return true
      }

      // Delete follow record
      await followRef.delete()

      // Update follow count
      await this.updateFollowCount(followType, followId, -1)

      return true
    } catch (error) {
      console.error("Error unfollowing item:", error)
      return false
    }
  }

  /**
   * Check if user is following an item
   */
  async isFollowing(userId: string, followType: "author" | "team" | "tag", followId: string): Promise<boolean> {
    try {
      const db = getDb();
      if (!db) return false;
      
      const followRef = db.collection(COLLECTIONS.USER_FOLLOWS).doc(`${userId}_${followType}_${followId}`)

      const followDoc = await followRef.get()
      return followDoc.exists
    } catch (error) {
      console.error("Error checking follow status:", error)
      return false
    }
  }

  /**
   * Get all items a user is following
   */
  async getUserFollows(userId: string, followType?: "author" | "team" | "tag"): Promise<Follow[]> {
    try {
      const db = getDb();
      if (!db) return [];
      
      let query = db.collection(COLLECTIONS.USER_FOLLOWS).where("userId", "==", userId)

      if (followType) {
        query = query.where("followType", "==", followType)
      }

      const snapshot = await query.get()
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as Follow)
    } catch (error) {
      console.error("Error getting user follows:", error)
      return []
    }
  }

  /**
   * Get all users following an item
   */
  async getItemFollowers(followType: "author" | "team" | "tag", followId: string): Promise<string[]> {
    try {
      const db = getDb();
      if (!db) return [];
      
      const snapshot = await db
        .collection(COLLECTIONS.USER_FOLLOWS)
        .where("followType", "==", followType)
        .where("followId", "==", followId)
        .get()

      return snapshot.docs.map((doc: QueryDocumentSnapshot) => (doc.data() as Follow).userId)
    } catch (error) {
      console.error("Error getting item followers:", error)
      return []
    }
  }

  /**
   * Update follow count for an item
   */
  private async updateFollowCount(
    followType: "author" | "team" | "tag",
    followId: string,
    increment: number,
  ): Promise<void> {
    try {
      const db = getDb();
      if (!db) return;
      
      let collectionName: string

      switch (followType) {
        case "author":
          collectionName = "authors"
          break
        case "team":
          collectionName = "teams"
          break
        case "tag":
          collectionName = "tags"
          break
      }

      await db
        .collection(collectionName)
        .doc(followId)
        .update({
          followerCount: db.FieldValue.increment(increment),
        })
    } catch (error) {
      console.error("Error updating follow count:", error)
    }
  }

  /**
   * Get recommended items to follow based on user's interests
   */
  async getRecommendedFollows(userId: string, followType: "author" | "team" | "tag", limit = 5): Promise<string[]> {
    try {
      const db = getDb();
      if (!db) return [];
      
      // In a real implementation, this would use a recommendation algorithm
      // For now, return popular items
      let collectionName: string

      switch (followType) {
        case "author":
          collectionName = "authors"
          break
        case "team":
          collectionName = "teams"
          break
        case "tag":
          collectionName = "tags"
          break
      }

      const snapshot = await db.collection(collectionName).orderBy("followerCount", "desc").limit(limit).get()

      return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.id)
    } catch (error) {
      console.error("Error getting recommended follows:", error)
      return []
    }
  }
}

export const userFollowService = new UserFollowService()
