// Instant Ideas: short thoughts that delete themselves after 1–24 hours.
// Stored in Firestore `instant_ideas` when it's reachable, always mirrored to localStorage.

import { MOCK_USERS } from "@/lib/data"

export type IdeaFormat = "thought" | "quote" | "code"
export type IdeaTheme = "paper" | "obsidian" | "amber" | "blueprint"
export type IdeaReaction = "sparked" | "deep"

export interface InstantIdea {
  id: string
  text: string
  format: IdeaFormat
  theme: IdeaTheme
  authorHandle: string
  authorName: string
  authorAvatar?: string
  authorUid?: string
  /** ms since epoch */
  createdAt: number
  expiresAt: number
  /** Reaction counts from other readers (seed data); the viewer's own taps are added locally */
  counts?: Partial<Record<IdeaReaction, number>>
  /** Built-in sample, never written to Firestore */
  sample?: boolean
  /** When total sparks/reactions >= 25, the idea is permanently preserved and immune to deletion */
  isImmortal?: boolean
  /** List of voter usernames/UIDs who sparked or reacted to this idea */
  voterIds?: string[]
}

export const IMMORTAL_THRESHOLD = 25

export const IDEA_MAX = 280
export const HOUR = 60 * 60 * 1000
export const MINUTE = 60 * 1000

export const DURATIONS = [
  { label: "1 Hour", short: "1h", ms: HOUR },
  { label: "6 Hours", short: "6h", ms: 6 * HOUR },
  { label: "12 Hours", short: "12h", ms: 12 * HOUR },
  { label: "24 Hours", short: "24h", ms: 24 * HOUR },
] as const
export const DEFAULT_DURATION = 24 * HOUR

export const FORMATS: { value: IdeaFormat; label: string }[] = [
  { value: "thought", label: "Thought" },
  { value: "quote", label: "Quote" },
  { value: "code", label: "Code" },
]

/** Card canvases. Fixed colours (not theme tokens): an idea looks the same in every reading theme. */
export const THEMES: Record<IdeaTheme, { label: string; canvas: string; ink: string; muted: string; ring: string; track: string }> = {
  paper: {
    label: "Warm Paper",
    canvas: "bg-[#faf8f5] [background-image:radial-gradient(120%_80%_at_0%_0%,#fffdf9,transparent)]",
    ink: "text-[#141413]",
    muted: "text-[#6b655c]",
    ring: "#b7791f",
    track: "rgb(20 20 19 / 0.12)",
  },
  obsidian: {
    label: "Obsidian Ink",
    canvas: "bg-[#141413] [background-image:radial-gradient(120%_80%_at_100%_0%,#25231f,transparent)]",
    ink: "text-[#f4f1ea]",
    muted: "text-[#a8a29a]",
    ring: "#e0a53a",
    track: "rgb(244 241 234 / 0.16)",
  },
  amber: {
    label: "Amber Glass",
    canvas: "bg-[#f3c97a] [background-image:linear-gradient(140deg,#f8dca6_0%,#efb85c_55%,#e3a043_100%)]",
    ink: "text-[#2a1a05]",
    muted: "text-[#5c3d0e]",
    ring: "#2a1a05",
    track: "rgb(42 26 5 / 0.16)",
  },
  blueprint: {
    label: "Blueprint Grid",
    canvas:
      "bg-[#1b3561] [background-image:linear-gradient(rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px]",
    ink: "text-[#eaf1ff]",
    muted: "text-[#a9bde0]",
    ring: "#9cc3ff",
    track: "rgb(234 241 255 / 0.18)",
  },
}

export const CORAL = "#ef6a4c"

/* ── Time ──────────────────────────────────────────────────────────────────── */

export const getTotalReactions = (idea: InstantIdea) =>
  (idea.counts?.sparked ?? 0) + (idea.counts?.deep ?? 0)

export const isImmortal = (idea: InstantIdea) =>
  Boolean(idea.isImmortal || (idea.counts?.sparked ?? 0) >= IMMORTAL_THRESHOLD || getTotalReactions(idea) >= IMMORTAL_THRESHOLD)

export const isActive = (idea: InstantIdea, now: number) => isImmortal(idea) || idea.expiresAt > now

/** "21h left", "42m left", "<1m left" */
export function timeLeft(idea: InstantIdea, now: number) {
  const ms = Math.max(0, idea.expiresAt - now)
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}h left`
  if (ms >= MINUTE) return `${Math.floor(ms / MINUTE)}m left`
  return "<1m left"
}

/** "14h 22m", "38m", "under a minute" */
export function vanishesIn(idea: InstantIdea, now: number) {
  const ms = Math.max(0, idea.expiresAt - now)
  const h = Math.floor(ms / HOUR)
  const m = Math.floor((ms % HOUR) / MINUTE)
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m`
  return "under a minute"
}

export const isUrgent = (idea: InstantIdea, now: number) => idea.expiresAt - now < HOUR

/** Share of the idea's lifetime still remaining, 0–1 */
export const lifeLeft = (idea: InstantIdea, now: number) =>
  Math.min(1, Math.max(0, (idea.expiresAt - now) / Math.max(1, idea.expiresAt - idea.createdAt)))

export const newIdeaId = () => "idea_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

/* ── Samples ───────────────────────────────────────────────────────────────── */

// Built relative to "now" so the tray looks alive on first visit; they then expire for real
export function sampleIdeas(now: number): InstantIdea[] {
  const by = (username: string) => MOCK_USERS.find((u) => u.username === username) ?? MOCK_USERS[0]
  const make = (
    id: string,
    username: string,
    text: string,
    format: IdeaFormat,
    theme: IdeaTheme,
    durationMs: number,
    remainingMs: number,
    counts: InstantIdea["counts"]
  ): InstantIdea => {
    const u = by(username)
    return {
      id,
      text,
      format,
      theme,
      authorHandle: u.username,
      authorName: u.displayName,
      authorAvatar: u.avatarUrl,
      createdAt: now - (durationMs - remainingMs),
      expiresAt: now + remainingMs,
      counts,
      sample: true,
    }
  }
  return [
    make(
      "sample_ledger",
      "alexchen",
      "Half-formed: idempotency keys are a product decision, not an infra one. Whoever decides how long a key lives is deciding how long a customer can safely retry.",
      "thought",
      "paper",
      24 * HOUR,
      23 * HOUR + 12 * MINUTE,
      { sparked: 41, deep: 12 }
    ),
    make(
      "sample_jitter",
      "marcuswilliams",
      "retry(fn, { backoff: \"exponential\", jitter: \"full\" })\n// full jitter beat equal jitter in every load test this week",
      "code",
      "blueprint",
      12 * HOUR,
      5 * HOUR + 8 * MINUTE,
      { sparked: 18, deep: 9 }
    ),
    make(
      "sample_quote",
      "priyarao",
      "The map is not the territory, but the changelog is the history of the territory.",
      "quote",
      "obsidian",
      6 * HOUR,
      47 * MINUTE,
      { sparked: 63, deep: 21 }
    ),
    make(
      "sample_sources",
      "sarahkim",
      "Collecting primary sources on municipal broadband: three city audits and one FCC dataset so far. Send me the ones you trust, not the op-eds.",
      "thought",
      "amber",
      1 * HOUR,
      18 * MINUTE,
      { sparked: 7, deep: 3 }
    ),
  ]
}

/* ── Local persistence ─────────────────────────────────────────────────────── */

const LOCAL_KEY = "prism-instant-ideas:v1"
const REACTIONS_KEY = "prism-idea-reactions:v1"
const SEEN_KEY = "prism-idea-seen:v1"

type LocalState = { ideas: InstantIdea[]; seededAt: number }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode / quota: the session still works from memory
  }
}

/** Local ideas, minus anything expired. Re-seeds the samples once the last batch has fully expired. */
export function loadLocalIdeas(now: number): InstantIdea[] {
  const state = readJSON<LocalState>(LOCAL_KEY, { ideas: [], seededAt: 0 })
  let ideas = state.ideas.filter((i) => isActive(i, now))
  let seededAt = state.seededAt
  if (now - seededAt > 24 * HOUR) {
    ideas = [...ideas.filter((i) => !i.sample), ...sampleIdeas(now)]
    seededAt = now
  }
  writeJSON(LOCAL_KEY, { ideas, seededAt })
  return ideas
}

export function saveLocalIdeas(ideas: InstantIdea[]) {
  const state = readJSON<LocalState>(LOCAL_KEY, { ideas: [], seededAt: Date.now() })
  writeJSON(LOCAL_KEY, { ...state, ideas })
}

export const loadReactions = () => readJSON<Record<string, IdeaReaction[]>>(REACTIONS_KEY, {})
export const saveReactions = (r: Record<string, IdeaReaction[]>) => writeJSON(REACTIONS_KEY, r)
export const loadSeen = () => new Set(readJSON<string[]>(SEEN_KEY, []))
export const saveSeen = (seen: Set<string>) => writeJSON(SEEN_KEY, [...seen].slice(-200))

/* ── Firestore (best effort) ───────────────────────────────────────────────── */

const COLLECTION = "instant_ideas"
// console.warn, not console.error: Next.js dev turns console.error into the full-screen overlay
const warn = (msg: string, err: unknown) =>
  console.warn(`[ideas] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))])
}

/** Active ideas from Firestore. Empty on any failure (offline, rules, no database). */
export async function fetchRemoteIdeas(now: number): Promise<InstantIdea[]> {
  try {
    const [{ collection, query, where, orderBy, limit, getDocs }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("@/lib/firestore"),
    ])
    const snap = await withTimeout(
      getDocs(query(collection(db, COLLECTION), where("expiresAt", ">", now), orderBy("expiresAt"), limit(60))),
      8000
    )
    return snap.docs
      .map((d) => ({ ...(d.data() as InstantIdea), id: d.id }))
      .filter((i) => typeof i.text === "string" && typeof i.expiresAt === "number" && isActive(i, now))
  } catch (err) {
    warn("Firestore unavailable; showing ideas saved on this device.", err)
    return []
  }
}

export async function saveRemoteIdea(idea: InstantIdea) {
  try {
    const [{ doc, setDoc }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firestore")])
    // Not awaited past the timeout: offline writes stay queued and sync when the connection returns
    await withTimeout(setDoc(doc(db, COLLECTION, idea.id), stripUndefined(idea)), 8000)
  } catch (err) {
    warn("Couldn't confirm the idea reached Firestore; it's saved on this device and syncs if the write was queued.", err)
  }
}

export async function deleteRemoteIdea(id: string) {
  try {
    const [{ doc, deleteDoc }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firestore")])
    await withTimeout(deleteDoc(doc(db, COLLECTION, id)), 8000)
  } catch (err) {
    warn("Couldn't delete the idea from Firestore.", err)
  }
}

// Firestore rejects undefined field values
const stripUndefined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/* ── Promote to Full Article ─────────────────────────────────────────────── */

export const ARTICLE_PROMO_SEED_KEY = "prism-promoted-idea-seed"

export interface PromotedIdeaSeed {
  ideaId: string
  text: string
  authorHandle: string
  authorName: string
  voterIds: string[]
  format: IdeaFormat
  theme: IdeaTheme
}

/** Pre-fill a new article draft from an idea that crossed 25 sparks */
export function setPromotedIdeaSeed(idea: InstantIdea, extraVoters: string[] = []) {
  try {
    const allVoters = Array.from(new Set([...(idea.voterIds ?? []), ...extraVoters]))
    const seed: PromotedIdeaSeed = {
      ideaId: idea.id,
      text: idea.text,
      authorHandle: idea.authorHandle,
      authorName: idea.authorName,
      voterIds: allVoters,
      format: idea.format,
      theme: idea.theme,
    }
    sessionStorage.setItem(ARTICLE_PROMO_SEED_KEY, JSON.stringify(seed))
  } catch {}
}

export function readPromotedIdeaSeed(): PromotedIdeaSeed | undefined {
  try {
    const raw = sessionStorage.getItem(ARTICLE_PROMO_SEED_KEY)
    if (!raw) return undefined
    return JSON.parse(raw) as PromotedIdeaSeed
  } catch {
    return undefined
  }
}

export function clearPromotedIdeaSeed() {
  try {
    sessionStorage.removeItem(ARTICLE_PROMO_SEED_KEY)
  } catch {}
}

const QUOTE_SEED_KEY = "prism-quote-seed"

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Hand an idea to the next new-story editor */
export function setQuoteSeed(idea: InstantIdea) {
  try {
    sessionStorage.setItem(QUOTE_SEED_KEY, JSON.stringify({ text: idea.text, name: idea.authorName, handle: idea.authorHandle }))
  } catch {}
}

/** The seeded quote as editor HTML (read-only; call clearQuoteSeed once the editor has it) */
export function readQuoteSeed(): string | undefined {
  try {
    const raw = sessionStorage.getItem(QUOTE_SEED_KEY)
    if (!raw) return undefined
    const { text, name, handle } = JSON.parse(raw) as { text: string; name: string; handle: string }
    const lines = escapeHtml(text).split("\n").join("<br>")
    return `<blockquote><p>${lines}</p><p>— ${escapeHtml(name)} (@${escapeHtml(handle)}), in an Instant Idea</p></blockquote><p></p>`
  } catch {
    return undefined
  }
}

export function clearQuoteSeed() {
  try {
    sessionStorage.removeItem(QUOTE_SEED_KEY)
  } catch {}
}
