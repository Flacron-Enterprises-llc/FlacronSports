import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin';

const serviceAccount: ServiceAccount = {
  projectId: "flacronsport",
  privateKey: "***REMOVED***",
  clientEmail: "firebase-adminsdk-fbsvc@flacronsport.iam.gserviceaccount.com"
};

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: "flacronsport"
  });
}

export const adminAuth = getAuth();
export function getAdminDb() {
  return getFirestore();
}

export async function verifyIdToken(token: string) {
  try {
    return await getAuth().verifyIdToken(token);
  } catch {
    return null;
  }
} 