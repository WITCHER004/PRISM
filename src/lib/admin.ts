// Whether the signed-in account is a Prism admin, without shipping the admin list to the browser.
// The list lives only in server code (src/lib/server/adminEmails.ts); the browser asks
// GET /api/auth/role with its Firebase ID token. This is for the UI only: firestore.rules,
// storage.rules and the server routes check admin rights on their own.

import type { User } from "firebase/auth"

export type AdminRole = {
  isAdmin: boolean
  /** True when the answer came from the server (or is certain without asking), so it may be saved to users/{uid} */
  definitive: boolean
}

const roles = new Map<string, boolean>()
const inflight = new Map<string, Promise<AdminRole>>()

/** The server's answer for this uid if it's already known in this tab, else false */
export function cachedIsAdmin(uid: string | null | undefined): boolean {
  return !!uid && roles.get(uid) === true
}

async function askServer(user: User): Promise<boolean | null> {
  try {
    const res = await fetch("/api/auth/role", {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { isAdmin?: unknown }
    return typeof data.isAdmin === "boolean" ? data.isAdmin : null
  } catch {
    return null
  }
}

/**
 * When the role endpoint can't answer, fall back to the user's own users/{uid}.isAdmin: the Firestore
 * rules only let a verified, whitelisted account set it to true.
 */
async function readOwnFlag(uid: string): Promise<boolean> {
  try {
    const [{ doc, getDoc }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
    const snap = await getDoc(doc(db, "users", uid))
    return snap.exists() && snap.data()?.isAdmin === true
  } catch {
    return false
  }
}

/** Resolves the signed-in user's admin role; server answers are cached per uid for the tab's lifetime */
export function resolveAdminRole(user: User): Promise<AdminRole> {
  // Admin rights need a verified email (the rules check email_verified too): no need to ask
  if (!user.email || user.emailVerified !== true) return Promise.resolve({ isAdmin: false, definitive: true })
  const known = roles.get(user.uid)
  if (known !== undefined) return Promise.resolve({ isAdmin: known, definitive: true })
  const pending = inflight.get(user.uid)
  if (pending) return pending

  const run = (async (): Promise<AdminRole> => {
    const answer = await askServer(user)
    if (answer !== null) {
      roles.set(user.uid, answer)
      return { isAdmin: answer, definitive: true }
    }
    return { isAdmin: await readOwnFlag(user.uid), definitive: false }
  })().finally(() => inflight.delete(user.uid))
  inflight.set(user.uid, run)
  return run
}
