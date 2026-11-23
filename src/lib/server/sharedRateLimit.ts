import "server-only"
import { createHash } from "node:crypto"
import { Timestamp } from "firebase-admin/firestore"
import { adminConfigured, adminDb } from "@/lib/server/firebaseAdmin"
import { checkKeyLimit, type RateResult } from "@/lib/server/rateLimit"

// A rate limit that holds across every server instance: fixed-window counters in Firestore
// (rate_buckets/{sha256(key)}), updated in a transaction. Clients can't read or write that collection.
// Keys are hashed, so no IP or email is stored. Set a TTL policy on rate_buckets.expireAt in the
// Firebase console so old windows clean themselves up.
// Without admin credentials it falls back to the per-instance in-memory limiter.

const hash = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 40)

export async function sharedRateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  // The in-memory check runs first: it's free and stops floods before they cost Firestore writes
  const local = checkKeyLimit(`shared|${key}`, limit, windowMs)
  if (!local.ok || !adminConfigured()) return local
  try {
    const ref = adminDb().collection("rate_buckets").doc(hash(key))
    return await adminDb().runTransaction(async (tx) => {
      const now = Date.now()
      const snap = await tx.get(ref)
      const d = snap.data() as { count?: number; resetAt?: number } | undefined
      const fresh = !d || !d.resetAt || d.resetAt <= now
      const count = (fresh ? 0 : d!.count ?? 0) + 1
      const resetAt = fresh ? now + windowMs : d!.resetAt!
      tx.set(ref, { count, resetAt, expireAt: Timestamp.fromMillis(resetAt + 60_000) })
      return count > limit
        ? { ok: false as const, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)), limit }
        : { ok: true as const, remaining: limit - count, limit }
    })
  } catch (err) {
    // Never lock people out because the limiter itself failed
    console.error("[rate-limit] shared limiter unavailable", err)
    return local
  }
}

/** Stable, non-reversible id for an email or IP inside rate-limit keys */
export const fingerprint = (value: string) => hash(value.trim().toLowerCase())
