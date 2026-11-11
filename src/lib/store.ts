"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { MOCK_USERS, PEER_REVIEWERS, findAccount } from "@/lib/data"
import type { ArticleStatus, Phase1Report, ReviewTrack } from "@/lib/moderation/types"
import { canReview, canTransition, isPeerReviewer, MIN_WORDS_FOR_SUBMISSION, phase1Outcome, trackFor } from "@/lib/moderation/workflow"
import { reviewKey, REVIEW_BODY_MAX, type ArticleReview } from "@/lib/reviews"
import {
  CLOSING_NOTE_MIN,
  COUNTER_REASON_MIN,
  DEMO_PAYOUT_SETTLE_MS,
  FAILURE_REASON_MIN,
  MIN_PAYOUT_USD,
  TEXT_MAX,
} from "@/lib/elite/config"
import { SEED_SUBSCRIPTIONS } from "@/lib/elite/demo"
import {
  assignPanel,
  canCounterVote,
  canReconsiderVote,
  panelStatus,
  reconsiderationStatus,
  resolveVote,
  type EmployeeAppeal,
  type PanelDecision,
  type PanelVote,
} from "@/lib/elite/panel"
import { activateElite, isEliteActive, type Subscription } from "@/lib/elite/subscription"
import { computeWallet, isDuplicateView, priceView, type PayoutRecord, type ViewEvent } from "@/lib/elite/wallet"

// Prism runs without a database in demo mode, so this store is the "backend":
// everything a reader or writer does is kept here and saved to localStorage.

type Theme = "light" | "dark" | "sepia"
type FontSize = "sm" | "md" | "lg" | "xl"
export type Plan = "reader" | "patron"
export type PaywallChoice = "FREE" | "METERED" | "SUBSCRIBER" | "PAID"

export interface LocalComment {
  id: string
  postId: string
  parentId?: string
  author: string // username
  body: string
  createdAt: string
}

/** The version readers see: copied from the working draft when a reviewer approves it */
export interface LiveVersion {
  title: string
  subtitle: string
  contentHtml: string
  tags: string[]
  paywall: PaywallChoice
}

export interface ReviewOutcome {
  reviewer: string // username
  decision: "APPROVED" | "REJECTED"
  notes: string
  at: string
}

export interface Draft {
  id: string
  /** Username of the writer (drafts from before v2 belong to the sample writer) */
  authorUsername: string
  title: string
  subtitle: string
  contentHtml: string
  tags: string[]
  paywall: PaywallChoice
  /** Status of the latest submission — see src/lib/moderation/workflow.ts */
  status: ArticleStatus
  slug: string
  updatedAt: string
  /** Latest Phase 1 (AI check) report */
  phase1?: Phase1Report
  submittedAt?: string
  /** Latest Phase 2 decision */
  review?: ReviewOutcome
  /** Last approved version; present once the story has been published */
  live?: LiveVersion
  publishedAt?: string
  /** The author has seen the "you're live" share prompt for the current live version */
  celebrated?: boolean
  /** Phase 2 route of the latest submission (default EMPLOYEE) */
  track?: ReviewTrack
  /** Snapshot of the version under review; this is what gets published */
  submitted?: LiveVersion
  /** Peer panel votes for the latest PEER_PANEL submission */
  panel?: PanelVote[]
  /** Writer's counter-reason on an employee rejection */
  appeal?: EmployeeAppeal & { rejectedBy: string; rejectionNotes: string }
  /** The live version went through (and passed) the peer panel */
  panelPassed?: boolean
  /** Phase 1 AI score of the live version */
  liveAiPercent?: number
}

/** A counter-reason target: a panel vote id, or "employee" for an employee rejection */
export type CounterTarget = string

export type ReviewInput = { rating: number; body: string }
type Result = { ok: true } | { ok: false; error: string }

export interface AppNotification {
  id: string
  kind: "follow" | "clap" | "comment" | "system" | "review"
  /** Who it's for; unset = everyone (sample notifications) */
  to?: string
  text: string
  href?: string
  createdAt: string
  read: boolean
}

export interface Profile {
  displayName: string
  bio: string
  websiteUrl: string
  twitterHandle: string
  linkedinHandle: string
  instagramHandle: string
  githubHandle: string
  /** Data URI or storage URL from /api/profile/avatar; empty = default avatar */
  avatarUrl: string
  emailDigest: boolean
  emailReplies: boolean
}

export interface Toast {
  id: number
  message: string
  tone: "default" | "success" | "error"
  action?: { label: string; href: string }
}

interface UIState {
  // reading preferences
  theme: Theme
  fontSize: FontSize
  focusMode: boolean
  ttsEnabled: boolean
  setTheme: (theme: Theme) => void
  setFontSize: (size: FontSize) => void
  toggleFocusMode: () => void
  toggleTTS: () => void

  // session (demo auth)
  currentUser: string | null // username of the signed-in user
  setCurrentUser: (username: string | null) => void
  signIn: (email: string, name?: string) => string
  signOut: () => void

  // reader interactions
  clappedPosts: Record<string, number>
  bookmarkedPosts: Set<string>
  followedUsers: Set<string>
  unlockedPosts: Set<string>
  pollVotes: Record<string, number>
  likedComments: Set<string>
  clapPost: (postId: string, count: number) => void
  toggleBookmark: (postId: string) => void
  toggleFollow: (username: string) => void
  unlockPost: (postId: string) => void
  votePoll: (pollId: string, option: number) => void
  toggleCommentLike: (commentId: string) => void

  // comments added in this browser
  comments: LocalComment[]
  addComment: (c: Omit<LocalComment, "id" | "createdAt" | "author">) => LocalComment | null

  // writing
  drafts: Record<string, Draft>
  saveDraft: (d: Pick<Draft, "id" | "title" | "subtitle" | "contentHtml" | "tags" | "paywall">) => Draft
  deleteDraft: (id: string) => void
  /** Phase 1 result → PHASE_1_FAILED or PENDING_EMPLOYEE_REVIEW. Elite articles go on to the panel after that. */
  recordPhase1: (id: string, report: Phase1Report) => Draft | null
  /** Author pulls a submission out of the queue to keep editing */
  withdrawSubmission: (id: string) => void
  /** Phase 2: an employee approves (publishes) or requests changes */
  decideReview: (id: string, decision: ReviewOutcome["decision"], notes: string) => Result
  markCelebrated: (id: string) => void

  // Elite peer panel + counter-reasons
  /** A peer-panel member casts PASS or FAIL (FAIL needs a reason) */
  castPanelVote: (id: string, decision: PanelDecision, failureReason?: string) => Result
  /** Writer appeals a FAIL vote or an employee rejection */
  submitCounter: (id: string, target: CounterTarget, reason: string, clarification?: string) => Result
  /** Dissenting member or staff lead accepts (FAIL → PASS) or upholds the original decision */
  reconsiderCounter: (id: string, target: CounterTarget, verdict: "ACCEPT" | "UPHOLD", note: string) => Result
  /** Dev: casts every outstanding panel vote, `passes` of the ten as PASS */
  devFillPanel: (id: string, passes: number) => void

  // Elite subscription (keyed by username)
  subscriptions: Record<string, Subscription>
  upgradeToElite: (reference: string) => Result
  cancelElite: () => void

  // Monetization
  /** Anonymous browser fingerprint for view dedupe when signed out */
  viewerId: string
  views: ViewEvent[]
  payouts: PayoutRecord[]
  /** Logs a read; deduped per reader per article per 24h */
  recordView: (postId: string, author: string) => { counted: boolean; monetized: boolean }
  /** Dev: adds `count` unique reader views spread over the last two weeks */
  devSimulateViews: (author: string, postIds: string[], count: number) => number
  requestPayout: () => Result & { amount?: number }
  /** Demo: payouts settle after DEMO_PAYOUT_SETTLE_MS */
  settlePayouts: () => void

  // reader reviews & ratings (key: postId:username; null = deleted)
  reviews: Record<string, ArticleReview | null>
  saveReview: (postId: string, postAuthor: string, input: ReviewInput) => Result
  deleteReview: (postId: string) => void

  // membership / money (simulated)
  plan: Plan | null
  tips: { authorUsername: string; amount: number; at: string }[]
  setPlan: (plan: Plan | null) => void
  recordTip: (authorUsername: string, amount: number) => void

  // newsletter (writer side, simulated)
  newsletterSubscribers: string[]
  addSubscriber: (email: string) => boolean

  // profile + settings
  profile: Profile
  updateProfile: (p: Partial<Profile>) => void
  /** Profiles of accounts used earlier in this browser, restored on switching back */
  savedProfiles: Record<string, Profile>

  // notifications
  notifications: AppNotification[]
  markAllRead: () => void
  markRead: (id: string) => void

  // transient feedback (not persisted)
  toasts: Toast[]
  toast: (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void
  dismissToast: (id: number) => void
}

const now = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 10)
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)

const me = MOCK_USERS[0]

const CANNED_FAIL_REASONS = [
  "The central claim relies on a single anecdote; I'd want at least one independent source before calling it general.",
  "The conclusion goes further than the evidence presented. The final section should be scoped to what was observed.",
  "Key terms are used loosely. Define what you mean by the main concept before drawing comparisons.",
  "Methodology is unclear: readers can't tell how the examples were chosen or whether they are representative.",
]

/** The reviewed version of a draft becomes the live one */
function publishDraft(d: Draft, at: string): Draft {
  const v = d.submitted ?? { title: d.title, subtitle: d.subtitle, contentHtml: d.contentHtml, tags: d.tags, paywall: d.paywall }
  return { ...d, status: "PUBLISHED", live: v, publishedAt: d.publishedAt ?? at, celebrated: false, liveAiPercent: d.phase1?.aiPercent }
}

const titleOf = (d: Draft) => (d.submitted?.title ?? d.title).trim() || "Untitled story"

function defaultProfile(username: string): Profile {
  const u = findAccount(username) ?? me
  return {
    displayName: u.displayName,
    bio: u.bio,
    websiteUrl: u.websiteUrl ?? "",
    twitterHandle: u.twitterHandle ?? "",
    linkedinHandle: u.linkedinHandle ?? "",
    instagramHandle: u.instagramHandle ?? "",
    githubHandle: u.githubHandle ?? "",
    avatarUrl: "",
    emailDigest: true,
    emailReplies: true,
  }
}

/** Switch the active account: stash the old account's profile, restore (or create) the new one's */
function switchAccount(s: Pick<UIState, "currentUser" | "profile" | "savedProfiles">, next: string | null) {
  if (next === s.currentUser) return {}
  const savedProfiles = s.currentUser ? { ...s.savedProfiles, [s.currentUser]: s.profile } : s.savedProfiles
  return {
    currentUser: next,
    savedProfiles,
    profile: next ? (savedProfiles[next] ?? defaultProfile(next)) : s.profile,
  }
}
const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: "n1", kind: "follow", text: "Priya Rao started following you", href: "/priyarao", createdAt: "2026-11-02T08:10:00.000Z", read: false },
  { id: "n2", kind: "clap", text: "Your story “The Hidden Cost of Distributed Transactions” passed 4,800 claps", href: "/alexchen/hidden-cost-distributed-transactions", createdAt: "2026-11-01T19:30:00.000Z", read: false },
  { id: "n3", kind: "comment", text: "Marcus Williams responded to your story", href: "/alexchen/hidden-cost-distributed-transactions#comments", createdAt: "2026-11-01T12:05:00.000Z", read: true },
]

let toastSeq = 0
const MAX_VIEW_EVENTS = 20000

/** Draws 10 panelists (never the author) and notifies them. Throws if there aren't enough reviewers. */
function sendToPanel(d: Draft, at: string): { draft: Draft; notes: AppNotification[] } {
  const panel: PanelVote[] = assignPanel(
    PEER_REVIEWERS.map((u) => u.username),
    d.authorUsername
  ).map((reviewer) => ({ id: "pv_" + uid(), reviewer, decision: null }))
  const draft: Draft = { ...d, status: "PENDING_PEER_PANEL", panel }
  const notes: AppNotification[] = panel.map((v) => ({
    id: "n_" + uid(),
    kind: "review",
    to: v.reviewer,
    text: `You've been assigned to the peer panel for “${titleOf(d)}”`,
    href: "/review-dashboard?tab=panel",
    createdAt: at,
    read: false,
  }))
  return { draft, notes }
}

/** Writes a panel change and moves the article to whatever status the votes now imply */
function applyPanel(s: UIState, d: Draft, at: string): Partial<UIState> {
  const before = d.status
  const next = d.panel ? panelStatus(d.panel) : d.status
  let updated: Draft = { ...d, status: next }
  const notes: AppNotification[] = []
  const title = titleOf(d)
  const notify = (text: string, href: string) =>
    notes.push({ id: "n_" + uid(), kind: "review", to: d.authorUsername, text, href, createdAt: at, read: false })
  if (next === "PUBLISHED" && before !== "PUBLISHED") {
    updated = { ...publishDraft(updated, at), panelPassed: true }
    notify(`“${title}” passed the peer panel and is now live`, `/story/${d.id}`)
  } else if (next === "REJECTED" && before === "PENDING_PEER_PANEL") {
    notify(`The peer panel didn't reach consensus on “${title}”. You can submit counter-reasons.`, `/submissions/${d.id}`)
  } else if (next === "REJECTED" && before === "COUNTER_SUBMITTED") {
    notify(`Your counter-reasons on “${title}” were reviewed`, `/submissions/${d.id}`)
  }
  return { drafts: { ...s.drafts, [d.id]: updated }, notifications: [...notes, ...s.notifications] }
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "light",
      fontSize: "md",
      focusMode: false,
      ttsEnabled: true, // "Read aloud" (Listen button on articles) is on unless turned off in Settings
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      toggleTTS: () => set((s) => ({ ttsEnabled: !s.ttsEnabled })),

      currentUser: me.username, // demo: start signed in as the sample writer
      setCurrentUser: (currentUser) => set((s) => switchAccount(s, currentUser)),
      signIn: (email, name) => {
        // Demo auth: a known sample user's email maps to them; anyone else signs in as the sample writer
        const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
        const match = findAccount(local)
        const username = match ? match.username : me.username
        set((s) => {
          const switched = switchAccount(s, username)
          const profile = switched.profile ?? s.profile
          return { ...switched, profile: name ? { ...profile, displayName: name } : profile }
        })
        return username
      },
      signOut: () =>
        set((s) => ({
          currentUser: null,
          savedProfiles: s.currentUser ? { ...s.savedProfiles, [s.currentUser]: s.profile } : s.savedProfiles,
        })),

      clappedPosts: {},
      bookmarkedPosts: new Set<string>(),
      followedUsers: new Set<string>(["priyarao", "marcuswilliams"]),
      unlockedPosts: new Set<string>(),
      pollVotes: {},
      likedComments: new Set<string>(),
      clapPost: (postId, count) =>
        set((s) => ({
          clappedPosts: { ...s.clappedPosts, [postId]: Math.min(50, (s.clappedPosts[postId] ?? 0) + count) },
        })),
      toggleBookmark: (postId) =>
        set((s) => {
          const next = new Set(s.bookmarkedPosts)
          if (next.has(postId)) next.delete(postId)
          else next.add(postId)
          return { bookmarkedPosts: next }
        }),
      toggleFollow: (username) =>
        set((s) => {
          const next = new Set(s.followedUsers)
          if (next.has(username)) next.delete(username)
          else next.add(username)
          return { followedUsers: next }
        }),
      unlockPost: (postId) => set((s) => ({ unlockedPosts: new Set(s.unlockedPosts).add(postId) })),
      votePoll: (pollId, option) => set((s) => ({ pollVotes: { ...s.pollVotes, [pollId]: option } })),
      toggleCommentLike: (commentId) =>
        set((s) => {
          const next = new Set(s.likedComments)
          if (next.has(commentId)) next.delete(commentId)
          else next.add(commentId)
          return { likedComments: next }
        }),

      comments: [],
      addComment: (c) => {
        const author = get().currentUser
        if (!author || !c.body.trim()) return null
        const comment: LocalComment = { ...c, body: c.body.trim(), id: "c_" + uid(), author, createdAt: now() }
        set((s) => ({ comments: [...s.comments, comment] }))
        return comment
      },

      drafts: {},
      saveDraft: (d) => {
        const prev = get().drafts[d.id]
        const draft: Draft = {
          ...prev,
          ...d,
          authorUsername: prev?.authorUsername ?? get().currentUser ?? me.username,
          status: prev?.status ?? "DRAFT",
          // The address is fixed once a version has gone live
          slug: prev?.live ? prev.slug : `${slugify(d.title) || "untitled"}-${d.id.slice(-4)}`,
          updatedAt: now(),
        }
        set((s) => ({ drafts: { ...s.drafts, [d.id]: draft } }))
        return draft
      },
      recordPhase1: (id, report) => {
        const d = get().drafts[id]
        if (!d) return null
        // Same gate the server applies: 150 words
        if (report.wordCount < MIN_WORDS_FOR_SUBMISSION) return null
        const next = phase1Outcome(report.aiPercent)
        if (!canTransition(d.status, next)) return null
        // The route is fixed by the writer's plan at submission time
        const track = trackFor(isEliteActive(get().subscriptions[d.authorUsername]))
        const updated: Draft = {
          ...d,
          status: next,
          phase1: report,
          submittedAt: now(),
          review: undefined,
          appeal: undefined,
          track,
          panel: undefined,
          panelPassed: undefined,
          submitted: { title: d.title, subtitle: d.subtitle, contentHtml: d.contentHtml, tags: d.tags, paywall: d.paywall },
        }
        set((s) => ({ drafts: { ...s.drafts, [id]: updated } }))
        return updated
      },
      withdrawSubmission: (id) => {
        const d = get().drafts[id]
        if (!d || (d.status !== "PENDING_EMPLOYEE_REVIEW" && d.status !== "PENDING_PEER_PANEL")) return
        // A live story stays live; an unpublished one goes back to being a draft
        set((s) => ({ drafts: { ...s.drafts, [id]: { ...d, status: d.live ? "PUBLISHED" : "DRAFT", panel: undefined } } }))
      },
      decideReview: (id, decision, notes) => {
        const reviewer = get().currentUser
        const d = get().drafts[id]
        if (!reviewer) return { ok: false, error: "Sign in as a reviewer." }
        if (!canReview(findAccount(reviewer)?.role))
          return { ok: false, error: "Only reviewers can approve or reject stories." }
        if (!d || d.status !== "PENDING_EMPLOYEE_REVIEW") return { ok: false, error: "This story is no longer waiting for review." }
        if (d.authorUsername === reviewer) return { ok: false, error: "You can't review your own story." }
        if (decision === "REJECTED" && notes.trim().length < 10)
          return { ok: false, error: "Tell the author what to change (10+ characters)." }

        const at = now()
        const review: ReviewOutcome = { reviewer, decision, notes: notes.trim(), at }
        const title = titleOf(d)
        // Elite: an employee approval sends the article on to the 10-member panel instead of publishing
        const toPanel = decision === "APPROVED" && d.track === "PEER_PANEL"
        let updated: Draft
        let panelNotes: AppNotification[] = []
        if (toPanel) {
          try {
            const sent = sendToPanel({ ...d, review }, at)
            updated = sent.draft
            panelNotes = sent.notes
          } catch {
            return { ok: false, error: "Not enough peer reviewers to form a panel." }
          }
        } else {
          updated = decision === "APPROVED" ? { ...publishDraft(d, at), review } : { ...d, status: "REJECTED", review }
        }
        const note: AppNotification = {
          id: "n_" + uid(),
          kind: "review",
          to: d.authorUsername,
          text: toPanel
            ? `“${title}” passed employee review and is now with the 10-member peer panel`
            : decision === "APPROVED"
              ? `“${title}” passed review and is now live`
              : `“${title}” needs changes before it can be published`,
          href: decision === "APPROVED" && !toPanel ? `/story/${id}` : `/submissions/${id}`,
          createdAt: at,
          read: false,
        }
        set((s) => ({ drafts: { ...s.drafts, [id]: updated }, notifications: [note, ...panelNotes, ...s.notifications] }))
        return { ok: true }
      },
      markCelebrated: (id) =>
        set((s) => (s.drafts[id] ? { drafts: { ...s.drafts, [id]: { ...s.drafts[id], celebrated: true } } } : {})),

      castPanelVote: (id, decision, failureReason) => {
        const me = get().currentUser
        const d = get().drafts[id]
        if (!me || !isPeerReviewer(findAccount(me)?.role)) return { ok: false, error: "Only peer-panel members can vote." }
        if (!d?.panel || d.status !== "PENDING_PEER_PANEL") return { ok: false, error: "This paper isn't waiting for panel votes." }
        const vote = d.panel.find((v) => v.reviewer === me)
        if (!vote) return { ok: false, error: "You aren't on this paper's panel." }
        if (vote.decision) return { ok: false, error: "You've already voted on this paper." }
        const reason = failureReason?.trim() ?? ""
        if (decision === "FAIL" && reason.length < FAILURE_REASON_MIN)
          return { ok: false, error: `Explain why it fails (${FAILURE_REASON_MIN}+ characters).` }
        if (reason.length > TEXT_MAX) return { ok: false, error: `Keep it under ${TEXT_MAX} characters.` }
        const at = now()
        const panel = d.panel.map((v) =>
          v.id === vote.id ? { ...v, decision, failureReason: decision === "FAIL" ? reason : undefined, decidedAt: at } : v
        )
        set((s) => applyPanel(s, { ...d, panel }, at))
        return { ok: true }
      },

      devFillPanel: (id, passes) => {
        const d = get().drafts[id]
        if (!d?.panel || d.status !== "PENDING_PEER_PANEL") return
        let passCount = d.panel.filter((v) => v.decision === "PASS").length
        const at = now()
        let k = 0
        const panel = d.panel.map((v): PanelVote => {
          if (v.decision) return v
          if (passCount < passes) {
            passCount++
            return { ...v, decision: "PASS", decidedAt: at }
          }
          return { ...v, decision: "FAIL", failureReason: CANNED_FAIL_REASONS[k++ % CANNED_FAIL_REASONS.length], decidedAt: at }
        })
        set((s) => applyPanel(s, { ...d, panel }, at))
      },

      submitCounter: (id, target, reason, clarification) => {
        const me = get().currentUser
        const d = get().drafts[id]
        if (!d || d.authorUsername !== me) return { ok: false, error: "Only the author can submit a counter-reason." }
        const text = reason.trim()
        const extra = clarification?.trim() || undefined
        if (text.length < COUNTER_REASON_MIN) return { ok: false, error: `Make your case in ${COUNTER_REASON_MIN}+ characters.` }
        if (text.length > TEXT_MAX || (extra?.length ?? 0) > TEXT_MAX) return { ok: false, error: `Keep it under ${TEXT_MAX} characters.` }
        const at = now()
        const counter = { reason: text, clarification: extra, submittedAt: at }

        if (target === "employee") {
          // Employee rejections (no panel yet) are appealed as a whole; panel FAILs are appealed vote by vote
          if (d.status !== "REJECTED" || d.panel || d.review?.decision !== "REJECTED" || d.appeal)
            return { ok: false, error: "This rejection can't be appealed." }
          const updated: Draft = {
            ...d,
            status: "COUNTER_SUBMITTED",
            appeal: { counter, rejectedBy: d.review.reviewer, rejectionNotes: d.review.notes },
          }
          const note: AppNotification = {
            id: "n_" + uid(),
            kind: "review",
            to: d.review.reviewer,
            text: `The author of “${titleOf(d)}” submitted a counter-reason to your rejection`,
            href: "/review-dashboard?tab=counters",
            createdAt: at,
            read: false,
          }
          set((s) => ({ drafts: { ...s.drafts, [id]: updated }, notifications: [note, ...s.notifications] }))
          return { ok: true }
        }

        const vote = d.panel?.find((v) => v.id === target)
        if (!d.panel || !vote || !canCounterVote(vote, d.status)) return { ok: false, error: "This vote can't be appealed." }
        const panel = d.panel.map((v) => (v.id === vote.id ? { ...v, counter } : v))
        const note: AppNotification = {
          id: "n_" + uid(),
          kind: "review",
          to: vote.reviewer,
          text: `The author of “${titleOf(d)}” submitted a counter-reason to your FAIL vote`,
          href: "/review-dashboard?tab=counters",
          createdAt: at,
          read: false,
        }
        set((s) => ({ drafts: { ...s.drafts, [id]: { ...d, panel, status: "COUNTER_SUBMITTED" } }, notifications: [note, ...s.notifications] }))
        return { ok: true }
      },

      reconsiderCounter: (id, target, verdict, note) => {
        const me = get().currentUser
        const d = get().drafts[id]
        if (!me) return { ok: false, error: "Sign in as a reviewer." }
        if (!d || d.status !== "COUNTER_SUBMITTED") return { ok: false, error: "There's no open counter-reason on this article." }
        if (d.authorUsername === me) return { ok: false, error: "You can't rule on your own appeal." }
        const text = note.trim()
        if (verdict === "UPHOLD" && text.length < CLOSING_NOTE_MIN)
          return { ok: false, error: `Add a closing note for the writer (${CLOSING_NOTE_MIN}+ characters).` }
        if (text.length > TEXT_MAX) return { ok: false, error: `Keep it under ${TEXT_MAX} characters.` }
        const staff = canReview(findAccount(me)?.role)
        const at = now()

        if (target === "employee") {
          if (!staff) return { ok: false, error: "Only Prism staff can reconsider an employee rejection." }
          if (!d.appeal || reconsiderationStatus(d.appeal) !== "PENDING") return { ok: false, error: "This appeal was already decided." }
          const appeal: Draft["appeal"] = {
            ...d.appeal,
            reconsideration: { status: verdict === "ACCEPT" ? "ACCEPTED" : "UPHELD", note: text, by: me, at },
          }
          const approved: Draft = { ...d, appeal, review: { reviewer: me, decision: "APPROVED", notes: text, at } }
          // An accepted Elite appeal counts as the employee approval, so the article moves on to the panel
          const toPanel = verdict === "ACCEPT" && d.track === "PEER_PANEL"
          let updated: Draft
          let panelNotes: AppNotification[] = []
          if (toPanel) {
            try {
              const sent = sendToPanel(approved, at)
              updated = sent.draft
              panelNotes = sent.notes
            } catch {
              return { ok: false, error: "Not enough peer reviewers to form a panel." }
            }
          } else {
            updated = verdict === "ACCEPT" ? publishDraft(approved, at) : { ...d, status: "REJECTED", appeal }
          }
          const n: AppNotification = {
            id: "n_" + uid(),
            kind: "review",
            to: d.authorUsername,
            text: toPanel
              ? `Your counter-reason was accepted — “${titleOf(d)}” is now with the peer panel`
              : verdict === "ACCEPT"
                ? `Your counter-reason was accepted — “${titleOf(d)}” is now live`
                : `Your counter-reason on “${titleOf(d)}” was reviewed; the rejection stands`,
            href: verdict === "ACCEPT" && !toPanel ? `/story/${id}` : `/submissions/${id}`,
            createdAt: at,
            read: false,
          }
          set((s) => ({ drafts: { ...s.drafts, [id]: updated }, notifications: [n, ...panelNotes, ...s.notifications] }))
          return { ok: true }
        }

        const vote = d.panel?.find((v) => v.id === target)
        if (!d.panel || !vote) return { ok: false, error: "Vote not found." }
        if (!canReconsiderVote(vote, me, staff))
          return { ok: false, error: "Only the dissenting panel member or a panel lead can rule on this." }
        const panel = d.panel.map((v) => (v.id === vote.id ? resolveVote(v, verdict, text, me, at) : v))
        set((s) => applyPanel(s, { ...d, panel }, at))
        return { ok: true }
      },

      subscriptions: SEED_SUBSCRIPTIONS,
      upgradeToElite: (reference) => {
        const me = get().currentUser
        if (!me) return { ok: false, error: "Sign in to upgrade." }
        const sub = activateElite("mock", reference)
        const n: AppNotification = {
          id: "n_" + uid(),
          kind: "system",
          to: me,
          text: "Welcome to Elite. You've unlocked the Elite Author badge, per-view earnings and peer-panel review.",
          href: "/dashboard/earnings",
          createdAt: now(),
          read: false,
        }
        set((s) => ({ subscriptions: { ...s.subscriptions, [me]: sub }, notifications: [n, ...s.notifications] }))
        return { ok: true }
      },
      cancelElite: () => {
        const me = get().currentUser
        const sub = me ? get().subscriptions[me] : undefined
        if (!me || !sub) return
        set((s) => ({ subscriptions: { ...s.subscriptions, [me]: { ...sub, subscriptionStatus: "INACTIVE" } } }))
      },

      viewerId: "anon_" + uid() + uid(),
      views: [],
      payouts: [],
      recordView: (postId, author) => {
        const s = get()
        const viewerKey = s.currentUser ?? s.viewerId
        if (isDuplicateView(s.views, postId, viewerKey)) return { counted: false, monetized: false }
        const { monetized, amount } = priceView(isEliteActive(s.subscriptions[author]), viewerKey === author)
        const event: ViewEvent = { id: "v_" + uid(), postId, author, viewerKey, at: now(), monetized, amount }
        set((st) => ({ views: [...st.views, event].slice(-MAX_VIEW_EVENTS) }))
        return { counted: true, monetized }
      },
      devSimulateViews: (author, postIds, count) => {
        if (!postIds.length || count <= 0) return 0
        const elite = isEliteActive(get().subscriptions[author])
        const t = Date.now()
        const events: ViewEvent[] = Array.from({ length: count }, (_, i) => {
          // Skewed toward recent days so the chart has a shape
          const ageMs = Math.floor(Math.pow(Math.random(), 1.6) * 14 * 24 * 3600 * 1000)
          const { monetized, amount } = priceView(elite, false)
          return {
            id: "v_" + uid(),
            postId: postIds[i % postIds.length],
            author,
            viewerKey: `sim_${uid()}${i}`,
            at: new Date(t - ageMs).toISOString(),
            monetized,
            amount,
          }
        })
        set((s) => ({ views: [...s.views, ...events].slice(-MAX_VIEW_EVENTS) }))
        return events.filter((e) => e.monetized).length
      },
      requestPayout: () => {
        const s = get()
        const me = s.currentUser
        if (!me) return { ok: false, error: "Sign in first." }
        if (!isEliteActive(s.subscriptions[me])) return { ok: false, error: "Payouts are an Elite feature." }
        const wallet = computeWallet(me, s.views, s.payouts)
        const amount = Math.floor(wallet.availableBalance * 100) / 100
        if (amount < MIN_PAYOUT_USD) return { ok: false, error: `You can withdraw once your balance reaches $${MIN_PAYOUT_USD.toFixed(2)}.` }
        const payout: PayoutRecord = { id: "po_" + uid().toUpperCase(), username: me, amount, status: "PENDING", requestedAt: now() }
        set((st) => ({ payouts: [payout, ...st.payouts] }))
        return { ok: true, amount }
      },
      settlePayouts: () => {
        const cutoff = Date.now() - DEMO_PAYOUT_SETTLE_MS
        const due = get().payouts.some((p) => p.status === "PENDING" && Date.parse(p.requestedAt) < cutoff)
        if (!due) return
        set((s) => ({
          payouts: s.payouts.map((p): PayoutRecord =>
            p.status === "PENDING" && Date.parse(p.requestedAt) < cutoff
              ? { ...p, status: "PAID", paidAt: new Date(Date.parse(p.requestedAt) + DEMO_PAYOUT_SETTLE_MS).toISOString() }
              : p
          ),
        }))
      },

      reviews: {},
      saveReview: (postId, postAuthor, input) => {
        const author = get().currentUser
        if (!author) return { ok: false, error: "Sign in to leave a review." }
        if (author === postAuthor) return { ok: false, error: "You can't rate your own article." }
        const rating = Math.round(input.rating)
        if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Pick 1 to 5 stars." }
        const body = input.body.trim()
        if (body.length > REVIEW_BODY_MAX) return { ok: false, error: `Keep reviews under ${REVIEW_BODY_MAX} characters.` }
        const key = reviewKey(postId, author)
        const prev = get().reviews[key]
        // Keyed by reader + article, so rating again edits the existing review
        const review: ArticleReview = prev
          ? { ...prev, rating, body, updatedAt: now() }
          : { id: "r_" + uid(), postId, author, rating, body, createdAt: now() }
        set((s) => ({ reviews: { ...s.reviews, [key]: review } }))
        return { ok: true }
      },
      deleteReview: (postId) => {
        const author = get().currentUser
        if (!author) return
        set((s) => ({ reviews: { ...s.reviews, [reviewKey(postId, author)]: null } }))
      },
      deleteDraft: (id) =>
        set((s) => {
          const next = { ...s.drafts }
          delete next[id]
          return { drafts: next }
        }),

      plan: null,
      tips: [],
      setPlan: (plan) => set({ plan }),
      recordTip: (authorUsername, amount) => set((s) => ({ tips: [...s.tips, { authorUsername, amount, at: now() }] })),

      newsletterSubscribers: [],
      addSubscriber: (email) => {
        const e = email.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || get().newsletterSubscribers.includes(e)) return false
        set((s) => ({ newsletterSubscribers: [...s.newsletterSubscribers, e] }))
        return true
      },

      profile: defaultProfile(me.username),
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      savedProfiles: {},

      notifications: SEED_NOTIFICATIONS,
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

      toasts: [],
      toast: (message, opts) => {
        const id = ++toastSeq
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone: opts?.tone ?? "default", action: opts?.action }] }))
        setTimeout(() => get().dismissToast(id), 3200)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: "prism-store",
      version: 2,
      // v1 → v2: drafts gain an author and the moderation status machine; profiles gain social handles + avatar
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        if (version < 2) {
          const drafts = (state.drafts ?? {}) as Record<string, Record<string, unknown>>
          for (const d of Object.values(drafts)) {
            const wasPublished = d.status === "published"
            d.authorUsername ??= me.username
            d.status = wasPublished ? "PUBLISHED" : "DRAFT"
            // Stories published before review existed stay live as they were
            if (wasPublished)
              d.live = { title: d.title, subtitle: d.subtitle, contentHtml: d.contentHtml, tags: d.tags, paywall: d.paywall }
            d.celebrated = true
          }
          state.profile = { ...defaultProfile(me.username), ...((state.profile as object | undefined) ?? {}) }
        }
        return state as unknown as UIState
      },
      // Hydrated manually after mount (ThemeProvider) so server and first client render match
      skipHydration: true,
      storage: createJSONStorage(() => localStorage, {
        replacer: (_k, v) => (v instanceof Set ? { __set: [...v] } : v),
        reviver: (_k, v) =>
          v && typeof v === "object" && Array.isArray((v as { __set?: unknown }).__set)
            ? new Set((v as { __set: string[] }).__set)
            : v,
      }),
      partialize: ({ toasts: _t, toast: _a, dismissToast: _d, ...rest }) => rest,
    }
  )
)

/** Fire-and-forget feedback from anywhere (event handlers, async flows) */
export const toast = (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) =>
  useUIStore.getState().toast(message, opts)
