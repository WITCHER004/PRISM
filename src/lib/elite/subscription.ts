import { ELITE_PERIOD_DAYS } from "./config"

export type Tier = "FREE" | "ELITE"
export type SubscriptionStatus = "ACTIVE" | "INACTIVE"

export interface Subscription {
  tier: Tier
  subscriptionStatus: SubscriptionStatus
  subscribedAt?: string
  expiresAt?: string
  /** "mock", "stripe" or "razorpay" */
  provider?: string
  /** Checkout session / payment id from the provider */
  reference?: string
}

export const FREE_SUBSCRIPTION: Subscription = { tier: "FREE", subscriptionStatus: "INACTIVE" }

/** The one check every Elite guard uses: tier ELITE, status ACTIVE, not past expiry */
export function isEliteActive(
  sub: { tier: string; subscriptionStatus: string; expiresAt?: string | Date | null } | null | undefined,
  now = Date.now()
) {
  if (!sub || sub.tier !== "ELITE" || sub.subscriptionStatus !== "ACTIVE") return false
  if (!sub.expiresAt) return true
  return new Date(sub.expiresAt).getTime() > now
}

/** A fresh (or renewed) Elite period starting now */
export function activateElite(provider: string, reference: string, now = new Date()): Subscription {
  const expires = new Date(now.getTime() + ELITE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  return {
    tier: "ELITE",
    subscriptionStatus: "ACTIVE",
    subscribedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    provider,
    reference,
  }
}

/** Features compared on the upgrade page */
export const TIER_FEATURES: { label: string; detail: string; free: boolean; elite: boolean }[] = [
  { label: "Publish articles", detail: "150-word minimum, AI check, employee review", free: true, elite: true },
  { label: "Reader ratings & reviews", detail: "1–5 stars and written reviews on your articles", free: true, elite: true },
  { label: "Share to X, LinkedIn, Instagram, WhatsApp", detail: "One-click share with your handles", free: true, elite: true },
  { label: "Profile, avatar & submission tracker", detail: "Follow every article through review", free: true, elite: true },
  { label: "Earn per view", detail: "Paid on unique views of your published articles", free: false, elite: true },
  { label: "Earnings dashboard & payouts", detail: "Per-article revenue, chart and payout history", free: false, elite: true },
  { label: "10-member peer panel review", detail: "After employee review, a specialist panel votes; counter-reason appeals", free: false, elite: true },
  { label: "Profile badges", detail: "Elite Author, Peer-Reviewed Scholar and more", free: false, elite: true },
]
