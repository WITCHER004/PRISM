import { createHmac, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import { ELITE_PRICE_USD } from "@/lib/elite/config"
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

export async function createCheckout(user: SessionUser) {
  const provider = paymentProvider()
  const reference = `${provider}_${user.id}_${Date.now().toString(36)}`
  if (provider === "mock") {
    await activateSubscription(user.id, "mock", reference)
    return { provider, reference, amount: ELITE_PRICE_USD, currency: "USD", status: "complete" as const }
  }
  // Stripe: stripe.checkout.sessions.create({ mode: "subscription", client_reference_id: user.id, ... })
  // Razorpay: razorpay.subscriptions.create({ plan_id, notes: { userId: user.id } })
  // Return the session/subscription id for the client to redirect or open the provider modal.
  return { provider, reference, amount: ELITE_PRICE_USD, currency: "USD", status: "requires_payment" as const }
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
    },
  })
  await awardBadges(userId)
}

/** Cancels at once: paid features lock and badges stop displaying (they're kept for renewal) */
export async function deactivateSubscription(userId: string) {
  await db.user.update({ where: { id: userId }, data: { subscriptionStatus: "INACTIVE" } })
}

export function verifyWebhookSignature(provider: PaymentProvider, rawBody: string, headers: Headers) {
  const secret = process.env.ELITE_WEBHOOK_SECRET
  if (provider === "mock") return true
  if (!secret) throw new ActionError("ELITE_WEBHOOK_SECRET is not configured.", 500)
  if (provider === "razorpay") {
    // Razorpay: hex HMAC-SHA256 of the raw body in x-razorpay-signature
    const sig = headers.get("x-razorpay-signature") ?? ""
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
    return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  }
  // Stripe: "t=<ts>,v1=<hmac>" over `${t}.${rawBody}`
  const header = headers.get("stripe-signature") ?? ""
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]))
  if (!parts.t || !parts.v1) return false
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex")
  return parts.v1.length === expected.length && timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected))
}
