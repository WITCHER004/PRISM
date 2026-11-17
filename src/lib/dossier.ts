// Peer Review Dossier: the public record of a 10-member panel audit on an Elite article.

import { findAccount } from "@/lib/data"
import { PANEL_PASS_THRESHOLD } from "@/lib/elite/config"
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

/** Reviewer name and field, from the live user directory */
export function reviewerInfo(username: string) {
  const u = findAccount(username)
  return {
    name: u?.displayName ?? username,
    avatarUrl: u?.avatarUrl,
    field: u?.bio?.split(/[.\n]/)[0]?.trim() || "Peer reviewer",
  }
}

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
