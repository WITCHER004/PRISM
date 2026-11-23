// Handle registry: handles/{handle} = { uid }. A handle is someone's only when its registry entry is
// theirs, and the Firestore rules refuse a profile whose handle isn't registered to its owner, so two
// people can never end up at the same /{handle} URL. Claiming and pointing the profile at the handle
// happen in one batch; if someone else got there first, the batch fails and the next candidate is tried.

const fs = () => Promise.all([import("firebase/firestore"), import("@/lib/firebase")])

export const HANDLE_RE = /^[a-z0-9_]{1,40}$/

type UserWrite = { data: Record<string, unknown>; merge: boolean }

/**
 * Writes users/{uid} (with `handle` set) together with the registry entry, trying `base`, base2, base3…
 * Releases `previous` if the user owned it. Resolves to the handle that was claimed.
 */
export async function claimHandle(uid: string, base: string, write: UserWrite, previous?: string | null): Promise<string> {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "member"
  for (let n = 1; n <= 20; n++) {
    const candidate = n === 1 ? clean : `${clean.slice(0, 17)}${n}`
    if (await tryHandle(uid, candidate, write, previous)) return candidate
  }
  const fallback = `${clean.slice(0, 12)}${uid.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "")}`
  if (await tryHandle(uid, fallback, write, previous)) return fallback
  throw new Error("Couldn't find a free handle.")
}

/** Claims exactly `handle` (a person's chosen username). False when someone else has it. */
export async function tryHandle(uid: string, handle: string, write: UserWrite, previous?: string | null): Promise<boolean> {
  if (!HANDLE_RE.test(handle)) return false
  const [{ doc, getDoc, serverTimestamp, writeBatch }, { db }] = await fs()
  const reg = await getDoc(doc(db, "handles", handle))
  if (reg.exists() && reg.data().uid !== uid) return false
  const batch = writeBatch(db)
  if (!reg.exists()) batch.set(doc(db, "handles", handle), { uid, createdAt: serverTimestamp() })
  batch.set(doc(db, "users", uid), { ...write.data, handle }, write.merge ? { merge: true } : {})
  if (previous && previous !== handle) batch.delete(doc(db, "handles", previous))
  try {
    await batch.commit()
    return true
  } catch {
    // Raced with someone else (or the old handle wasn't ours to release): retry without releasing
    if (!previous) return false
    return tryHandle(uid, handle, write, null)
  }
}

/** Members who joined before the registry: register the handle they already use (no-op if done) */
export async function ensureHandleRegistered(uid: string, handle: string): Promise<void> {
  if (!HANDLE_RE.test(handle)) return
  try {
    const [{ doc, getDoc, setDoc, serverTimestamp }, { db }] = await fs()
    const reg = await getDoc(doc(db, "handles", handle))
    if (reg.exists()) {
      if (reg.data().uid !== uid) console.warn(`[handles] @${handle} is registered to another account; staff need to resolve the duplicate`)
      return
    }
    await setDoc(doc(db, "handles", handle), { uid, createdAt: serverTimestamp() })
  } catch (err) {
    console.warn("[handles] couldn't register your handle", err)
  }
}
