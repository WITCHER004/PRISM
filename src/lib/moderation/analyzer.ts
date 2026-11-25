import { analyzeHeuristically, type HeuristicResult } from "./heuristics"
import { overlapWithCorpus, type CorpusDoc } from "./similarity"
import { detectDomain, prepareText, toEngineText } from "./textPrep"
import { AI_MAX_PERCENT, BORDERLINE_AI, phase1Decision, PLAGIARISM_MAX_PERCENT } from "./workflow"
import type { ConfidenceLevel, DetectorDomain, FlaggedSentence, Phase1Report, PlagiarismSourceMatch } from "./types"
import type { CraftTelemetry } from "@/lib/craft"

/**
 * Phase 1 content analyzer.
 *
 * Detection runs through a provider so the ML engine (ai_plagiarism_engine/, a FastAPI service with
 * the calibrated 4-signal ensemble and the 3-layer plagiarism pipeline) can be plugged in:
 *
 *   AI_DETECTION_API_URL         POST endpoint (the engine's /evaluate, or another detection API)
 *   AI_DETECTION_API_KEY         sent as "Authorization: Bearer <key>" and "x-api-key"
 *   AI_DETECTION_PROVIDER        display name (default "external")
 *   AI_DETECTION_TIMEOUT_MS      default 60000 (the engine runs transformer models)
 *
 * When the engine answers with its full report (overallAiScore, flaggedSentences, …) that report is
 * used as-is: it is already calibrated per domain. A generic provider that only returns a probability
 * is blended 70/30 with the heuristic. On any failure the heuristic score is used on its own.
 * Plagiarism always includes the local lexical check against Prism's corpus (when given one);
 * the engine adds its own lexical + semantic result and the higher of the two counts.
 */

export interface DetectionInput {
  articleId: string
  text: string
  topic?: string
  craft?: CraftTelemetry
}

/** The engine's /evaluate response (subset we read) */
export interface EngineReport {
  overallAiScore: number
  plagiarismScore: number
  detectedDomain?: DetectorDomain
  confidenceLevel?: ConfidenceLevel
  flaggedSentences?: {
    text: string
    aiProbability: number
    reason: string
    plagiarismMatchUrl?: string | null
    plagiarismSimilarity?: number
    matchType?: FlaggedSentence["matchType"]
  }[]
  plagiarism?: { matches?: { sourceTitle?: string; sourceUrl?: string; sourceId: string; percent: number }[] }
  signals?: { craft?: { applied?: number } | null; cliche?: { contribution?: number }; burstiness?: { contribution?: number } }
  meta?: { codeBlocksStripped?: number; quotesExcluded?: number }
}

export interface DetectionResult {
  /** 0..1 share of the text judged machine-written */
  aiProbability: number
  /** Full engine report, when the provider is the Prism engine */
  engine?: EngineReport
}

export interface AIDetectionProvider {
  readonly name: string
  detect(input: DetectionInput): Promise<DetectionResult>
}

const EXTERNAL_WEIGHT = 0.7
const EXTERNAL_TIMEOUT_MS = Number(process.env.AI_DETECTION_TIMEOUT_MS) || 60_000

/** Reads the common response shapes of detection APIs (Prism engine, GPTZero, Sapling, generic) */
function readProbability(body: unknown): number | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  if (typeof b.overallAiScore === "number") return b.overallAiScore / 100
  const candidates: unknown[] = [
    (b.ai_detection as Record<string, unknown> | undefined)?.overall_ai_probability,
    b.ai_probability,
    b.aiProbability,
    b.score,
    (b.documents as Record<string, unknown>[] | undefined)?.[0]?.completely_generated_prob,
    (b.data as Record<string, unknown> | undefined)?.ai_probability,
  ]
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c > 1 ? c / 100 : c
  }
  return null
}

const isEngineReport = (b: unknown): b is EngineReport =>
  !!b && typeof b === "object" && typeof (b as EngineReport).overallAiScore === "number" && typeof (b as EngineReport).plagiarismScore === "number"

function authHeaders(apiKey: string) {
  return { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "x-api-key": apiKey }
}

export class ExternalDetectionProvider implements AIDetectionProvider {
  constructor(
    readonly name: string,
    private readonly url: string,
    private readonly apiKey: string
  ) {}

  async detect(input: DetectionInput): Promise<DetectionResult> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: authHeaders(this.apiKey),
      body: JSON.stringify({ article_id: input.articleId, text: input.text, document: input.text, topic: input.topic, craft: input.craft }),
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`${this.name} responded ${res.status}`)
    const body = await res.json()
    const p = readProbability(body)
    if (p === null) throw new Error(`${this.name} returned no probability`)
    return { aiProbability: Math.max(0, Math.min(1, p)), engine: isEngineReport(body) ? body : undefined }
  }
}

export function getExternalProvider(): AIDetectionProvider | null {
  const url = process.env.AI_DETECTION_API_URL
  const key = process.env.AI_DETECTION_API_KEY
  if (!url || !key) return null
  return new ExternalDetectionProvider(process.env.AI_DETECTION_PROVIDER || "external", url, key)
}

/**
 * Adds a published story to the engine's plagiarism corpus (POST <engine>/index). The engine URL is
 * derived from AI_DETECTION_API_URL by swapping /evaluate for /index. No-op without an engine.
 */
export async function indexPublishedArticle(article: { id: string; title: string; contentHtml: string; url: string }) {
  const url = process.env.AI_DETECTION_API_URL
  const key = process.env.AI_DETECTION_API_KEY
  if (!url || !key || !/\/evaluate\/?$/.test(url)) return
  const res = await fetch(url.replace(/\/evaluate\/?$/, "/index"), {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify({ article_id: article.id, text: toEngineText(article.contentHtml), url: article.url, title: article.title }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`engine /index responded ${res.status}`)
}

/** Turn stored editor HTML into plain text with paragraph breaks preserved */
export function htmlToPlainText(html: string) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^<>]{0,2000}>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}

/**
 * Proof of Craft: editor telemetry nudges a borderline AI score (BORDERLINE_AI, 18–25%).
 * Organic typing, several sittings and passages cut/rewritten pull it down by up to 6 points;
 * a mostly pasted draft pushes it up by up to 3. Scores outside the band are never moved.
 * Mirrors calibration.craft_adjust in the engine.
 */
export function craftAdjustment(aiPercent: number, craft?: CraftTelemetry | null): number {
  const [lo, hi] = BORDERLINE_AI
  if (!craft || aiPercent < lo || aiPercent > hi) return 0
  const typed = craft.typedChars + (craft.dictatedChars ?? 0)
  const inserted = typed + craft.pastedChars
  if (inserted < 200) return 0
  const typedRatio = typed / inserted
  const growth = craft.growth ?? []
  const finalWords = Math.max(1, ...growth.map((g) => g.words))
  let revisions = 0
  for (let i = 1; i < growth.length; i++) if (growth[i].words < growth[i - 1].words - 5) revisions++
  const clip = (x: number) => Math.max(0, Math.min(1, x))
  const pace = Math.min(1, craft.activeMs / 60_000 / Math.max(1, finalWords / 30))
  const evidence = 0.5 * clip((typedRatio - 0.6) / 0.35) + 0.2 * clip((craft.sessions - 1) / 2) + 0.15 * pace + 0.15 * clip(revisions / 3)
  let delta = -6 * evidence
  if (typedRatio < 0.3) delta += (3 * (0.3 - typedRatio)) / 0.3
  return Math.round(Math.max(-aiPercent, delta) * 10) / 10
}

function confidenceOf(aiPercent: number, words: number, strongDetector: boolean): ConfidenceLevel {
  const [lo, hi] = BORDERLINE_AI
  if (aiPercent >= lo - 3 && aiPercent <= hi + 5) return "Borderline"
  if (words >= 300 && strongDetector && (aiPercent <= lo - 8 || aiPercent >= hi + 15)) return "High"
  if (words < 150) return "Borderline"
  return "Medium"
}

const r1 = (n: number) => Math.round(n * 10) / 10

export async function analyzeArticle(
  input: {
    title?: string
    contentHtml: string
    articleId?: string
    /** First topic tag: picks the domain calibration (programming, science, philosophy, …) */
    topic?: string
    craft?: CraftTelemetry | null
    /** Published Prism stories to check for copied wording */
    corpus?: readonly CorpusDoc[]
  },
  provider: AIDetectionProvider | null = getExternalProvider()
): Promise<Phase1Report> {
  const prepared = prepareText(input.contentHtml)
  const { domain } = detectDomain(prepared, input.topic)
  const heuristic: HeuristicResult = analyzeHeuristically(prepared.prose, domain)
  const wordCount = prepared.wordCount

  let probability = heuristic.aiProbability
  let providerName = "heuristic"
  let engine: EngineReport | undefined
  if (provider && prepared.proseWordCount > 0) {
    try {
      const ext = await provider.detect({
        articleId: input.articleId ?? "phase1_check",
        text: toEngineText(input.contentHtml),
        topic: input.topic,
        craft: input.craft ?? undefined,
      })
      if (ext.engine) {
        engine = ext.engine
        probability = ext.engine.overallAiScore / 100
        providerName = `${provider.name} (calibrated ensemble)`
      } else {
        probability = EXTERNAL_WEIGHT * ext.aiProbability + (1 - EXTERNAL_WEIGHT) * heuristic.aiProbability
        providerName = `${provider.name} + heuristic`
      }
    } catch (err) {
      console.warn("[phase1] external detector failed, using heuristics only:", (err as Error).message)
    }
  }

  // AI score; the engine already applied the craft adjustment server-side
  let aiPercent = r1(probability * 100)
  let craftDelta = engine ? (engine.signals?.craft?.applied ?? 0) : 0
  if (!engine) {
    craftDelta = craftAdjustment(aiPercent, input.craft)
    aiPercent = r1(Math.max(0, aiPercent + craftDelta))
  }

  // Plagiarism: local lexical check vs the corpus, merged with the engine's lexical + semantic result
  const local = input.corpus ? overlapWithCorpus(input.contentHtml, input.corpus, input.articleId) : null
  const plagiarismScore = r1(Math.max(local?.percent ?? 0, engine?.plagiarismScore ?? 0))
  const matches: PlagiarismSourceMatch[] = [
    ...(local?.matches ?? []),
    ...(engine?.plagiarism?.matches ?? []).map((m) => ({ title: m.sourceTitle || m.sourceUrl || m.sourceId, url: m.sourceUrl || undefined, percent: m.percent })),
  ]
    .filter((m, i, all) => all.findIndex((x) => (x.url ?? x.title) === (m.url ?? m.title)) === i)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8)

  // Sentence-level breakdown. A failing document always shows its most AI-like sentences.
  const top = heuristic.sentences.map((s) => s.aiProbability).sort((a, b) => b - a)
  const flagMin = aiPercent > AI_MAX_PERCENT && top.length ? Math.min(0.6, Math.max(0.3, top[Math.min(top.length, 5) - 1])) : 0.6
  const bySentence = new Map<string, FlaggedSentence>()
  if (engine?.flaggedSentences) {
    for (const f of engine.flaggedSentences)
      bySentence.set(f.text, {
        text: f.text,
        aiProbability: f.aiProbability,
        reason: f.reason,
        plagiarismMatchUrl: f.plagiarismMatchUrl ?? undefined,
        plagiarismSimilarity: f.plagiarismSimilarity,
        matchType: f.matchType,
      })
  } else {
    for (const s of heuristic.sentences) {
      if (s.aiProbability < flagMin) continue
      bySentence.set(s.text, {
        text: s.text,
        aiProbability: s.aiProbability,
        reason: `Reads ${Math.round(s.aiProbability * 100)}% machine-written${s.reasons.length ? ` — ${s.reasons.slice(0, 2).join("; ")}` : ""}.`,
      })
    }
  }
  for (const f of local?.flagged ?? []) {
    const prev = bySentence.get(f.text)
    if (prev?.plagiarismMatchUrl) continue
    const aiP = prev?.aiProbability ?? heuristic.sentences.find((s) => s.text === f.text)?.aiProbability ?? 0
    bySentence.set(f.text, { ...f, aiProbability: aiP, reason: prev && prev.aiProbability >= flagMin ? `${prev.reason} ${f.reason}` : f.reason })
  }
  const flaggedSentences = [...bySentence.values()]
    .sort((a, b) => Number(!!b.plagiarismMatchUrl || !!b.matchType) - Number(!!a.plagiarismMatchUrl || !!a.matchType) || b.aiProbability - a.aiProbability)
    .slice(0, 30)
    .map((f) => ({ ...f, text: f.text.length > 400 ? `${f.text.slice(0, 397)}…` : f.text, reason: f.reason.slice(0, 400) }))

  const aiPassed = aiPercent <= AI_MAX_PERCENT
  const plagiarismPassed = plagiarismScore <= PLAGIARISM_MAX_PERCENT
  const confidenceLevel = engine?.confidenceLevel ?? confidenceOf(aiPercent, wordCount, false)
  const decision = phase1Decision(aiPercent, plagiarismScore)

  return {
    aiPercent,
    humanPercent: r1(100 - aiPercent),
    passed: decision !== "FAIL",
    manualReview: decision === "MANUAL_REVIEW" || undefined,
    threshold: AI_MAX_PERCENT,
    wordCount,
    confidence: wordCount < 150 ? "low" : wordCount < 400 ? "medium" : "high",
    provider: providerName,
    signals: heuristic.signals,
    flagged: heuristic.flagged,
    analyzedAt: new Date().toISOString(),
    overallAiScore: aiPercent,
    plagiarismScore,
    plagiarismThreshold: PLAGIARISM_MAX_PERCENT,
    aiPassed,
    plagiarismPassed,
    detectedDomain: engine?.detectedDomain ?? domain,
    confidenceLevel,
    flaggedSentences,
    plagiarismMatches: matches,
    excluded: {
      codeBlocks: engine?.meta?.codeBlocksStripped ?? prepared.codeBlocks,
      quotes: engine?.meta?.quotesExcluded ?? prepared.excludedQuotes,
    },
    craftAdjustment: craftDelta || undefined,
  }
}
