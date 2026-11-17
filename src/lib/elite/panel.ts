import type { ArticleStatus } from "@/lib/moderation/types"
import { PANEL_PASS_THRESHOLD, PANEL_SIZE } from "./config"

// The 10-member peer panel and the counter-reason (appeal) workflow, as pure functions.
// The browser store (demo mode) and the Prisma services (src/lib/server) both apply these.

export type PanelDecision = "PASS" | "FAIL"

/** Every vote names the criterion it rests on: the paper's strongest (PASS) or failing (FAIL) dimension */
export const REVIEW_CRITERIA = ["Methodology", "Originality", "Clarity", "Citations"] as const
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number]
export type ReconsiderationStatus = "NONE" | "PENDING" | "ACCEPTED" | "UPHELD"

/** The writer's defense of a FAIL vote or an employee rejection */
export interface CounterReason {
  reason: string
  /** Optional minor clarification to the article, shown to the reviewer */
  clarification?: string
  submittedAt: string
}

export interface Reconsideration {
  status: "ACCEPTED" | "UPHELD"
  note: string
  /** Username of whoever decided it (the dissenting member or a staff panel lead) */
  by: string
  at: string
}

export interface PanelVote {
  id: string
  /** Username of the panel member */
  reviewer: string
  decision: PanelDecision | null
  /** The structured reason behind the vote */
  criterion?: ReviewCriterion
  failureReason?: string
  /** Optional comment on a PASS */
  note?: string
  decidedAt?: string
  /** Set when a FAIL was flipped to PASS on reconsideration */
  originalDecision?: PanelDecision
  counter?: CounterReason
  reconsideration?: Reconsideration
}

/** Counter-reason on an employee review rejection */
export interface EmployeeAppeal {
  counter: CounterReason
  reconsideration?: Reconsideration
}

export function reconsiderationStatus(x: { counter?: CounterReason; reconsideration?: Reconsideration }): ReconsiderationStatus {
  if (!x.counter) return "NONE"
  return x.reconsideration?.status ?? "PENDING"
}

export interface PanelTally {
  pass: number
  fail: number
  pending: number
  total: number
  /** All members have voted */
  complete: boolean
  /** PASS votes meet the threshold */
  consensus: boolean
  /** Counters awaiting a reconsideration verdict */
  openCounters: number
  /** FAIL votes the writer can still appeal */
  appealable: number
}

export function tallyPanel(votes: readonly PanelVote[]): PanelTally {
  const pass = votes.filter((v) => v.decision === "PASS").length
  const fail = votes.filter((v) => v.decision === "FAIL").length
  const pending = votes.length - pass - fail
  return {
    pass,
    fail,
    pending,
    total: votes.length,
    complete: votes.length > 0 && pending === 0,
    consensus: votes.length > 0 && pass >= passThreshold(votes.length),
    openCounters: votes.filter((v) => reconsiderationStatus(v) === "PENDING").length,
    appealable: votes.filter((v) => v.decision === "FAIL" && !v.counter).length,
  }
}

/**
 * Article status implied by the panel. The verdict waits for all ten votes; after that,
 * consensus publishes, an open appeal holds it in COUNTER_SUBMITTED, otherwise it's rejected.
 */
export function panelStatus(votes: readonly PanelVote[]): ArticleStatus {
  const t = tallyPanel(votes)
  if (!t.complete) return "PENDING_PEER_PANEL"
  if (t.consensus) return "PUBLISHED"
  if (t.openCounters > 0) return "COUNTER_SUBMITTED"
  return "REJECTED"
}

/**
 * Votes needed to pass a panel of `size`: 7 of 10 for a full panel, the same 70% share (rounded up)
 * while the panel has fewer approved members than PANEL_SIZE.
 */
export function passThreshold(size: number): number {
  if (size >= PANEL_SIZE) return PANEL_PASS_THRESHOLD
  return Math.max(1, Math.ceil((size * PANEL_PASS_THRESHOLD) / PANEL_SIZE))
}

/** Picks up to PANEL_SIZE distinct reviewers, never the author. Throws when nobody is eligible. */
export function assignPanel(pool: readonly string[], author: string, random: () => number = Math.random): string[] {
  const eligible = [...new Set(pool)].filter((u) => u !== author)
  if (eligible.length === 0) throw new Error("No approved peer reviewers are available yet.")
  // Fisher–Yates shuffle, then take the first PANEL_SIZE
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = eligible[i]
    eligible[i] = eligible[j]
    eligible[j] = tmp
  }
  return eligible.slice(0, PANEL_SIZE)
}

/** A writer may appeal each FAIL vote once, after the panel has finished voting */
export function canCounterVote(vote: PanelVote, status: ArticleStatus) {
  return vote.decision === "FAIL" && !vote.counter && (status === "REJECTED" || status === "COUNTER_SUBMITTED")
}

/** Who may rule on an appeal: the member who cast the FAIL, or staff acting as panel lead */
export function canReconsiderVote(vote: PanelVote, username: string, isStaff: boolean) {
  return reconsiderationStatus(vote) === "PENDING" && (vote.reviewer === username || isStaff)
}

/** Applies a reconsideration verdict to one vote */
export function resolveVote(vote: PanelVote, verdict: "ACCEPT" | "UPHOLD", note: string, by: string, at: string): PanelVote {
  const reconsideration: Reconsideration = { status: verdict === "ACCEPT" ? "ACCEPTED" : "UPHELD", note, by, at }
  return verdict === "ACCEPT"
    ? { ...vote, decision: "PASS", originalDecision: vote.decision ?? "FAIL", reconsideration }
    : { ...vote, reconsideration }
}
