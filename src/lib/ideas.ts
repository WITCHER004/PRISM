// Instant Ideas: short thoughts that delete themselves after 1–24 hours, unless readers spark them past
// IMMORTAL_THRESHOLD reactions. Stored in Firestore `instant_ideas` (no local copies).

import { cooldownMessage, markPosted, stampRateLimit } from "@/lib/rateLimit"

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
  /** Reaction counts (everyone's, including the viewer's) */
  counts?: Partial<Record<IdeaReaction, number>>
  /** Who reacted, by uid */
  reactors?: Partial<Record<IdeaReaction, string[]>>
  /** When total sparks/reactions >= 25, the idea is permanently preserved and immune to deletion */
  isImmortal?: boolean
  /** uids of everyone who reacted; they're notified if the idea becomes a published article */
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

/* ── Per-viewer UI state (which ideas this browser has opened) ─────────────── */

const SEEN_KEY = "prism-idea-seen:v1"

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
    // Private mode / quota: the ring just won't remember it was seen
  }
}

export const loadSeen = () => new Set(readJSON<string[]>(SEEN_KEY, []))
export const saveSeen = (seen: Set<string>) => writeJSON(SEEN_KEY, [...seen].slice(-200))

/* ── Firestore: instant_ideas ──────────────────────────────────────────────── */
//
// instant_ideas/{id}: authorId · authorHandle · authorName · authorAvatar · content · mode · canvasTheme ·
// createdAt · expiresAt · reactions {sparked, deep} · reactors {sparked: uid[], deep: uid[]} ·
// totalReactions · voterIds (uids) · isImmortal

const COLLECTION = "instant_ideas"
const warn = (msg: string, err: unknown) =>
  console.warn(`[ideas] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

const fs = () => Promise.all([import("firebase/firestore"), import("@/lib/firebase")])

type IdeaDoc = {
  authorId: string
  authorHandle: string
  authorName: string
  authorAvatar: string
  content: string
  mode: IdeaFormat
  canvasTheme: IdeaTheme
  createdAt: number
  expiresAt: number
  reactions: Record<IdeaReaction, number>
  reactors: Record<IdeaReaction, string[]>
  totalReactions: number
  voterIds: string[]
  isImmortal: boolean
}

function ideaFromDoc(id: string, d: Partial<IdeaDoc>): InstantIdea | null {
  if (typeof d.content !== "string" || typeof d.expiresAt !== "number") return null
  return {
    id,
    text: d.content,
    format: d.mode ?? "thought",
    theme: d.canvasTheme && d.canvasTheme in THEMES ? d.canvasTheme : "paper",
    authorHandle: d.authorHandle ?? "",
    authorName: d.authorName ?? d.authorHandle ?? "Member",
    authorAvatar: d.authorAvatar || undefined,
    authorUid: d.authorId,
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    expiresAt: d.expiresAt,
    counts: { sparked: d.reactions?.sparked ?? 0, deep: d.reactions?.deep ?? 0 },
    reactors: { sparked: d.reactors?.sparked ?? [], deep: d.reactors?.deep ?? [] },
    isImmortal: d.isImmortal === true,
    voterIds: d.voterIds ?? [],
  }
}

/**
 * Live list of ideas, newest first. Expired, non-immortal ideas are filtered out and deleted from
 * Firestore when they're seen (best effort: whoever's client notices first removes them).
 * Returns an unsubscribe function.
 */
export function watchIdeas(onChange: (ideas: InstantIdea[]) => void, onError?: () => void): () => void {
  let stop: (() => void) | undefined
  let cancelled = false
  let first = false
  // Firestore retries silently when the database is unreachable or missing: don't spin forever
  const giveUp = setTimeout(() => !first && onError?.(), 8000)
  fs()
    .then(([{ collection, query, orderBy, limit, onSnapshot }, { db }]) => {
      if (cancelled) return
      stop = onSnapshot(
        query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(120)),
        (snap) => {
          first = true
          const now = Date.now()
          const live: InstantIdea[] = []
          for (const d of snap.docs) {
            const idea = ideaFromDoc(d.id, d.data() as Partial<IdeaDoc>)
            if (!idea) continue
            if (isActive(idea, now)) live.push(idea)
            else void deleteIdea(idea.id)
          }
          onChange(live)
        },
        (err) => {
          warn("ideas listener stopped", err)
          onError?.()
        }
      )
    })
    .catch((err) => {
      warn("Firestore unavailable", err)
      onError?.()
    })
  return () => {
    cancelled = true
    clearTimeout(giveUp)
    stop?.()
  }
}

export async function createIdea(idea: InstantIdea): Promise<void> {
  const wait = cooldownMessage("idea")
  if (wait) throw new RateLimitedError(wait)
  if (!idea.authorUid) throw new Error("Sign in to post an idea.")
  const [{ doc, writeBatch, serverTimestamp }, { db }] = await fs()
  const data: IdeaDoc = {
    authorId: idea.authorUid ?? "",
    authorHandle: idea.authorHandle,
    authorName: idea.authorName,
    authorAvatar: idea.authorAvatar ?? "",
    content: idea.text,
    mode: idea.format,
    canvasTheme: idea.theme,
    createdAt: idea.createdAt,
    expiresAt: idea.expiresAt,
    reactions: { sparked: 0, deep: 0 },
    reactors: { sparked: [], deep: [] },
    totalReactions: 0,
    voterIds: [],
    isImmortal: false,
  }
  // The rules allow one idea per 30s per member: the rate-limit stamp rides in the same batch
  const batch = writeBatch(db)
  batch.set(doc(db, COLLECTION, idea.id), data)
  stampRateLimit({ doc, serverTimestamp }, batch, db, idea.authorUid, "idea")
  await batch.commit()
  markPosted("idea")
}

/** Thrown when the member is still inside a posting cooldown */
export class RateLimitedError extends Error {}

export async function deleteIdea(id: string): Promise<void> {
  try {
    const [{ doc, deleteDoc }, { db }] = await fs()
    await deleteDoc(doc(db, COLLECTION, id))
  } catch (err) {
    warn(`couldn't delete instant_ideas/${id}`, err)
  }
}

/**
 * Adds or removes the viewer's reaction in a transaction, so counts, voterIds and the immortal flag
 * stay consistent when several readers react at once. Once immortal, an idea stays immortal.
 */
export async function toggleIdeaReaction(id: string, reaction: IdeaReaction, uid: string): Promise<void> {
  const [{ doc, runTransaction }, { db }] = await fs()
  const ref = doc(db, COLLECTION, id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const d = snap.data() as Partial<IdeaDoc>
    const reactors = { sparked: [...(d.reactors?.sparked ?? [])], deep: [...(d.reactors?.deep ?? [])] }
    const list = reactors[reaction]
    const i = list.indexOf(uid)
    if (i >= 0) list.splice(i, 1)
    else list.push(uid)
    const reactions = { sparked: reactors.sparked.length, deep: reactors.deep.length }
    const totalReactions = reactions.sparked + reactions.deep
    tx.update(ref, {
      reactors,
      reactions,
      totalReactions,
      voterIds: [...new Set([...reactors.sparked, ...reactors.deep])],
      isImmortal: d.isImmortal === true || totalReactions >= IMMORTAL_THRESHOLD,
    })
  })
}

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

/** Pre-fill a new article draft from an idea that crossed 25 sparks (its reactors are notified on publish) */
export function setPromotedIdeaSeed(idea: InstantIdea) {
  try {
    const seed: PromotedIdeaSeed = {
      ideaId: idea.id,
      text: idea.text,
      authorHandle: idea.authorHandle,
      authorName: idea.authorName,
      voterIds: [...new Set(idea.voterIds ?? [])],
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
