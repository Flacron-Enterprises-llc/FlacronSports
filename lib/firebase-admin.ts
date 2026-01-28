import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin';

let adminAuthInstance: ReturnType<typeof getAuth> | null = null;
let adminDbInstance: ReturnType<typeof getFirestore> | null = null;

// Lazy initialization of Firebase Admin
function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return; // Already initialized
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  // Only initialize if we have the required environment variables
  if (!projectId || !privateKey || !clientEmail) {
    console.warn('Firebase Admin environment variables not found. Skipping initialization.');
    return;
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    privateKey,
    clientEmail
  };

  try {
    initializeApp({
      credential: cert(serviceAccount),
      projectId
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

export function getAdminAuth() {
  if (!adminAuthInstance) {
    initializeFirebaseAdmin();
    if (getApps().length > 0) {
      adminAuthInstance = getAuth();
    }
  }
  return adminAuthInstance;
}

export function getAdminDb() {
  if (!adminDbInstance) {
    initializeFirebaseAdmin();
    if (getApps().length > 0) {
      adminDbInstance = getFirestore();
    }
  }
  return adminDbInstance;
}

// For backward compatibility
export const adminAuth = getAdminAuth();

export async function verifyIdToken(token: string) {
  try {
    const auth = getAdminAuth();
    if (!auth) return null;
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
} 