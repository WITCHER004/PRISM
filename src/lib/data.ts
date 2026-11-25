// Shared content types. The data itself lives in Firestore (see src/lib/live/schema.ts).

export type UserRole = "READER" | "WRITER" | "PUBLICATION_EDITOR" | "EMPLOYEE" | "REVIEWER" | "PEER_REVIEWER" | "ADMIN"
export type PostStatus =
  | "DRAFT"
  | "PHASE_1_FAILED"
  | "PENDING_EMPLOYEE_REVIEW"
  | "PENDING_PEER_PANEL"
  | "COUNTER_SUBMITTED"
  | "PUBLISHED"
  | "REJECTED"
  | "SCHEDULED"
  | "ARCHIVED"
import type { AdvancedPaper } from "@/lib/papers"

export type PaywallTier = "FREE" | "METERED" | "SUBSCRIBER" | "PAID"

export interface User {
  id: string
  username: string
  displayName: string
  bio: string
  avatarUrl: string
  headerImageUrl?: string
  websiteUrl?: string
  twitterHandle?: string
  githubHandle?: string
  linkedinHandle?: string
  instagramHandle?: string
  role: UserRole
  isVerifiedHuman: boolean
  followerCount: number
  followingCount: number
  postCount: number
  createdAt: string
}

export interface Post {
  id: string
  title: string
  subtitle?: string
  slug: string
  excerpt: string
  contentHtml: string
  coverImageUrl?: string
  /** The author's own narration of the live version, when they attached one */
  /** `locked`: a paywalled story's recording; `url` is empty until the server grants it */
  audiobook?: { url: string; durationSec: number; source: "recorded" | "uploaded"; locked?: boolean }
  /** "voice": the recording is the piece and the body holds show notes */
  format?: "essay" | "voice"
  readingTimeMin: number
  wordCount: number
  status: PostStatus
  paywallTier: PaywallTier
  paywallPrice?: number
  /** Set on Advanced Papers: Elite members read in full, everyone else gets the abstract + opening */
  paper?: AdvancedPaper
  publishedAt: string
  tags: Tag[]
  author: User
  clapCount: number
  commentCount: number
  bookmarkCount: number
  viewCount: number
  trustScore: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  postCount?: number
}

export interface Comment {
  id: string
  author: User
  body: string
  createdAt: string
  replies?: Comment[]
}

// ─── Live account directory ──────────────────────────────────────────────────
// Filled from Firestore `users` by the client sync layer (src/lib/live/sync.ts). Empty on the server:
// server components read users through src/lib/server/content.ts instead.

let directory = new Map<string, User>()

export function setDirectory(users: User[]) {
  directory = new Map(users.map((u) => [u.username, u]))
}

export function findAccount(username: string | null | undefined): User | undefined {
  return username ? directory.get(username) : undefined
}

export function allAccounts(): User[] {
  return [...directory.values()]
}
