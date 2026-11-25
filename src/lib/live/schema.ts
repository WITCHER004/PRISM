// Firestore document shapes for Prism, and converters between them and the app's types.
// Pure functions only (no SDK imports), so server components and the client share them.
//
//   users/{uid}                 UserDoc
//   articles/{id}               ArticleDoc        (drafts, submissions and published stories)
//   instant_ideas/{id}          IdeaDoc
//   margin_notes/{id}           MarginNoteDoc
//   panel_applications/{id}     PanelApplicationDoc
//   notifications/{id}          NotificationDoc
//   comments/{id}               CommentDoc
//   reviews/{postId}_{uid}      a reader's star rating + review
//
// Times are milliseconds since epoch, except users.createdAt/lastLoginAt (server timestamps).

import type { Post, Tag, User } from "@/lib/data"
import type { ArticleStatus, Phase1Report, ReviewTrack } from "@/lib/moderation/types"
import type { AdvancedPaper } from "@/lib/papers"
import type { CraftTelemetry } from "@/lib/craft"
import type { EmployeeAppeal, PanelVote } from "@/lib/elite/panel"
import type { PanelApplication, PanelApplicationStatus, Tier } from "@/lib/access"
import { tagFor } from "@/lib/topics"

export const COL = {
  users: "users",
  articles: "articles",
  ideas: "instant_ideas",
  marginNotes: "margin_notes",
  applications: "panel_applications",
  notifications: "notifications",
  comments: "comments",
  reviews: "reviews",
} as const

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** Timestamp | {seconds} | number | ISO string → ms (0 when missing) */
export function toMillis(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return Date.parse(v) || 0
  if (v && typeof v === "object") {
    const t = v as { toMillis?: () => number; seconds?: number; nanoseconds?: number }
    if (typeof t.toMillis === "function") return t.toMillis()
    if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds ?? 0) / 1e6)
  }
  return 0
}
export const toIso = (v: unknown) => {
  const ms = toMillis(v)
  return ms ? new Date(ms).toISOString() : ""
}
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback)
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback)
const bool = (v: unknown) => v === true
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/**
 * Firestore rejects `undefined` anywhere in a document. Drops undefined fields recursively, leaving
 * Firestore sentinels (serverTimestamp, increment…) and other class instances untouched.
 */
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(clean) as T
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = clean(v)
    return out as T
  }
  return value
}

export const DEFAULT_AVATAR = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "prism")}&backgroundColor=b6e3f4`

/** A URL-safe handle from a display name or email */
export function handleFrom(displayName: string | null | undefined, email: string | null | undefined, uid: string) {
  const base =
    (displayName ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "") ||
    (email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") ||
    "member" + uid.slice(0, 6).toLowerCase()
  return base.slice(0, 20)
}

/* ── users ────────────────────────────────────────────────────────────────── */

export interface UserDoc {
  uid: string
  email: string | null
  displayName: string
  handle: string
  photoURL: string | null
  bio: string
  tier: Tier
  isPanelMember: boolean
  panelApplicationStatus: PanelApplicationStatus
  isAdmin: boolean
  suspended?: boolean
  eliteSince?: number
  websiteUrl?: string
  twitterHandle?: string
  linkedinHandle?: string
  instagramHandle?: string
  githubHandle?: string
  emailDigest?: boolean
  emailReplies?: boolean
  createdAt?: unknown
  lastLoginAt?: unknown
}

/** A users/{uid} document, normalised (tolerates partial or older docs) */
export function readUserDoc(uid: string, d: Record<string, unknown>): UserDoc {
  const status = str(d.panelApplicationStatus, "none") as PanelApplicationStatus
  return {
    uid,
    email: typeof d.email === "string" ? d.email : null,
    displayName: str(d.displayName) || str(d.handle) || "Member",
    handle: str(d.handle) || handleFrom(str(d.displayName), str(d.email), uid),
    photoURL: typeof d.photoURL === "string" && d.photoURL ? d.photoURL : null,
    bio: str(d.bio),
    tier: d.tier === "elite" ? "elite" : "free",
    isPanelMember: bool(d.isPanelMember),
    panelApplicationStatus: ["none", "pending", "approved", "rejected"].includes(status) ? status : "none",
    isAdmin: bool(d.isAdmin),
    suspended: bool(d.suspended),
    eliteSince: d.eliteSince ? toMillis(d.eliteSince) : undefined,
    websiteUrl: str(d.websiteUrl),
    twitterHandle: str(d.twitterHandle),
    linkedinHandle: str(d.linkedinHandle),
    instagramHandle: str(d.instagramHandle),
    githubHandle: str(d.githubHandle),
    emailDigest: d.emailDigest !== false,
    emailReplies: d.emailReplies !== false,
    createdAt: d.createdAt,
    lastLoginAt: d.lastLoginAt,
  }
}

/** The public `User` shape the UI renders (author cards, profiles) */
export function userFromDoc(u: UserDoc, postCount = 0): User {
  return {
    id: u.uid,
    username: u.handle,
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: u.photoURL || DEFAULT_AVATAR(u.handle),
    websiteUrl: u.websiteUrl || undefined,
    twitterHandle: u.twitterHandle || undefined,
    githubHandle: u.githubHandle || undefined,
    linkedinHandle: u.linkedinHandle || undefined,
    instagramHandle: u.instagramHandle || undefined,
    role: "WRITER",
    isVerifiedHuman: false,
    followerCount: 0,
    followingCount: 0,
    postCount,
    createdAt: toIso(u.createdAt) || new Date(0).toISOString(),
  }
}

/* ── articles ─────────────────────────────────────────────────────────────── */

export type VerificationStatus = "draft" | "pending_employee" | "pending_panel" | "published" | "rejected"

export function verificationStatusOf(s: ArticleStatus): VerificationStatus {
  switch (s) {
    case "PENDING_EMPLOYEE_REVIEW":
      return "pending_employee"
    case "PENDING_PEER_PANEL":
    case "COUNTER_SUBMITTED":
      return "pending_panel"
    case "PUBLISHED":
      return "published"
    case "REJECTED":
    case "PHASE_1_FAILED":
      return "rejected"
    default:
      return "draft"
  }
}

export type PaywallChoice = "FREE" | "METERED" | "SUBSCRIBER" | "PAID"

/** "essay": a written story (optionally with a pre-recorded audiobook); "voice": the recording is the piece, with short show notes */
export type PostFormat = "essay" | "voice"

/** How the author's own narration was made */
export type AudiobookSource = "recorded" | "uploaded"

/** The author-narrated edition of a story (a Firebase Storage file under audiobooks/{uid}/) */
export interface AudiobookFields {
  postFormat?: PostFormat
  audiobookUrl?: string
  audiobookDurationSec?: number
  audiobookSource?: AudiobookSource
}

/** A version of the story (the working copy, the one under review, or the live one) */
export interface ArticleVersion extends AudiobookFields {
  title: string
  subtitle: string
  contentHtml: string
  tags: string[]
  paywall: PaywallChoice
  paper?: AdvancedPaper
  coverImageUrl?: string
  /** Set on public copies: the text above is only the preview of a locked story */
  locked?: boolean
  /** Set on public copies: the full story's word count (the preview is shorter) */
  fullWordCount?: number
  /** Set on public copies of locked stories: the recording exists, its URL comes with the unlocked body */
  audiobookLocked?: boolean
}

/** The workflow fields the store's Draft carries; mirrored 1:1 into the article document */
export interface ArticleWorkflow extends AudiobookFields {
  id: string
  authorUsername: string
  authorUid?: string
  authorName?: string
  authorAvatar?: string
  title: string
  subtitle: string
  contentHtml: string
  tags: string[]
  paywall: PaywallChoice
  paper?: AdvancedPaper
  coverImageUrl?: string
  craft?: CraftTelemetry
  originIdeaId?: string
  originIdeaText?: string
  voterIds?: string[]
  status: ArticleStatus
  slug: string
  createdAt?: string
  updatedAt: string
  phase1?: Phase1Report
  plagiarismPercent?: number
  submittedAt?: string
  review?: { reviewer: string; decision: "APPROVED" | "REJECTED"; notes: string; at: string }
  live?: ArticleVersion
  publishedAt?: string
  celebrated?: boolean
  track?: ReviewTrack
  submitted?: ArticleVersion
  panel?: PanelVote[]
  appeal?: EmployeeAppeal & { rejectedBy: string; rejectionNotes: string }
  panelPassed?: boolean
  liveAiPercent?: number
  panelReview?: boolean
  views?: number
  /** Unique signed-in, non-author reads: the only views that earn money (server-written) */
  monetizedViews?: number
  likes?: number
}

export interface ArticleDoc {
  // Requested top-level schema
  title: string
  subtitle: string
  content: string
  topic: string
  authorId: string
  authorName: string
  authorAvatar: string
  isAdvancedPaper: boolean
  requiredTier: Tier
  aiScore: number | null
  plagiarismScore: number | null
  verificationStatus: VerificationStatus
  peerVotes: PanelVote[]
  rebuttal: ArticleWorkflow["appeal"] | null
  views: number
  monetizedViews?: number
  likes: number
  originIdeaId: string | null
  voterIds: string[]
  createdAt: number
  // Everything else the workflow needs
  authorHandle: string
  workflowStatus: ArticleStatus
  slug: string
  tags: string[]
  paywall: PaywallChoice
  coverImageUrl: string | null
  audiobookUrl: string | null
  audiobookDurationSec: number | null
  audiobookSource: AudiobookSource | null
  postFormat: PostFormat
  /** True whenever the author's own voice is attached (a voice post, or an essay's audiobook) */
  authorNarrated: boolean
  paper: AdvancedPaper | null
  craft: CraftTelemetry | null
  originIdeaText: string | null
  phase1: Phase1Report | null
  review: ArticleWorkflow["review"] | null
  track: ReviewTrack | null
  submitted: ArticleVersion | null
  live: ArticleVersion | null
  panelPassed: boolean
  liveAiPercent: number | null
  panelReview: boolean | null
  celebrated: boolean
  updatedAt: number
  submittedAt: number | null
  publishedAt: number | null
}

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) || null : null)
const iso = (v: unknown) => (v === null || v === undefined || v === 0 ? undefined : toIso(v) || undefined)

/**
 * Store draft → Firestore document. `views`/`likes` are left out on purpose: they're counters that
 * readers increment, so the author's saves must never overwrite them.
 */
export function articleToDoc(d: ArticleWorkflow): Omit<ArticleDoc, "views" | "likes"> {
  const v = d.live ?? d.submitted ?? d
  const paper = d.paper ?? null
  return clean({
    title: d.title,
    subtitle: d.subtitle,
    content: d.contentHtml,
    topic: d.tags[0] ?? "",
    authorId: d.authorUid ?? "",
    authorName: d.authorName ?? d.authorUsername,
    authorAvatar: d.authorAvatar ?? "",
    isAdvancedPaper: !!(v.paper ?? paper),
    requiredTier: (v.paper ?? paper) ? "elite" : "free",
    aiScore: d.phase1?.aiPercent ?? null,
    plagiarismScore: d.plagiarismPercent ?? null,
    verificationStatus: verificationStatusOf(d.status),
    peerVotes: d.panel ?? [],
    rebuttal: d.appeal ?? null,
    originIdeaId: d.originIdeaId ?? null,
    voterIds: d.voterIds ?? [],
    createdAt: ms(d.createdAt) ?? ms(d.updatedAt) ?? Date.now(),
    authorHandle: d.authorUsername,
    workflowStatus: d.status,
    slug: d.slug,
    tags: d.tags,
    paywall: d.paywall,
    coverImageUrl: d.coverImageUrl ?? null,
    audiobookUrl: d.audiobookUrl ?? null,
    audiobookDurationSec: d.audiobookUrl ? Math.round(d.audiobookDurationSec ?? 0) : null,
    audiobookSource: d.audiobookUrl ? (d.audiobookSource ?? "uploaded") : null,
    postFormat: d.postFormat === "voice" ? "voice" : "essay",
    authorNarrated: !!d.audiobookUrl,
    paper,
    craft: d.craft ?? null,
    originIdeaText: d.originIdeaText ?? null,
    phase1: d.phase1 ?? null,
    review: d.review ?? null,
    track: d.track ?? null,
    submitted: d.submitted ?? null,
    live: d.live ?? null,
    panelPassed: !!d.panelPassed,
    liveAiPercent: d.liveAiPercent ?? null,
    panelReview: d.panelReview ?? null,
    celebrated: !!d.celebrated,
    updatedAt: ms(d.updatedAt) ?? Date.now(),
    submittedAt: ms(d.submittedAt),
    publishedAt: ms(d.publishedAt),
  })
}

const undef = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

/** The audiobook fields of a document or version, dropped entirely unless the URL is a real string */
export function audiobookFrom(
  d: { postFormat?: unknown; audiobookUrl?: unknown; audiobookDurationSec?: unknown; audiobookSource?: unknown } | null | undefined
): AudiobookFields {
  const format: AudiobookFields = d?.postFormat === "voice" ? { postFormat: "voice" } : {}
  if (!d || typeof d.audiobookUrl !== "string" || !d.audiobookUrl) return format
  const sec = typeof d.audiobookDurationSec === "number" && Number.isFinite(d.audiobookDurationSec) ? d.audiobookDurationSec : 0
  return {
    ...format,
    audiobookUrl: d.audiobookUrl,
    audiobookDurationSec: Math.max(0, Math.round(sec)),
    audiobookSource: d.audiobookSource === "recorded" ? "recorded" : "uploaded",
  }
}

/** The parts of a draft that make up a reviewable version (what gets submitted and goes live) */
export const versionOf = (d: ArticleVersion): ArticleVersion => ({
  title: d.title,
  subtitle: d.subtitle,
  contentHtml: d.contentHtml,
  tags: d.tags,
  paywall: d.paywall,
  paper: d.paper,
  coverImageUrl: d.coverImageUrl,
  ...audiobookFrom(d),
})

/** Firestore document → store draft */
export function articleFromDoc(id: string, raw: Record<string, unknown>): ArticleWorkflow {
  const d = raw as Partial<ArticleDoc>
  return {
    id,
    authorUsername: str(d.authorHandle) || str(d.authorName) || "unknown",
    authorUid: str(d.authorId) || undefined,
    authorName: str(d.authorName) || undefined,
    authorAvatar: str(d.authorAvatar) || undefined,
    title: str(d.title),
    subtitle: str(d.subtitle),
    contentHtml: str(d.content),
    tags: arr<string>(d.tags).length ? arr<string>(d.tags) : d.topic ? [d.topic] : [],
    paywall: (d.paywall as PaywallChoice) ?? "FREE",
    paper: undef(d.paper),
    coverImageUrl: undef(d.coverImageUrl),
    ...audiobookFrom(d),
    craft: undef(d.craft),
    originIdeaId: undef(d.originIdeaId),
    originIdeaText: undef(d.originIdeaText),
    voterIds: arr<string>(d.voterIds),
    status: (d.workflowStatus as ArticleStatus) ?? statusFromVerification(d.verificationStatus),
    slug: str(d.slug) || id,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
    phase1: undef(d.phase1),
    plagiarismPercent: undef(d.plagiarismScore),
    submittedAt: iso(d.submittedAt),
    review: undef(d.review),
    live: undef(d.live),
    publishedAt: iso(d.publishedAt),
    celebrated: !!d.celebrated,
    track: undef(d.track),
    submitted: undef(d.submitted),
    panel: arr<PanelVote>(d.peerVotes).length ? arr<PanelVote>(d.peerVotes) : undefined,
    appeal: undef(d.rebuttal),
    panelPassed: !!d.panelPassed,
    liveAiPercent: undef(d.liveAiPercent),
    panelReview: undef(d.panelReview),
    views: num(d.views),
    monetizedViews: num(d.monetizedViews),
    likes: num(d.likes),
  }
}

function statusFromVerification(v: VerificationStatus | undefined): ArticleStatus {
  switch (v) {
    case "pending_employee":
      return "PENDING_EMPLOYEE_REVIEW"
    case "pending_panel":
      return "PENDING_PEER_PANEL"
    case "published":
      return "PUBLISHED"
    case "rejected":
      return "REJECTED"
    default:
      return "DRAFT"
  }
}

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
export const wordsIn = (html: string) => (plain(html) ? plain(html).split(" ").length : 0)

function audiobookOf(v: ArticleVersion): Post["audiobook"] {
  const a = audiobookFrom(v)
  if (a.audiobookUrl) return { url: a.audiobookUrl, durationSec: a.audiobookDurationSec ?? 0, source: a.audiobookSource ?? "uploaded" }
  // Locked story: the player knows the recording exists; the server hands over its URL on unlock
  if (v.audiobookLocked)
    return { url: "", durationSec: Number(v.audiobookDurationSec ?? 0), source: v.audiobookSource === "recorded" ? "recorded" : "uploaded", locked: true }
  return undefined
}

/** A published article as the `Post` the reader pages render (the live version only) */
export function postFromArticle(a: ArticleWorkflow, author?: User): Post | null {
  const v = a.live
  if (!v || !a.publishedAt) return null
  const words = v.fullWordCount ?? wordsIn(v.contentHtml)
  const text = plain(v.contentHtml)
  const tags: Tag[] = v.tags.map((slug) => tagFor(slug))
  return {
    id: a.id,
    title: v.title || "Untitled story",
    subtitle: v.subtitle || undefined,
    slug: a.slug,
    excerpt: v.subtitle || (text.length > 220 ? text.slice(0, 217).trimEnd() + "…" : text),
    contentHtml: v.contentHtml,
    coverImageUrl: v.coverImageUrl ?? a.coverImageUrl,
    // Only the reviewed (live) narration is ever played to readers
    audiobook: audiobookOf(v),
    format: v.postFormat === "voice" && (v.audiobookUrl || v.audiobookLocked) ? "voice" : "essay",
    // A voice post takes as long as its recording; an essay as long as its words
    readingTimeMin:
      v.postFormat === "voice" && (v.audiobookUrl || v.audiobookLocked)
        ? Math.max(1, Math.round((v.audiobookDurationSec ?? 0) / 60))
        : Math.max(1, Math.round(words / 230)),
    wordCount: words,
    status: "PUBLISHED",
    paywallTier: v.paywall,
    paper: v.paper,
    publishedAt: a.publishedAt,
    tags,
    author: author ?? {
      id: a.authorUid ?? a.authorUsername,
      username: a.authorUsername,
      displayName: a.authorName ?? a.authorUsername,
      bio: "",
      avatarUrl: a.authorAvatar || DEFAULT_AVATAR(a.authorUsername),
      role: "WRITER",
      isVerifiedHuman: false,
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      createdAt: a.createdAt ?? a.publishedAt,
    },
    clapCount: a.likes ?? 0,
    commentCount: 0,
    bookmarkCount: 0,
    viewCount: a.views ?? 0,
    trustScore: a.liveAiPercent !== undefined ? Math.max(0, 100 - a.liveAiPercent) : 0,
  }
}

/* ── panel applications ───────────────────────────────────────────────────── */

export interface PanelApplicationDoc {
  userId: string
  userHandle: string
  userEmail: string | null
  userName: string
  domains: string[]
  portfolioUrl: string
  statement: string
  status: "pending" | "approved" | "rejected"
  createdAt: number
  decidedAt: number | null
  decidedBy: string | null
  decisionNote: string | null
}

export const applicationToDoc = (a: PanelApplication): PanelApplicationDoc =>
  clean({
    userId: a.uid ?? "",
    userHandle: a.username,
    userEmail: a.email ?? null,
    userName: a.displayName,
    domains: a.expertise,
    portfolioUrl: a.credentialsUrl,
    statement: a.statement,
    status: a.status,
    createdAt: ms(a.submittedAt) ?? Date.now(),
    decidedAt: ms(a.decidedAt),
    decidedBy: a.decidedBy ?? null,
    decisionNote: a.decisionNote ?? null,
  })

export const applicationFromDoc = (id: string, raw: Record<string, unknown>): PanelApplication => {
  const d = raw as Partial<PanelApplicationDoc>
  return {
    id,
    username: str(d.userHandle) || str(d.userName),
    uid: str(d.userId) || undefined,
    displayName: str(d.userName) || str(d.userHandle) || "Member",
    email: d.userEmail ?? null,
    expertise: arr<string>(d.domains),
    credentialsUrl: str(d.portfolioUrl),
    statement: str(d.statement),
    status: d.status === "approved" || d.status === "rejected" ? d.status : "pending",
    submittedAt: toIso(d.createdAt),
    decidedAt: iso(d.decidedAt),
    decidedBy: undef(d.decidedBy),
    decisionNote: undef(d.decisionNote),
  }
}

/* ── notifications ────────────────────────────────────────────────────────── */

export type NotificationType = "follow" | "clap" | "comment" | "system" | "review" | "idea_published"

export interface NotificationDoc {
  recipientId: string
  type: NotificationType
  message: string
  articleId: string | null
  href: string | null
  read: boolean
  createdAt: number
}

/* ── comments ─────────────────────────────────────────────────────────────── */

export interface CommentDoc {
  articleId: string
  parentId: string | null
  body: string
  authorId: string
  authorHandle: string
  authorName: string
  authorAvatar: string
  createdAt: number
}
