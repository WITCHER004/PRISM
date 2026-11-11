
import { analyzeHeuristically, type HeuristicResult } from "./heuristics"
import { AI_MAX_PERCENT } from "./workflow"
import type { Phase1Report } from "./types"

/**
 * Phase 1 content analyzer. Detection is behind a provider interface so an external
 * AI-detection service can be plugged in without touching callers:
 *
 *   AI_DETECTION_API_URL   endpoint that accepts POST { text } (JSON)
 *   AI_DETECTION_API_KEY   sent as "Authorization: Bearer <key>" and "x-api-key"
 *   AI_DETECTION_PROVIDER  display name for reports (default "external")
 *
 * With an external provider configured, its score is blended with the heuristic one
 * (EXTERNAL_WEIGHT); if the call fails, the heuristic score is used on its own.
 */

export interface DetectionResult {
  /** 0..1 share of the text judged machine-written */
  aiProbability: number
}

export interface AIDetectionProvider {
  readonly name: string
  detect(text: string): Promise<DetectionResult>
}

const EXTERNAL_WEIGHT = 0.7
const EXTERNAL_TIMEOUT_MS = 8000

/** Reads the common response shapes of detection APIs (GPTZero, Sapling, generic) */
function readProbability(body: unknown): number | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
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

export class ExternalDetectionProvider implements AIDetectionProvider {
  constructor(
    readonly name: string,
    private readonly url: string,
    private readonly apiKey: string
  ) {}

  async detect(text: string): Promise<DetectionResult> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ article_id: "phase1_check", text, document: text }),
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`${this.name} responded ${res.status}`)
    const p = readProbability(await res.json())
    if (p === null) throw new Error(`${this.name} returned no probability`)
    return { aiProbability: Math.max(0, Math.min(1, p)) }
  }
}

export function getExternalProvider(): AIDetectionProvider | null {
  const url = process.env.AI_DETECTION_API_URL
  const key = process.env.AI_DETECTION_API_KEY
  if (!url || !key) return null
  return new ExternalDetectionProvider(process.env.AI_DETECTION_PROVIDER || "external", url, key)
}

/** Turn stored editor HTML into plain text with paragraph breaks preserved */
export function htmlToPlainText(html: string) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
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

export async function analyzeArticle(
  input: { title?: string; contentHtml: string },
  provider: AIDetectionProvider | null = getExternalProvider()
): Promise<Phase1Report> {
  const text = htmlToPlainText(input.contentHtml)
  const heuristic: HeuristicResult = analyzeHeuristically(text)

  let probability = heuristic.aiProbability
  let providerName = "heuristic"
  if (provider && heuristic.wordCount > 0) {
    try {
      const ext = await provider.detect(text)
      probability = EXTERNAL_WEIGHT * ext.aiProbability + (1 - EXTERNAL_WEIGHT) * heuristic.aiProbability
      providerName = `${provider.name} + heuristic`
    } catch (err) {
      console.warn("[phase1] external detector failed, using heuristics only:", (err as Error).message)
    }
  }

  const aiPercent = Math.round(probability * 1000) / 10
  return {
    aiPercent,
    humanPercent: Math.round((100 - aiPercent) * 10) / 10,
    passed: aiPercent <= AI_MAX_PERCENT,
    threshold: AI_MAX_PERCENT,
    wordCount: heuristic.wordCount,
    confidence: heuristic.wordCount < 150 ? "low" : heuristic.wordCount < 400 ? "medium" : "high",
    provider: providerName,
    signals: heuristic.signals,
    flagged: heuristic.flagged,
    analyzedAt: new Date().toISOString(),
  }
}
