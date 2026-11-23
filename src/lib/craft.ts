// Verified Human Craft: telemetry the editor records while an author writes, and the certificate
// readers see. Only counts and timings are kept, never the keystrokes themselves.

import { AI_MAX_PERCENT } from "@/lib/moderation/workflow"

export interface GrowthPoint {
  /** Active writing time when sampled, ms */
  ms: number
  words: number
}

/** Raw telemetry, stored on the draft */
export interface CraftTelemetry {
  v: 1
  startedAt: number
  /** Time spent actively editing; pauses over 3 minutes don't count */
  activeMs: number
  /** Writing sittings: a gap of 30+ minutes starts a new one */
  sessions: number
  typedChars: number
  pastedChars: number
  /** Characters spoken into the editor with Dictate (composed in Prism, so counted with typing) */
  dictatedChars?: number
  /** Time of the last edit (0 = none yet) */
  lastAt: number
  /** Word count over active time, downsampled */
  growth: GrowthPoint[]
}

export interface RevisionSnapshot {
  label: "Outline" | "First draft" | "Revision" | "Published"
  words: number
  /** Active minutes into the work */
  minute: number
}

/** What readers see */
export interface CraftCertificate {
  writingDurationMinutes: number
  sessions: number
  revisionSnapshots: RevisionSnapshot[]
  /** Typed (or dictated) share of all inserted characters, 0–1 (null when nothing was recorded) */
  typedVsPastedRatio: number | null
  /** Phase 1 AI share, 0–100 (null when the check hasn't run) */
  aiCheckScore: number | null
  /** 0–100 */
  authenticityScore: number
  verified: boolean
  /** Word counts over time for the sparkline */
  growth: GrowthPoint[]
}

export const BREAK_MS = 3 * 60_000
export const SESSION_GAP_MS = 30 * 60_000
const MAX_POINTS = 40

export const emptyCraft = (now = Date.now()): CraftTelemetry => ({
  v: 1,
  startedAt: now,
  activeMs: 0,
  sessions: 1,
  typedChars: 0,
  pastedChars: 0,
  lastAt: 0,
  growth: [],
})

/** Keep the first and last points; thin the middle evenly */
export function downsample(points: GrowthPoint[], max = MAX_POINTS): GrowthPoint[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)])
}

const MILESTONES: { label: RevisionSnapshot["label"]; share: number }[] = [
  { label: "Outline", share: 0.15 },
  { label: "First draft", share: 0.6 },
  { label: "Revision", share: 0.9 },
]

export function certificateFrom(t: CraftTelemetry, finalWords: number, aiPercent: number | null | undefined): CraftCertificate {
  const minutes = Math.max(1, Math.round(t.activeMs / 60_000))
  const growth = t.growth.length ? t.growth : [{ ms: t.activeMs, words: finalWords }]
  // Dictation is composed live in the editor, so it counts as the author's own writing, like typing
  const composed = t.typedChars + (t.dictatedChars ?? 0)
  const inserted = composed + t.pastedChars
  const typedRatio = inserted > 0 ? composed / inserted : null

  const toMinute = (ms: number) => Math.max(0, Math.round(ms / 60_000))
  const revisionSnapshots: RevisionSnapshot[] = MILESTONES.map(({ label, share }) => {
    const p = growth.find((g) => g.words >= finalWords * share) ?? growth[growth.length - 1]
    return { label, words: p.words, minute: toMinute(p.ms) }
  })
  revisionSnapshots.push({ label: "Published", words: finalWords, minute: minutes })

  // Mostly how much was typed, then whether the time spent fits the length, then return visits
  const pace = Math.min(1, minutes / Math.max(1, finalWords / 30))
  const visits = Math.min(1, t.sessions / 3)
  const authenticityScore = Math.round(100 * (0.65 * (typedRatio ?? 0) + 0.2 * pace + 0.15 * visits))
  const ai = aiPercent ?? null

  return {
    writingDurationMinutes: minutes,
    sessions: t.sessions,
    revisionSnapshots,
    typedVsPastedRatio: typedRatio,
    aiCheckScore: ai,
    authenticityScore,
    verified: ai !== null && ai <= AI_MAX_PERCENT && (typedRatio ?? 0) >= 0.6,
    growth: downsample(growth),
  }
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}
