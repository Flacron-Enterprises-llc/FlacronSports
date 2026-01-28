import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxoiq8YSQv3wyw6VvplDYVKgxxZUnbL0M",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "flacronsport.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "flacronsport",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "flacronsport.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "587360197502",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:587360197502:web:097599fd8704c9de4b312f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-QDL3CFFL3V"
};

// Lazy initialization of Firebase - only initialize when needed
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let googleProvider: GoogleAuthProvider | null = null;

function getFirebaseApp() {
  // Skip initialization during Next.js build process
  if (process.env.NEXT_PHASE === 'phase-production-build' || 
      (typeof window === 'undefined' && !process.env.NEXT_RUNTIME)) {
    return null;
  }
  
  if (!app) {
    // Check if apiKey exists, otherwise use fallback
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey;
    if (!apiKey || apiKey === '') {
      console.warn('Firebase API key not found. Using fallback configuration.');
    }
    
    try {
      app = initializeApp(firebaseConfig);
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      return null;
    }
  }
  return app;
}

function getFirebaseAuth() {
  if (!auth) {
    const app = getFirebaseApp();
    if (!app) {
      throw new Error('Firebase app not initialized. Make sure you are in a browser environment.');
    }
    auth = getAuth(app);
  }
  return auth;
}

function getGoogleProvider() {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

// Email/Password Sign In
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const authInstance = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Email/Password Sign Up
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const authInstance = getFirebaseAuth();
    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Google Sign In
export const signInWithGoogle = async () => {
  try {
    const authInstance = getFirebaseAuth();
    const provider = getGoogleProvider();
    const result = await signInWithPopup(authInstance, provider);
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Sign Out
export const signOutUser = async () => {
  try {
    const authInstance = getFirebaseAuth();
    await signOut(authInstance);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Get current user
export const getCurrentUser = () => {
  return new Promise<User | null>((resolve) => {
    const authInstance = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Export auth getter function for backward compatibility (lazy initialization)
// Note: Use getFirebaseAuth() directly in new code
export function getAuthInstance() {
  return getFirebaseAuth();
} 