import { HUMAN_VERIFIED_ARTICLES, HUMAN_VERIFIED_MAX_AI, TOP_MONETIZED_VIEWS } from "./config"

// Paid-only badges. Earned badges are only *displayed* while the subscription is active,
// so a lapsed Elite member's badges disappear and come back on renewal.

export type BadgeId = "ELITE_AUTHOR" | "PEER_REVIEWED_SCHOLAR" | "TOP_MONETIZED_WRITER" | "HUMAN_VERIFIED_95"

export const BADGE_ORDER: BadgeId[] = ["ELITE_AUTHOR", "PEER_REVIEWED_SCHOLAR", "TOP_MONETIZED_WRITER", "HUMAN_VERIFIED_95"]

export const BADGES: Record<BadgeId, { label: string; howEarned: string; tone: "indigo" | "emerald" | "blue" | "violet" }> = {
  ELITE_AUTHOR: {
    label: "Elite Author",
    howEarned: "Unlocked by upgrading to the Elite tier.",
    tone: "indigo",
  },
  PEER_REVIEWED_SCHOLAR: {
    label: "Peer-Reviewed Scholar",
    howEarned: "An article passed the 10-member peer panel (including after a successful counter-reason).",
    tone: "emerald",
  },
  TOP_MONETIZED_WRITER: {
    label: "Top Monetized Writer",
    howEarned: `Crossed ${TOP_MONETIZED_VIEWS.toLocaleString("en-US")} monetized views.`,
    tone: "blue",
  },
  HUMAN_VERIFIED_95: {
    label: "Human Verified 95%+",
    howEarned: `Published ${HUMAN_VERIFIED_ARTICLES}+ articles that scored ${HUMAN_VERIFIED_MAX_AI}% AI or less.`,
    tone: "violet",
  },
}

export interface BadgeFacts {
  /** Has held Elite at some point (Elite Author is unlocked on upgrade) */
  everElite: boolean
  /** Articles published through the peer panel */
  panelPassed: number
  monetizedViews: number
  /** Published articles with a Phase 1 AI score ≤ HUMAN_VERIFIED_MAX_AI */
  lowAiPublished: number
}

/** Badges a user has earned from their activity (whether or not they can display them) */
export function earnedBadges(facts: BadgeFacts): BadgeId[] {
  const out: BadgeId[] = []
  if (facts.everElite) out.push("ELITE_AUTHOR")
  if (facts.panelPassed > 0) out.push("PEER_REVIEWED_SCHOLAR")
  if (facts.monetizedViews >= TOP_MONETIZED_VIEWS) out.push("TOP_MONETIZED_WRITER")
  if (facts.lowAiPublished >= HUMAN_VERIFIED_ARTICLES) out.push("HUMAN_VERIFIED_95")
  return out
}

/** What to render next to a name: nothing unless Elite is active */
export function visibleBadges(eliteActive: boolean, earned: readonly BadgeId[]): BadgeId[] {
  if (!eliteActive) return []
  const set = new Set<BadgeId>(["ELITE_AUTHOR", ...earned])
  return BADGE_ORDER.filter((b) => set.has(b))
}
