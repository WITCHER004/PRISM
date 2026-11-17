// Firebase web config. These keys identify the project; they are not secrets (access is governed by
// Firestore/Storage rules). NEXT_PUBLIC_FIREBASE_* env vars override them, e.g. for a staging project.
// Kept free of SDK imports so server code can read it without pulling in Auth.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDO4D8Ho1I-5QosfIp6ppe6jQcrPeIbQn8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "prism-2d284.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "prism-2d284",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "prism-2d284.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "264786801070",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:264786801070:web:464f23895c405eb974583f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-9TGPS0XGJN",
}
