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

/** One detector measurement. `aiLikelihood` is 0 (reads human) to 1 (reads machine-written). */
export interface Phase1Signal {
  key: "burstiness" | "perplexity" | "repetition" | "stockPhrasing" | "voice" | "classifier" | "binoculars" | "cliche" | "craft"
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

export type ConfidenceLevel = "High" | "Medium" | "Borderline"
export type DetectorDomain = "programming" | "infrastructure" | "academic" | "essay" | "journalism" | "general"

/** One sentence the author or reviewers should look at, with why it was flagged */
export interface FlaggedSentence {
  text: string
  /** 0–1: how machine-written this sentence reads */
  aiProbability: number
  /** Where the copied/paraphrased wording was found (Prism story path or external URL) */
  plagiarismMatchUrl?: string
  plagiarismMatchTitle?: string
  /** 0–1 similarity to that source */
  plagiarismSimilarity?: number
  matchType?: "VERBATIM" | "NEAR_VERBATIM" | "MOSAIC" | "PARAPHRASE"
  reason: string
}

export interface PlagiarismSourceMatch {
  title: string
  url?: string
  /** 0–100: share of the submission's prose matched to this source */
  percent: number
}

export interface Phase1Report {
  /** 0–100: share of the text judged AI-generated */
  aiPercent: number
  /** 0–100: always 100 - aiPercent */
  humanPercent: number
  /** True when the article goes on to review (a clean pass or manual review); false = Phase 1 failed */
  passed: boolean
  /** AI score between the limit and MANUAL_REVIEW_MAX_AI: an employee reads it instead of an automatic fail */
  manualReview?: boolean
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

  // ---- Multi-signal report (absent on reports stored before the ensemble upgrade) ----
  /** 0–100, same as aiPercent; passes at <= threshold (20) */
  overallAiScore?: number
  /** 0–100: share of the author's prose matched to an existing source; passes at <= plagiarismThreshold (15) */
  plagiarismScore?: number
  plagiarismThreshold?: number
  aiPassed?: boolean
  plagiarismPassed?: boolean
  detectedDomain?: DetectorDomain
  confidenceLevel?: ConfidenceLevel
  flaggedSentences?: FlaggedSentence[]
  plagiarismMatches?: PlagiarismSourceMatch[]
  /** What was left out of scoring: code blocks and attributed quotations */
  excluded?: { codeBlocks: number; quotes: number }
  /** Proof-of-Craft adjustment applied to a borderline AI score (negative = toward human) */
  craftAdjustment?: number
}
