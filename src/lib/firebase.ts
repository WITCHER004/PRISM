import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth"
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics"

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDO4D8Ho1I-5QosfIp6ppe6jQcrPeIbQn8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "prism-2d284.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "prism-2d284",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "prism-2d284.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "264786801070",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:264786801070:web:464f23895c405eb974583f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-9TGPS0XGJN",
}

// Initialize Firebase (singleton pattern for Next.js SSR and hot reloading)
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app)

// Auth Providers
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

export const githubProvider = new GithubAuthProvider()

// Analytics is conditionally initialized on the browser client only
let analyticsInstance: Analytics | null = null
export const getClientAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window === "undefined") return null
  if (analyticsInstance) return analyticsInstance
  try {
    const supported = await isSupported()
    if (supported) {
      analyticsInstance = getAnalytics(app)
      return analyticsInstance
    }
  } catch {
    // Ignore analytics errors (e.g. ad blockers or non-browser environments)
  }
  return null
}

// Authentication Helpers
export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function signInWithGithub() {
  return signInWithPopup(auth, githubProvider)
}

export async function logInWithEmail(email: string, pass: string) {
  return signInWithEmailAndPassword(auth, email, pass)
}

export async function registerWithEmail(email: string, pass: string) {
  return createUserWithEmailAndPassword(auth, email, pass)
}

export async function logOutFirebase() {
  return firebaseSignOut(auth)
}

export { onAuthStateChanged, updateProfile, type FirebaseUser }

