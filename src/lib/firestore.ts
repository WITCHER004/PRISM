import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore"
import { app } from "@/lib/firebase"

// Kept out of firebase.ts on purpose: the UI store imports that file on every page,
// so Firestore is only loaded (dynamically) where it's needed.
//
// Long polling instead of WebChannel streaming: WebChannel drops under Turbopack dev and some
// ad-blockers/proxies, which surfaces as "Failed to get document because the client is offline".
function createDb(): Firestore {
  try {
    return initializeFirestore(app, { experimentalForceLongPolling: true })
  } catch {
    // Already initialized for this app (HMR re-ran the module): reuse it
    return getFirestore(app)
  }
}

export const db: Firestore = createDb()
