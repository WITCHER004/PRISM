import { db } from "@/lib/db"
import { earnedBadges, visibleBadges, type BadgeId } from "@/lib/elite/badges"
import { HUMAN_VERIFIED_MAX_AI } from "@/lib/elite/config"
import { isEliteActive } from "@/lib/elite/subscription"

/**
 * Recomputes a writer's earned badges from their records and stores any new ones.
 * Badges are never revoked here; display is gated on the subscription (visibleBadgesFor).
 */
export async function awardBadges(userId: string) {
  const [user, panelPassed, lowAiPublished, wallet] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { subscribedAt: true } }),
    db.post.count({ where: { authorId: userId, status: "PUBLISHED", reviewTrack: "PEER_PANEL" } }),
    db.post.count({ where: { authorId: userId, status: "PUBLISHED", aiScore: { lte: HUMAN_VERIFIED_MAX_AI } } }),
    db.writerWallet.findUnique({ where: { userId }, select: { monetizedViews: true } }),
  ])
  if (!user) return
  const earned = earnedBadges({
    everElite: !!user.subscribedAt,
    panelPassed,
    monetizedViews: wallet?.monetizedViews ?? 0,
    lowAiPublished,
  })
  if (!earned.length) return
  await db.userBadge.createMany({ data: earned.map((badge) => ({ userId, badge })), skipDuplicates: true })
}

/** Badges to render for a user: empty unless their Elite subscription is active */
export async function visibleBadgesFor(userId: string): Promise<BadgeId[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tier: true, subscriptionStatus: true, expiresAt: true, badges: { select: { badge: true } } },
  })
  if (!user) return []
  return visibleBadges(
    isEliteActive(user),
    user.badges.map((b) => b.badge)
  )
}
