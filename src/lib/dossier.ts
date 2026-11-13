// Peer Review Dossier: the public record of a 10-member panel audit on an Elite article.

import { findAccount } from "@/lib/data"
import { PANEL_PASS_THRESHOLD, PANEL_SIZE } from "@/lib/elite/config"
import type { PanelVote } from "@/lib/elite/panel"

export interface DossierCommendation {
  reviewer: string
  text: string
}

export interface DossierDissent {
  reviewer: string
  /** The critical question the reviewer raised */
  question: string
  rebuttal?: { text: string; at: string }
  /** How the reviewer responded to the rebuttal */
  outcome?: { status: "ACCEPTED" | "UPHELD"; note: string }
}

export interface PeerDossier {
  articleId: string
  panelSize: number
  approvals: number
  /** Usernames of the approving reviewers */
  approvedBy: string[]
  decidedAt: string
  commendations: DossierCommendation[]
  dissents: DossierDissent[]
}

export const consensusPercent = (d: PeerDossier) => Math.round((d.approvals / d.panelSize) * 100)
export const PASS_THRESHOLD = PANEL_PASS_THRESHOLD

/** Reviewer name and field, from the panel roster */
export function reviewerInfo(username: string) {
  const u = findAccount(username)
  return {
    name: u?.displayName ?? username,
    avatarUrl: u?.avatarUrl,
    field: u?.bio?.replace(/^Peer panel reviewer · /, "").replace(/\.$/, "") ?? "Peer reviewer",
  }
}

const PANEL = ["drlenaholt", "ravimenon", "ameliaduarte", "kofimensah", "yukisato", "jonasweber", "fatimazahra", "danielokafor", "sofiarossi", "marktran"]
const except = (...out: string[]) => PANEL.filter((u) => !out.includes(u))

/* ── Seeded dossiers on the Elite sample articles ──────────────────────────── */

export const SEED_DOSSIERS: Record<string, PeerDossier> = {
  p1: {
    articleId: "p1",
    panelSize: PANEL_SIZE,
    approvals: 9,
    approvedBy: except("ravimenon"),
    decidedAt: "2024-10-29T16:20:00Z",
    commendations: [
      {
        reviewer: "drlenaholt",
        text: "The failure walkthrough of a partitioned 2PC coordinator is the clearest I've read outside a textbook, and it's grounded in production incidents rather than toy examples.",
      },
      {
        reviewer: "jonasweber",
        text: "Treats idempotency keys and compensation as security boundaries, not just correctness tricks. The replay section would hold up in an audit.",
      },
      {
        reviewer: "danielokafor",
        text: "Frames consistency as a cost the business chooses to carry. That's the argument most engineering writing skips.",
      },
    ],
    dissents: [
      {
        reviewer: "ravimenon",
        question:
          "The 10k-concurrent-payments benchmark reports means only. Without variance or tail latency, how do we know the saga result isn't a single lucky run?",
        rebuttal: {
          text: "Fair. The figures are the median of five runs; I've added p95 and p99 for both approaches and linked the raw timings. Sagas stay ahead at the tail, by a wider margin than at the median.",
          at: "2024-10-28T09:40:00Z",
        },
        outcome: {
          status: "UPHELD",
          note: "The added percentiles help, but five runs is still thin for a headline claim. I'm keeping my vote; the panel passed it regardless.",
        },
      },
    ],
  },
  p2: {
    articleId: "p2",
    panelSize: PANEL_SIZE,
    approvals: 10,
    approvedBy: PANEL,
    decidedAt: "2024-10-27T12:05:00Z",
    commendations: [
      {
        reviewer: "sofiarossi",
        text: "Documents three failed naming systems honestly before the one that worked. The failures are the useful part, and they're written up as carefully as the success.",
      },
      {
        reviewer: "fatimazahra",
        text: "The distinction between descriptive and functional colour names is a genuine linguistic point, applied with care.",
      },
    ],
    dissents: [
      {
        reviewer: "yukisato",
        question: "Does the final scheme hold up for designers outside your team, or only for the people who invented it?",
        rebuttal: {
          text: "Two other teams adopted it without us in the room; I've added what they renamed in the first month and why. Both kept the structure.",
          at: "2024-10-26T15:10:00Z",
        },
        outcome: { status: "ACCEPTED", note: "The adoption notes answer it. Changed my vote to pass." },
      },
    ],
  },
  p4: {
    articleId: "p4",
    panelSize: PANEL_SIZE,
    approvals: 8,
    approvedBy: except("kofimensah", "danielokafor"),
    decidedAt: "2024-10-21T18:45:00Z",
    commendations: [
      {
        reviewer: "ameliaduarte",
        text: "Gets the ice-core science right, including the gas-age versus ice-age offset that most coverage gets wrong.",
      },
      {
        reviewer: "marktran",
        text: "Every figure traces to a primary dataset, and the piece is honest about where the record stops being able to answer.",
      },
      {
        reviewer: "ravimenon",
        text: "Careful with uncertainty: ranges are reported as ranges, not collapsed into a single alarming number.",
      },
    ],
    dissents: [
      {
        reviewer: "kofimensah",
        question:
          "The closing section moves from what the cores show to what policy should do. Is that still reporting, or advocacy the evidence doesn't carry?",
        rebuttal: {
          text: "I've separated the two: the evidence section now ends before the policy discussion, which is labelled as my view and cites the IPCC working-group reports it draws on.",
          at: "2024-10-20T10:30:00Z",
        },
        outcome: { status: "ACCEPTED", note: "Clear separation now. My concern is resolved, though my original vote stands on the record." },
      },
      {
        reviewer: "danielokafor",
        question: "The cost estimates for delayed action come from a single model family. Were others considered?",
      },
    ],
  },
}

/* ── From a real panel (drafts in this browser) ────────────────────────────── */

/** Build a dossier from a draft's panel votes; null until the panel has decided */
export function dossierFromPanel(articleId: string, votes: readonly PanelVote[] | undefined, decidedAt?: string): PeerDossier | null {
  if (!votes?.length || votes.some((v) => !v.decision)) return null
  const approvedBy = votes.filter((v) => v.decision === "PASS").map((v) => v.reviewer)
  const dissents: DossierDissent[] = votes
    .filter((v) => v.failureReason || v.counter)
    .map((v) => ({
      reviewer: v.reviewer,
      question: v.failureReason ?? "Voted to fail.",
      rebuttal: v.counter ? { text: v.counter.reason, at: v.counter.submittedAt } : undefined,
      outcome: v.reconsideration ? { status: v.reconsideration.status, note: v.reconsideration.note } : undefined,
    }))
  return {
    articleId,
    panelSize: votes.length,
    approvals: approvedBy.length,
    approvedBy,
    decidedAt: decidedAt ?? votes.map((v) => v.decidedAt ?? "").sort().pop() ?? new Date().toISOString(),
    // Panel members vote without written praise; the dossier lists who approved instead
    commendations: [],
    dissents,
  }
}
