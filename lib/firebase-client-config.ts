// Client-side Firebase configuration for the browser
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCxoiq8YSQv3wyw6VvplDYVKgxxZUnbL0M",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "flacronsport.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "flacronsport",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "flacronsport.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "587360197502",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:587360197502:web:097599fd8704c9de4b312f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-QDL3CFFL3V"
}; 