import type { ArticleStatus, ReviewTrack } from "./types"

// The publishing rules: an article needs at least 150 words, may be at most 20% AI-generated
// (≥ 80% human-written), and at most 15% of its prose may match an existing source.
export const AI_MAX_PERCENT = 20
export const PLAGIARISM_MAX_PERCENT = 15
/**
 * AI scores above the limit but at most this go to an employee for manual review instead of failing.
 * Chosen from the benchmark (ai_plagiarism_engine/benchmarks/REPORT.md): the genuine human writing the
 * detector still misreads (non-native English, dense technical abstracts) mostly scores 20–60, while
 * 84% of AI text scores above 60. Plagiarism has no such band.
 */
export const MANUAL_REVIEW_MAX_AI = 60
/** AI scores in this band are "borderline": Proof-of-Craft telemetry may nudge them (see analyzer.ts) */
export const BORDERLINE_AI: readonly [number, number] = [18, 25]
export const MIN_WORDS_FOR_SUBMISSION = 150
/** Marks a voice post whose short show notes skipped the AI-content gate (shown to the author as such) */
export const VOICE_SKIP_PROVIDER = "voice post · text check skipped (short show notes)"

/**
 * Allowed status transitions. Every article goes AI check → employee review.
 * Elite articles then also go to the 10-member peer panel before they publish.
 *
 *   DRAFT → PHASE_1_FAILED | PENDING_EMPLOYEE_REVIEW
 *   PENDING_EMPLOYEE_REVIEW → PUBLISHED (Free) | PENDING_PEER_PANEL (Elite) | REJECTED
 *   PENDING_PEER_PANEL → PUBLISHED (consensus) | REJECTED (no consensus)
 *   REJECTED → COUNTER_SUBMITTED (writer appeals) → PUBLISHED | PENDING_PEER_PANEL | REJECTED | COUNTER_SUBMITTED
 */
const TRANSITIONS: Record<ArticleStatus, readonly ArticleStatus[]> = {
  DRAFT: ["PHASE_1_FAILED", "PENDING_EMPLOYEE_REVIEW"],
  PHASE_1_FAILED: ["PHASE_1_FAILED", "PENDING_EMPLOYEE_REVIEW", "DRAFT"],
  PENDING_EMPLOYEE_REVIEW: ["PUBLISHED", "PENDING_PEER_PANEL", "REJECTED", "DRAFT"], // DRAFT = author withdraws
  PENDING_PEER_PANEL: ["PUBLISHED", "REJECTED", "DRAFT"],
  // An accepted appeal of an Elite employee rejection moves on to the panel
  COUNTER_SUBMITTED: ["PUBLISHED", "PENDING_PEER_PANEL", "REJECTED", "COUNTER_SUBMITTED"],
  // A published article's revision goes back through every phase; the approved version stays live meanwhile
  PUBLISHED: ["PHASE_1_FAILED", "PENDING_EMPLOYEE_REVIEW"],
  REJECTED: ["PHASE_1_FAILED", "PENDING_EMPLOYEE_REVIEW", "COUNTER_SUBMITTED", "DRAFT"],
}

export function canTransition(from: ArticleStatus, to: ArticleStatus) {
  return TRANSITIONS[from].includes(to)
}

export type Phase1Decision = "PASS" | "MANUAL_REVIEW" | "FAIL"

/** AI ≤ 20 and plagiarism ≤ 15 pass; AI 20–60 goes to manual review; above that, or plagiarism > 15, fails */
export function phase1Decision(aiPercent: number, plagiarismScore = 0): Phase1Decision {
  if (plagiarismScore > PLAGIARISM_MAX_PERCENT || aiPercent > MANUAL_REVIEW_MAX_AI) return "FAIL"
  return aiPercent > AI_MAX_PERCENT ? "MANUAL_REVIEW" : "PASS"
}

/** Phase 1 outcome → next status. Passing and manual-review articles both go to an employee first. */
export function phase1Outcome(report: { aiPercent: number; plagiarismScore?: number }): ArticleStatus {
  return phase1Decision(report.aiPercent, report.plagiarismScore) === "FAIL" ? "PHASE_1_FAILED" : "PENDING_EMPLOYEE_REVIEW"
}

/** Review route by plan: Free = AI → employee; Elite = AI → employee → 10-member peer panel */
export function trackFor(eliteActive: boolean): ReviewTrack {
  return eliteActive ? "PEER_PANEL" : "EMPLOYEE"
}

/** Where an article goes once an employee approves it */
export function afterEmployeeApproval(track: ReviewTrack | null | undefined): ArticleStatus {
  return track === "PEER_PANEL" ? "PENDING_PEER_PANEL" : "PUBLISHED"
}

/** Statuses from which an author can (re)submit */
export function canSubmit(status: ArticleStatus) {
  return canTransition(status, "PENDING_EMPLOYEE_REVIEW")
}

/** Statuses where the submission is with reviewers and the editor is read-only */
export function isUnderReview(status: ArticleStatus) {
  return status === "PENDING_EMPLOYEE_REVIEW" || status === "PENDING_PEER_PANEL" || status === "COUNTER_SUBMITTED"
}

/** Roles allowed to work the Phase 2 employee queue and act as peer-panel lead */
export const REVIEWER_ROLES = ["EMPLOYEE", "REVIEWER", "ADMIN"] as const
export function canReview(role: string | null | undefined) {
  return !!role && (REVIEWER_ROLES as readonly string[]).includes(role)
}

/** Peer-panel members vote on Elite panel submissions */
export function isPeerReviewer(role: string | null | undefined) {
  return role === "PEER_REVIEWER"
}

/** Author-facing labels for the tracker */
export const STATUS_META: Record<ArticleStatus, { label: string; tracker: string; tone: "neutral" | "warn" | "info" | "ok" | "error" }> = {
  DRAFT: { label: "Draft", tracker: "Draft", tone: "neutral" },
  PHASE_1_FAILED: { label: "Phase 1 failed", tracker: "Phase 1 Check", tone: "error" },
  PENDING_EMPLOYEE_REVIEW: { label: "In review", tracker: "Employee Review", tone: "info" },
  PENDING_PEER_PANEL: { label: "Peer panel", tracker: "Peer Panel", tone: "info" },
  COUNTER_SUBMITTED: { label: "Counter submitted", tracker: "Counter Submitted", tone: "info" },
  PUBLISHED: { label: "Published", tracker: "Published", tone: "ok" },
  REJECTED: { label: "Rejected", tracker: "Rejected", tone: "warn" },
}
