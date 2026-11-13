import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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

if (!firebaseConfig.projectId) {
  console.warn("[firebase] projectId is missing. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local.")
}

// Initialize Firebase (singleton pattern for Next.js SSR and hot reloading)
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app)

// Keep the session across reloads and tabs. Browser-only; resolves immediately on the server.
export const authPersistenceReady: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn("[auth] Could not enable local persistence:", err)
      })

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
// Popup first: redirects break on localhost and in browsers that block third-party cookies.
// Fall back to a redirect only when the popup itself can't open; onAuthStateChanged picks up the result.
const POPUP_UNAVAILABLE = new Set(["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"])

export async function signInWithGoogle() {
  await authPersistenceReady
  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code && POPUP_UNAVAILABLE.has(code)) {
      await signInWithRedirect(auth, googleProvider)
      return null
    }
    throw err
  }
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

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email)
}

export async function logOutFirebase() {
  return firebaseSignOut(auth)
}

export { onAuthStateChanged, updateProfile, type FirebaseUser }

