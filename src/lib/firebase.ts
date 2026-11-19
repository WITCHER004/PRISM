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
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"
import { firebaseConfig } from "@/lib/firebase-config"

export { firebaseConfig }

// One app, one Auth, one Firestore, one Storage — reused across Next.js HMR reloads.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Long polling instead of WebChannel streaming: WebChannel drops under Turbopack dev and behind some
// proxies/ad-blockers, which shows up as "client is offline". initializeFirestore may only run once per
// app, so the instance is cached on globalThis (HMR re-evaluates this module but keeps the app).
const g = globalThis as typeof globalThis & { __prismFirestore?: Firestore }
function createDb(): Firestore {
  if (g.__prismFirestore) return g.__prismFirestore
  let instance: Firestore
  try {
    instance = initializeFirestore(app, { experimentalForceLongPolling: true })
  } catch {
    instance = getFirestore(app) // "already been started": reuse it
  }
  g.__prismFirestore = instance
  return instance
}
/**
 * Browser only. Client components also render on the server (SSR), and this module comes along with
 * them, but nothing there may start Firestore's long-polling transport; server code reads Firestore over
 * REST instead (src/lib/server/content.ts). Every use of `db` sits in an effect, a listener or an event
 * handler, none of which run during SSR; touching it on the server throws a clear error.
 */
export const db: Firestore =
  typeof window !== "undefined"
    ? createDb()
    : (new Proxy({} as Firestore, {
        get(_t, prop) {
          if (prop === "then" || typeof prop === "symbol") return undefined
          throw new Error(`[firebase] Firestore is browser-only; read it on the server via src/lib/server/content.ts (tried db.${String(prop)})`)
        },
      }) as Firestore)

export const storage: FirebaseStorage = getStorage(app)

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

