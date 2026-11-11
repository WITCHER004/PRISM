import type { BadgeId } from "./badges"
import type { Subscription } from "./subscription"

// Demo-mode starting state for the Elite tier (the browser store has no server to ask).

/** Sample accounts that start on Elite */
export const SEED_SUBSCRIPTIONS: Record<string, Subscription> = {
  priyarao: {
    tier: "ELITE",
    subscriptionStatus: "ACTIVE",
    subscribedAt: "2026-08-01T09:00:00.000Z",
    expiresAt: "2027-08-01T09:00:00.000Z",
    provider: "mock",
    reference: "seed_priyarao",
  },
}

/** Badges sample accounts earned before this browser's history began */
export const SEED_BADGES: Record<string, BadgeId[]> = {
  priyarao: ["PEER_REVIEWED_SCHOLAR", "HUMAN_VERIFIED_95"],
}

/** A ~190-word human-voiced draft for testing the submission pipeline end to end */
export const SAMPLE_ARTICLE = {
  title: "What a year of repairing bicycles taught me about software",
  subtitle: "Notes from a borrowed workshop, three flat tyres a week, and one stubborn hub.",
  contentHtml: [
    "<p>I started fixing bikes last spring because my own kept breaking, and the shop down the road had a three-week wait. A neighbour lent me a corner of his garage. He also lent me opinions, mostly about grease.</p>",
    "<p>The first thing I learned is that most failures are boring. A chain skips because it's dirty. A brake squeals because someone touched the rim with oily fingers. I spent my first month hunting for clever explanations and my second month cleaning things, which fixed nearly everything.</p>",
    "<p>Software is like that too, honestly. When our payments service fell over in June, I wanted it to be a race condition. It was a full disk.</p>",
    "<p>The second lesson came from a rear hub that refused to stop clicking. I took it apart four times. On the fifth try my neighbour watched for a minute, said nothing, and handed me a smaller spanner. The cone had been a quarter-turn loose the whole time.</p>",
    "<p>I think about that spanner a lot. Half of debugging is having the right tool and the patience to look at the thing in front of you, instead of the thing you expected to see. The other half, apparently, is grease.</p>",
  ].join(""),
  tags: ["craft"],
}
