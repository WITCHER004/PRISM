import type { ArticleStatus, ReviewTrack } from "./types"

// The publishing rules: an article needs at least 150 words, and may be at most 20%
// AI-generated (≥ 80% human-written).
export const AI_MAX_PERCENT = 20
export const MIN_WORDS_FOR_SUBMISSION = 150

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

/** Phase 1 outcome → next status. Everyone who passes goes to an employee first. */
export function phase1Outcome(aiPercent: number): ArticleStatus {
  return aiPercent > AI_MAX_PERCENT ? "PHASE_1_FAILED" : "PENDING_EMPLOYEE_REVIEW"
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

/** Anyone who gets the review dashboard */
export function canOpenReviewDashboard(role: string | null | undefined) {
  return canReview(role) || isPeerReviewer(role)
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
