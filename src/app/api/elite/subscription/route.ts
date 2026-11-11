import { apiRoute } from "@/lib/server/api"
import { visibleBadgesFor } from "@/lib/server/badges"
import { deactivateSubscription } from "@/lib/server/subscriptions"
import { isEliteActive } from "@/lib/elite/subscription"

// GET /api/elite/subscription — the signed-in user's tier and displayable badges
export async function GET() {
  return apiRoute(async (user) => ({
    tier: user.tier,
    subscriptionStatus: user.subscriptionStatus,
    subscribedAt: user.subscribedAt,
    expiresAt: user.expiresAt,
    isElite: isEliteActive(user),
    badges: await visibleBadgesFor(user.id),
  }))
}

// DELETE /api/elite/subscription — cancel; paid features lock and badges hide
export async function DELETE() {
  return apiRoute(async (user) => {
    await deactivateSubscription(user.id)
    return { subscriptionStatus: "INACTIVE" }
  })
}
