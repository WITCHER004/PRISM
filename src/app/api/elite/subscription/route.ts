import { apiRoute } from "@/lib/server/api"
import { visibleBadgesFor } from "@/lib/server/badges"
import { cancelSubscriptionAtPeriodEnd, resumeSubscription } from "@/lib/server/subscriptions"
import { isEliteActive } from "@/lib/elite/subscription"

// GET /api/elite/subscription — the signed-in user's tier and displayable badges
export async function GET() {
  return apiRoute(async (user) => ({
    tier: user.tier,
    subscriptionStatus: user.subscriptionStatus,
    subscribedAt: user.subscribedAt,
    expiresAt: user.expiresAt,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    isElite: isEliteActive(user),
    badges: await visibleBadgesFor(user.id),
  }))
}

// DELETE /api/elite/subscription — cancel; Elite stays active until the paid period ends
export async function DELETE() {
  return apiRoute((user) => cancelSubscriptionAtPeriodEnd(user.id))
}

// PATCH /api/elite/subscription — undo a pending cancellation
export async function PATCH() {
  return apiRoute(async (user) => {
    await resumeSubscription(user.id)
    return { cancelAtPeriodEnd: false }
  })
}
