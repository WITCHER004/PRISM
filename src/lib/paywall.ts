// Paywall rules shared by the server (which enforces them) and the browser (which only shows them).
//
// Since the security audit (F-02), a locked story's full text never reaches a reader who isn't entitled
// to it: the public copy of a published article (public_articles/{id}) holds only a preview, the full
// body sits in the server-only article_bodies/{id}, and GET /api/articles/{id}/body hands it out after
// checking the reader. This module has no server-only imports so the backfill script can use it too.

import { PAPER_PREVIEW_FRACTION } from "@/lib/papers"

export type PaywallTier = "FREE" | "METERED" | "SUBSCRIBER" | "PAID"

/** Signed-in readers on the free plan may open this many metered stories a calendar month */
export const FREE_METERED_PER_MONTH = 3

export const PUBLIC_ARTICLES = "public_articles"
export const ARTICLE_BODIES = "article_bodies"
export const ARTICLE_UNLOCKS = "article_unlocks"
export const READER_METERS = "reader_meters"

interface VersionLike {
  paywall?: string
  paper?: unknown
  contentHtml?: string
}

/** Advanced Papers are Elite-only whatever their paywall tier says */
export function isLocked(v: VersionLike | null | undefined): boolean {
  return !!v && ((v.paywall ?? "FREE") !== "FREE" || !!v.paper)
}

/** Share of a locked story's blocks every reader sees: papers a quarter, metered half, the rest a third */
export function previewFraction(v: VersionLike): number {
  return v.paper ? PAPER_PREVIEW_FRACTION : v.paywall === "METERED" ? 0.5 : 0.33
}

const BLOCK = /<(p|h[1-6]|blockquote|ul|ol|pre|figure|table|div|section)(\s[^>]{0,2000})?>[\s\S]*?<\/\1>|<(hr|img)\b[^<>]{0,2000}\/?>/g

/**
 * The first `fraction` of a story's top-level blocks (at least one, never all of them when there are
 * several). Runs on stored editor HTML, which is well-formed, and is capped in length.
 */
export function previewHtml(html: string, fraction: number): string {
  const src = (html ?? "").slice(0, 400_000)
  const blocks = [...src.matchAll(BLOCK)]
  if (blocks.length === 0) return src.slice(0, Math.max(200, Math.round(src.length * fraction)))
  const keep = blocks.length < 3 ? 1 : Math.max(2, Math.min(blocks.length - 1, Math.round(blocks.length * fraction)))
  const last = blocks[keep - 1]
  return src.slice(0, (last.index ?? 0) + last[0].length)
}

const WORD = /[\p{L}\p{M}\p{N}’']+/gu
export const wordCountOf = (html: string) => (html.replace(/<[^<>]{0,2000}>/g, " ").match(WORD) ?? []).length

type Doc = Record<string, unknown>

/**
 * Article document (as stored in articles/{id}) → the copy anyone may read. Drafts-in-progress and
 * review-only fields are dropped; a locked story keeps only its preview and remembers its real length.
 * Counters (views, likes) are left out: the public copy owns them, so a republish must not reset them.
 */
export function publicCopyOf(full: Doc): { copy: Doc; body: Doc | null } {
  const live = (full.live ?? null) as (Doc & VersionLike) | null
  if (!live) return { copy: {}, body: null }
  const html = String(live.contentHtml ?? "")
  const locked = isLocked(live)
  const shownHtml = locked ? previewHtml(html, previewFraction(live)) : html
  const copy: Doc = { ...full }
  // Working copies (draft text, draft recording, submitted version), review-only fields and counters
  for (const k of ["submitted", "content", "views", "likes", "monetizedViews", "rebuttal", "review", "audiobookUrl", "audiobookDurationSec", "audiobookSource"])
    delete copy[k]
  const liveCopy: Doc = { ...live, contentHtml: shownHtml, locked, fullWordCount: wordCountOf(html) }
  // A locked voice post's recording is part of what's paid for: its URL goes with the body (F-14)
  const audioUrl = typeof live.audiobookUrl === "string" ? live.audiobookUrl : ""
  if (locked && audioUrl) {
    delete liveCopy.audiobookUrl
    liveCopy.audiobookLocked = true
  }
  copy.live = liveCopy
  // What older readers of the doc expect in `content`: the version readers see
  copy.content = shownHtml
  const body: Doc = {
    contentHtml: html,
    paywall: live.paywall ?? "FREE",
    paper: !!live.paper,
    authorId: full.authorId ?? "",
    audiobookUrl: audioUrl || null,
  }
  return { copy, body }
}

/** Whether a stored article should have a public copy at all */
export function isPubliclyPublished(full: Doc): boolean {
  return full.verificationStatus === "published" && !!full.live
}

/** Key for the monthly metered allowance, e.g. "uid_2026-11" */
export function meterKey(uid: string, at = new Date()): string {
  return `${uid}_${at.toISOString().slice(0, 7)}`
}
