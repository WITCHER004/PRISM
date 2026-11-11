// Shared types for the two-phase publishing pipeline. Safe to import from client and server.

export type ArticleStatus =
  | "DRAFT"
  | "PHASE_1_FAILED"
  | "PENDING_EMPLOYEE_REVIEW"
  | "PENDING_PEER_PANEL" // Elite: waiting on the 10-member peer panel
  | "COUNTER_SUBMITTED" // writer appealed a FAIL vote or a rejection; under reconsideration
  | "PUBLISHED"
  | "REJECTED"

/** Which Phase 2 an article goes through after the AI check */
export type ReviewTrack = "EMPLOYEE" | "PEER_PANEL"

/** One heuristic measurement. `aiLikelihood` is 0 (reads human) to 1 (reads machine-written). */
export interface Phase1Signal {
  key: "burstiness" | "perplexity" | "repetition" | "stockPhrasing" | "voice"
  label: string
  aiLikelihood: number
  /** Raw measured value, for the report */
  value: number
  detail: string
}

/** A passage the detector judged likely machine-written */
export interface FlaggedPassage {
  excerpt: string
  aiLikelihood: number
}

export interface Phase1Report {
  /** 0–100: share of the text judged AI-generated */
  aiPercent: number
  /** 0–100: always 100 - aiPercent */
  humanPercent: number
  passed: boolean
  /** The rule that was applied, e.g. 20 → "AI ≤ 20%" */
  threshold: number
  wordCount: number
  /** Short texts give the heuristics little to work with */
  confidence: "low" | "medium" | "high"
  /** Which detector produced the score: "heuristic" or an external provider's name */
  provider: string
  signals: Phase1Signal[]
  flagged: FlaggedPassage[]
  analyzedAt: string
}
