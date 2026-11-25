import "server-only"
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { firebaseConfig } from "@/lib/firebase-config"
import { isAdminEmail } from "@/lib/server/adminEmails"

// Trusted server access to Firebase (bypasses security rules — only ever used after verifying the caller).
//
// Credentials, first match wins:
//   FIREBASE_SERVICE_ACCOUNT_KEY   the service account JSON (Netlify / any host): one line, or base64
//   Google Cloud runtime            Firebase Hosting's framework backend / Cloud Run: built-in credentials
//   FIRESTORE_EMULATOR_HOST         local emulators (tests)

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
  if (!raw) return null
  try {
    return JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"))
  } catch {
    console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or base64 JSON")
    return null
  }
}

const onGoogleCloud = () => Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GOOGLE_CLOUD_PROJECT)
const onEmulator = () => Boolean(process.env.FIRESTORE_EMULATOR_HOST)

/** True when the server can act on Firestore with admin rights */
export function adminConfigured(): boolean {
  return Boolean(serviceAccount() || onGoogleCloud() || onEmulator() || process.env.GOOGLE_APPLICATION_CREDENTIALS)
}

let app: App | null = null
function adminApp(): App {
  if (app) return app
  const existing = getApps().find((a) => a.name === "prism-admin")
  if (existing) return (app = existing)
  const sa = serviceAccount()
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId
  app = initializeApp(
    sa ? { credential: cert(sa), projectId } : onEmulator() ? { projectId } : { credential: applicationDefault(), projectId },
    "prism-admin"
  )
  return app
}

let db: Firestore | null = null
export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(adminApp())
    db.settings({ ignoreUndefinedProperties: true })
  }
  return db
}

export interface VerifiedUser {
  uid: string
  email: string | null
  emailVerified: boolean
  /** Verified, whitelisted staff account (same test as the Firestore rules) */
  isAdmin: boolean
}

/** The caller behind `Authorization: Bearer <Firebase ID token>`, or null */
export async function verifyRequestUser(request: Request): Promise<VerifiedUser | null> {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return null
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token)
    const email = decoded.email ?? null
    const emailVerified = decoded.email_verified === true
    return { uid: decoded.uid, email, emailVerified, isAdmin: emailVerified && isAdminEmail(email) }
  } catch {
    return null
  }
}

/** Verifies an App Check token from the X-Firebase-AppCheck header. Null when App Check isn't enforced. */
export async function verifyAppCheck(request: Request): Promise<boolean | null> {
  if (process.env.APP_CHECK_ENFORCE !== "true") return null
  const token = request.headers.get("x-firebase-appcheck")
  if (!token) return false
  try {
    const { getAppCheck } = await import("firebase-admin/app-check")
    await getAppCheck(adminApp()).verifyToken(token)
    return true
  } catch {
    return false
  }
}
