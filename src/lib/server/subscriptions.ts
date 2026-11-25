import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import { ELITE_PRICE_INR } from "@/lib/elite/config"
import { activateElite } from "@/lib/elite/subscription"
import { ActionError } from "@/lib/session"
import type { SessionUser } from "./api"
import { awardBadges } from "./badges"

// Elite checkout. The provider is chosen by ELITE_PAYMENT_PROVIDER: "mock" (default),
// "stripe" or "razorpay". Mock completes instantly so every paid feature can be tested;
// the real providers create a checkout session here and activate from their webhook.

export type PaymentProvider = "mock" | "stripe" | "razorpay"

export function paymentProvider(): PaymentProvider {
  const p = process.env.ELITE_PAYMENT_PROVIDER
  return p === "stripe" || p === "razorpay" ? p : "mock"
}

/**
 * Mock payments activate Elite without taking money. They are for local development only: in
 * production they need an explicit ELITE_ALLOW_MOCK_CHECKOUT=true (audit finding F-01), so a missing
 * or misspelled ELITE_PAYMENT_PROVIDER fails closed instead of handing out free subscriptions.
 */
export function mockPaymentsAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ELITE_ALLOW_MOCK_CHECKOUT === "true"
}

export async function createCheckout(user: SessionUser) {
  const provider = paymentProvider()
  if (provider === "mock" && !mockPaymentsAllowed()) {
    console.error("[elite] checkout refused: ELITE_PAYMENT_PROVIDER is not set to stripe or razorpay in production")
    throw new ActionError("Elite checkout is unavailable right now. Try again later.", 503)
  }
  const reference = `${provider}_${user.id}_${Date.now().toString(36)}`
  if (provider === "mock") {
    await activateSubscription(user.id, "mock", reference)
    return { provider, reference, amount: ELITE_PRICE_INR, currency: "INR", status: "complete" as const }
  }
  // Stripe: stripe.checkout.sessions.create({ mode: "subscription", client_reference_id: user.id, ... })
  // Razorpay: razorpay.subscriptions.create({ plan_id, notes: { userId: user.id } })
  // Return the session/subscription id for the client to redirect or open the provider modal.
  return { provider, reference, amount: ELITE_PRICE_INR, currency: "INR", status: "requires_payment" as const }
}

/** Idempotent: a webhook delivered twice for the same reference is a no-op */
export async function activateSubscription(userId: string, provider: PaymentProvider, reference: string) {
  const existing = await db.user.findFirst({ where: { id: userId, subscriptionRef: reference }, select: { id: true } })
  if (existing) return
  const sub = activateElite(provider, reference)
  await db.user.update({
    where: { id: userId },
    data: {
      tier: "ELITE",
      subscriptionStatus: "ACTIVE",
      subscribedAt: new Date(sub.subscribedAt!),
      expiresAt: new Date(sub.expiresAt!),
      subscriptionProvider: provider,
      subscriptionRef: reference,
      cancelAtPeriodEnd: false,
    },
  })
  await awardBadges(userId)
}

/**
 * User-initiated cancel: Elite stays active until expiresAt and then lapses (isEliteActive checks the
 * date). With no paid period left, it ends at once. Real providers also need their own cancel-at-period-end
 * call here once checkout is wired up (Stripe: subscriptions.update({ cancel_at_period_end: true })).
 */
export async function cancelSubscriptionAtPeriodEnd(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { expiresAt: true } })
  if (user?.expiresAt && user.expiresAt.getTime() > Date.now()) {
    await db.user.update({ where: { id: userId }, data: { cancelAtPeriodEnd: true } })
    return { cancelAtPeriodEnd: true, expiresAt: user.expiresAt }
  }
  await deactivateSubscription(userId)
  return { cancelAtPeriodEnd: false, expiresAt: user?.expiresAt ?? null }
}

/** Undoes a pending cancellation while the period is still running */
export async function resumeSubscription(userId: string) {
  await db.user.update({ where: { id: userId }, data: { cancelAtPeriodEnd: false } })
}

/** Ends at once: paid features lock and badges stop displaying (they're kept for renewal). The provider
 * webhook calls this when a subscription has actually ended. */
export async function deactivateSubscription(userId: string) {
  await db.user.update({ where: { id: userId }, data: { subscriptionStatus: "INACTIVE" } })
}

/** Stripe's default tolerance: a signed event older (or newer) than this is treated as a replay */
export const WEBHOOK_TOLERANCE_SEC = 300

const safeEqualHex = (a: string, b: string) => {
  if (a.length !== b.length || !/^[0-9a-f]+$/i.test(a)) return false
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
}

/**
 * Verifies a provider webhook (audit F-08, F-19).
 * - stripe: `stripe-signature: t=<unix>,v1=<hex>[,v1=<hex>...]`, HMAC over `${t}.${rawBody}`. Any v1 may
 *   match (Stripe sends several during secret rotation) and t must be within WEBHOOK_TOLERANCE_SEC of now.
 * - razorpay: hex HMAC of the raw body in x-razorpay-signature. The scheme has no signed timestamp, so
 *   replays are handled by event-id dedupe in the route plus the reference-based idempotency below.
 * - mock: `x-prism-signature: hex(hmac_sha256(ELITE_WEBHOOK_SECRET, rawBody))`. Unsigned mock events
 *   pass only when NODE_ENV === "development" and no secret is configured.
 */
export function verifyWebhookSignature(provider: PaymentProvider, rawBody: string, headers: Headers, nowMs = Date.now()) {
  const secret = process.env.ELITE_WEBHOOK_SECRET
  if (provider === "mock") {
    if (!secret) return process.env.NODE_ENV === "development"
    const sig = (headers.get("x-prism-signature") ?? "").trim().toLowerCase()
    return safeEqualHex(sig, createHmac("sha256", secret).update(rawBody).digest("hex"))
  }
  if (!secret) throw new ActionError("ELITE_WEBHOOK_SECRET is not configured.", 500)
  if (provider === "razorpay") {
    const sig = (headers.get("x-razorpay-signature") ?? "").trim().toLowerCase()
    return safeEqualHex(sig, createHmac("sha256", secret).update(rawBody).digest("hex"))
  }
  // Stripe
  const header = headers.get("stripe-signature") ?? ""
  let t = ""
  const v1: string[] = []
  for (const item of header.split(",")) {
    const i = item.indexOf("=")
    if (i < 0) continue
    const k = item.slice(0, i).trim()
    const v = item.slice(i + 1).trim()
    if (k === "t") t = v
    else if (k === "v1") v1.push(v.toLowerCase())
  }
  if (!/^\d{1,12}$/.test(t) || v1.length === 0 || v1.length > 8) return false
  const ageSec = Math.floor(nowMs / 1000) - Number(t)
  if (Math.abs(ageSec) > WEBHOOK_TOLERANCE_SEC) return false
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")
  // Check every candidate (no early exit) so timing doesn't reveal which one matched
  let ok = false
  for (const sig of v1) ok = safeEqualHex(sig, expected) || ok
  return ok
}

// Event-id dedupe for webhook retries/replays. In process only (per instance, bounded): there is no
// processed-events table, so cross-instance replays fall back to activateSubscription's reference check
// and settlePayout's PENDING-only transition, which make those handlers idempotent anyway.
const SEEN_MAX = 5000
const seenEvents = new Map<string, number>()

/** True the first time an event id is seen (and records it); false for a duplicate */
export function markEventProcessed(eventId: string): boolean {
  if (seenEvents.has(eventId)) return false
  seenEvents.set(eventId, Date.now())
  if (seenEvents.size > SEEN_MAX) {
    const oldest = seenEvents.keys().next().value
    if (oldest !== undefined) seenEvents.delete(oldest)
  }
  return true
}

/** Undo markEventProcessed when handling failed, so the provider's retry is processed */
export function forgetEvent(eventId: string) {
  seenEvents.delete(eventId)
}
