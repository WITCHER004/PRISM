import "server-only"
import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore"
import { COL } from "@/lib/live/schema"
import {
  ARTICLE_BODIES,
  ARTICLE_UNLOCKS,
  FREE_METERED_PER_MONTH,
  isLocked,
  isPubliclyPublished,
  meterKey,
  PUBLIC_ARTICLES,
  publicCopyOf,
  READER_METERS,
} from "@/lib/paywall"
import { renderArticleHtml } from "@/lib/articleHtml"
import { mockPaymentsAllowed } from "@/lib/server/subscriptions"

// Server side of the paywall (audit F-02). Readers never get a locked story's text from Firestore:
// they read public_articles/{id} (preview only), and the full body comes from article_bodies/{id}
// through readerAccess() once the reader is entitled to it.

type Doc = Record<string, unknown>

/**
 * Keep an article's public copy and server-only body in step with articles/{id}. Call inside the same
 * transaction that writes the article, with the document as it will stand after the write.
 */
export function syncPublicCopy(tx: Transaction, db: Firestore, id: string, full: Doc) {
  const publicRef = db.collection(PUBLIC_ARTICLES).doc(id)
  const bodyRef = db.collection(ARTICLE_BODIES).doc(id)
  if (!isPubliclyPublished(full)) {
    tx.delete(publicRef)
    tx.delete(bodyRef)
    return
  }
  const { copy, body } = publicCopyOf(full)
  // Whole top-level fields are replaced (mergeFields), so nothing stale survives inside `live`; the copy's
  // own counters (views, likes) are not listed, so a republish keeps them
  const data: Doc = { ...copy, submitted: FieldValue.delete(), review: FieldValue.delete(), rebuttal: FieldValue.delete() }
  tx.set(publicRef, data, { mergeFields: Object.keys(data) })
  if (body) tx.set(bodyRef, { ...body, updatedAt: Date.now() })
}

export type AccessResult =
  | { ok: true; html: string; via: "free" | "author" | "staff" | "elite" | "unlock" }
  | { ok: false; status: 401 | 402 | 403 | 404; reason: string }

async function isElite(db: Firestore, uid: string) {
  const u = await db.collection(COL.users).doc(uid).get()
  return u.exists && u.data()!.tier === "elite" && u.data()!.suspended !== true
}

/** May this reader see the whole story? Returns the rendered (sanitised) body when they may. */
export async function readerAccess(db: Firestore, id: string, caller: { uid: string; isAdmin: boolean } | null): Promise<AccessResult> {
  const [pub, body] = await Promise.all([db.collection(PUBLIC_ARTICLES).doc(id).get(), db.collection(ARTICLE_BODIES).doc(id).get()])
  if (!pub.exists || !body.exists) return { ok: false, status: 404, reason: "Story not found." }
  const b = body.data() as { contentHtml: string; paywall: string; paper: boolean; authorId: string }
  const html = () => renderArticleHtml(b.contentHtml).html
  if (!isLocked({ paywall: b.paywall, paper: b.paper })) return { ok: true, html: html(), via: "free" }
  if (!caller) return { ok: false, status: 401, reason: "Sign in to keep reading." }
  if (caller.uid === b.authorId) return { ok: true, html: html(), via: "author" }
  if (caller.isAdmin) return { ok: true, html: html(), via: "staff" }
  if (await isElite(db, caller.uid)) return { ok: true, html: html(), via: "elite" }
  // Advanced Papers and member-only stories are Elite-only
  if (b.paper || b.paywall === "SUBSCRIBER") return { ok: false, status: 403, reason: "This story is for Elite members." }
  const unlock = await db.collection(ARTICLE_UNLOCKS).doc(`${caller.uid}_${id}`).get()
  if (unlock.exists) return { ok: true, html: html(), via: "unlock" }
  return { ok: false, status: 402, reason: b.paywall === "PAID" ? "Unlock this story to keep reading." : "Use one of your free stories to keep reading." }
}

export type UnlockMethod = "meter" | "share" | "purchase"

/**
 * Records that a reader unlocked a story. Metered stories take one of the month's free reads (or a
 * share); paid stories need a confirmed purchase, which only exists with mock payments outside
 * production until a real payment provider is wired up.
 */
export async function unlockStory(db: Firestore, id: string, uid: string, method: UnlockMethod): Promise<{ ok: true; remaining?: number } | { ok: false; status: number; reason: string }> {
  const body = await db.collection(ARTICLE_BODIES).doc(id).get()
  if (!body.exists) return { ok: false, status: 404, reason: "Story not found." }
  const b = body.data() as { paywall: string; paper: boolean }
  if (b.paper || b.paywall === "SUBSCRIBER") return { ok: false, status: 403, reason: "This story is for Elite members." }
  if (b.paywall === "FREE") return { ok: true }
  const unlockRef = db.collection(ARTICLE_UNLOCKS).doc(`${uid}_${id}`)

  if (b.paywall === "PAID") {
    if (method !== "purchase") return { ok: false, status: 400, reason: "This story is unlocked with a one-time payment." }
    if (!mockPaymentsAllowed()) return { ok: false, status: 402, reason: "One-time unlocks aren't available yet." }
    await unlockRef.set({ uid, articleId: id, method, at: Date.now() })
    return { ok: true }
  }

  // METERED
  if (method === "share") {
    await unlockRef.set({ uid, articleId: id, method, at: Date.now() })
    return { ok: true }
  }
  if (method !== "meter") return { ok: false, status: 400, reason: "Use a free story or share it to keep reading." }
  const meterRef = db.collection(READER_METERS).doc(meterKey(uid))
  return db.runTransaction(async (tx) => {
    const [meter, existing] = await Promise.all([tx.get(meterRef), tx.get(unlockRef)])
    if (existing.exists) return { ok: true as const }
    const used = meter.exists ? Number(meter.data()!.count ?? 0) : 0
    if (used >= FREE_METERED_PER_MONTH)
      return { ok: false as const, status: 402, reason: `You've read your ${FREE_METERED_PER_MONTH} free stories this month. Share this one or go Elite to keep reading.` }
    tx.set(meterRef, { uid, month: meterKey(uid).slice(-7), count: used + 1 }, { merge: true })
    tx.set(unlockRef, { uid, articleId: id, method, at: Date.now() })
    return { ok: true as const, remaining: FREE_METERED_PER_MONTH - used - 1 }
  })
}
