"use client"

import { useMemo } from "react"
import { useUIStore } from "@/lib/store"
import { SEED_BADGES } from "@/lib/elite/demo"
import { earnedBadges, visibleBadges, type BadgeId } from "@/lib/elite/badges"
import { HUMAN_VERIFIED_MAX_AI } from "@/lib/elite/config"
import { FREE_SUBSCRIPTION, isEliteActive } from "@/lib/elite/subscription"
import { computeWallet } from "@/lib/elite/wallet"

/** A user's subscription (defaults to the signed-in user) */
export function useSubscription(username?: string | null) {
  const currentUser = useUIStore((s) => s.currentUser)
  const who = username === undefined ? currentUser : username
  const sub = useUIStore((s) => (who ? s.subscriptions[who] : undefined))
  return { username: who, subscription: sub ?? FREE_SUBSCRIPTION, isElite: isEliteActive(sub) }
}

/** Badges to render next to a user's name: empty unless their Elite subscription is active */
export function useBadges(username: string | null | undefined): BadgeId[] {
  const sub = useUIStore((s) => (username ? s.subscriptions[username] : undefined))
  const drafts = useUIStore((s) => s.drafts)
  const views = useUIStore((s) => s.views)
  return useMemo(() => {
    if (!username) return []
    const active = isEliteActive(sub)
    if (!active) return []
    const mine = Object.values(drafts).filter((d) => d.authorUsername === username && d.live)
    let monetizedViews = 0
    for (const v of views) if (v.author === username && v.monetized) monetizedViews++
    const earned = earnedBadges({
      everElite: !!sub?.subscribedAt,
      panelPassed: mine.filter((d) => d.panelPassed).length,
      monetizedViews,
      lowAiPublished: mine.filter((d) => (d.liveAiPercent ?? 100) <= HUMAN_VERIFIED_MAX_AI).length,
    })
    return visibleBadges(active, [...earned, ...(SEED_BADGES[username] ?? [])])
  }, [username, sub, drafts, views])
}

/** The signed-in writer's wallet */
export function useWallet(username: string | null | undefined) {
  const views = useUIStore((s) => s.views)
  const payouts = useUIStore((s) => s.payouts)
  return useMemo(() => computeWallet(username ?? "", views, payouts), [username, views, payouts])
}
