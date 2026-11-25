import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  getAdditionalUserInfo,
  getRedirectResult,
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
  type UserCredential,
  type User as FirebaseUser,
} from "firebase/auth"
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics"
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check"
import { firebaseConfig } from "@/lib/firebase-config"

export { firebaseConfig }

// One app, one Auth, one Firestore, one Storage — reused across Next.js HMR reloads.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

// App Check: proves requests come from this site (not a script holding the public API key). On when
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set; enforce it per service in the Firebase console. It must start
// before Firestore/Storage/Auth make their first request, so it lives right here.
const gac = globalThis as typeof globalThis & { __prismAppCheck?: AppCheck }
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
export const appCheck: AppCheck | null =
  typeof window !== "undefined" && RECAPTCHA_SITE_KEY
    ? (gac.__prismAppCheck ??= initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true }))
    : null

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
const LOGIN_REDIRECT_KEY = "prism:login-redirect"
const POPUP_UNAVAILABLE = new Set(["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"])

export async function signInWithGoogle(fromLoginPage = false) {
  await authPersistenceReady
  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code && POPUP_UNAVAILABLE.has(code)) {
      // The page reloads after the redirect, so remember that it started on the sign-in page
      if (fromLoginPage) {
        try {
          sessionStorage.setItem(LOGIN_REDIRECT_KEY, "1")
        } catch {}
      }
      await signInWithRedirect(auth, googleProvider)
      return null
    }
    throw err
  }
}

export async function signInWithGithub() {
  return signInWithPopup(auth, githubProvider)
}

// While the sign-in page checks whether an OAuth account already existed, AuthProvider waits on this
// before writing users/{uid}, so a rejected brand-new account leaves no profile or handle behind.
let loginGate: Promise<void> | null = null
export const awaitLoginGate = () => loginGate ?? Promise.resolve()

const noAccountError = () =>
  Object.assign(new Error("No Prism account is linked to this sign-in yet."), { code: "auth/prism-no-account" })

/** Runs `fn` with the login gate held; a brand-new account in its result is deleted and rejected. */
async function requireExistingAccount(fn: () => Promise<UserCredential | null>) {
  let release!: () => void
  loginGate = new Promise<void>((r) => (release = r))
  try {
    const result = await fn()
    if (result && getAdditionalUserInfo(result)?.isNewUser) {
      await result.user.delete().catch(() => firebaseSignOut(auth))
      throw noAccountError()
    }
    return result
  } finally {
    release()
    loginGate = null
  }
}

/**
 * Sign-in page only: OAuth popups create a Firebase account when none exists. If this one is brand
 * new, delete it again and throw `auth/prism-no-account` so the caller can send the user to signup.
 */
export function signInExistingWithProvider(p: "google" | "github") {
  return requireExistingAccount(() => (p === "google" ? signInWithGoogle(true) : signInWithGithub()))
}

// Redirect fallback: when the page comes back from a redirect that started on the sign-in page, run the
// same check on the redirect result. It starts at module load so the gate is held before AuthProvider
// subscribes to auth state and sees the new user.
let loginRedirectCheck: Promise<UserCredential | null> | null = null
if (typeof window !== "undefined") {
  let pending = false
  try {
    pending = sessionStorage.getItem(LOGIN_REDIRECT_KEY) === "1"
    sessionStorage.removeItem(LOGIN_REDIRECT_KEY)
  } catch {}
  if (pending) {
    loginRedirectCheck = requireExistingAccount(async () => {
      await authPersistenceReady
      return getRedirectResult(auth)
    })
    loginRedirectCheck.catch(() => {}) // surfaced to the sign-in page via consumeLoginRedirect()
  }
}

/** The sign-in page's redirect result, once: the credential, null, or a rejection (`auth/prism-no-account`). */
export function consumeLoginRedirect(): Promise<UserCredential | null> {
  const check = loginRedirectCheck
  loginRedirectCheck = null
  return check ?? Promise.resolve(null)
}

/**
 * Asks Prism's server whether this email/password attempt is within the rate limits (per IP and per
 * address). Throws an error carrying a readable message when it isn't. If our server can't be reached,
 * the attempt goes ahead: Firebase Auth still applies its own lockouts.
 */
async function guardAuthAttempt(kind: "signin" | "signup" | "reset", email: string) {
  if (typeof window === "undefined") return
  let res: Response
  try {
    const { appCheckToken } = await import("@/lib/appCheck")
    const check = await appCheckToken()
    res = await fetch("/api/auth/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(check ? { "X-Firebase-AppCheck": check } : {}) },
      body: JSON.stringify({ kind, email: email.trim().toLowerCase() }),
    })
  } catch {
    return
  }
  if (res.ok) return
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  throw Object.assign(new Error(data.error ?? "Too many attempts. Try again later."), { code: "auth/prism-rate-limited" })
}

export async function logInWithEmail(email: string, pass: string) {
  await guardAuthAttempt("signin", email)
  return signInWithEmailAndPassword(auth, email, pass)
}

export async function registerWithEmail(email: string, pass: string) {
  await guardAuthAttempt("signup", email)
  return createUserWithEmailAndPassword(auth, email, pass)
}

export async function resetPassword(email: string) {
  await guardAuthAttempt("reset", email)
  return sendPasswordResetEmail(auth, email)
}

export async function logOutFirebase() {
  return firebaseSignOut(auth)
}

export { onAuthStateChanged, updateProfile, type FirebaseUser }

