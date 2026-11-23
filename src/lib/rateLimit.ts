import type { Firestore, WriteBatch } from "firebase/firestore"

// Posting cooldowns. The Firestore rules enforce these (see `throttled()` in firestore.rules): every
// throttled write stamps rate_limits/{uid}.{action} with the server time in the same batch, and the
// rules reject it if the previous stamp is newer than the cooldown. Keep both tables in step.
export type RateAction = "forum_thread" | "forum_reply" | "idea" | "comment" | "margin_note"

export const COOLDOWN_SECONDS: Record<RateAction, number> = {
  forum_thread: 60,
  forum_reply: 10,
  idea: 30,
  comment: 10,
  margin_note: 5,
}

type FirestoreFns = Pick<typeof import("firebase/firestore"), "doc" | "serverTimestamp">

/** Adds the rate-limit stamp the rules require to a batch that creates a throttled document */
export function stampRateLimit(fs: FirestoreFns, batch: WriteBatch, db: Firestore, uid: string, action: RateAction) {
  batch.set(fs.doc(db, "rate_limits", uid), { [action]: fs.serverTimestamp() }, { merge: true })
}

// Client-side mirror, so people get a clear message instead of a refused write
const lastPost = new Map<RateAction, number>()

/** A friendly "slow down" message if this action is still cooling down, else null */
export function cooldownMessage(action: RateAction): string | null {
  const last = lastPost.get(action)
  if (!last) return null
  const left = Math.ceil((last + COOLDOWN_SECONDS[action] * 1000 - Date.now()) / 1000)
  return left > 0 ? `You're posting quickly. Try again in ${left} second${left === 1 ? "" : "s"}.` : null
}

export function markPosted(action: RateAction) {
  lastPost.set(action, Date.now())
}
