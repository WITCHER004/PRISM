"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { ArticleStatus, Phase1Report, ReviewTrack } from "@/lib/moderation/types"
import { canTransition, MIN_WORDS_FOR_SUBMISSION, phase1Outcome, trackFor } from "@/lib/moderation/workflow"
import { overlapWithCorpus } from "@/lib/moderation/similarity"
import { reviewKey, REVIEW_BODY_MAX, type ArticleReview } from "@/lib/reviews"
import { logOutFirebase } from "@/lib/firebase"
import { isAdminEmail, isAdminUser } from "@/lib/admin"
import { DEFAULT_AVATAR, handleFrom, type ArticleVersion, type ArticleWorkflow, type UserDoc } from "@/lib/live/schema"
import {
  CLOSING_NOTE_MIN,
  COUNTER_REASON_MIN,
  DEMO_PAYOUT_SETTLE_MS,
  FAILURE_REASON_MIN,
  MIN_PAYOUT_USD,
  PANEL_SIZE,
  TEXT_MAX,
} from "@/lib/elite/config"
import {
  assignPanel,
  canCounterVote,
  canReconsiderVote,
  tallyPanel,
  panelStatus,
  reconsiderationStatus,
  resolveVote,
  type EmployeeAppeal,
  type PanelDecision,
  type PanelVote,
} from "@/lib/elite/panel"
import { activateElite, isEliteActive, type Subscription } from "@/lib/elite/subscription"
import {
  resolveAccess,
  validateApplication,
  type AccessRecord,
  type ApplicationInput,
  type ManagedRole,
  type PanelApplication,
  type PanelApplicationStatus,
} from "@/lib/access"
import type { ReviewCriterion } from "@/lib/elite/panel"
import { isDuplicateView, priceView, walletFromArticles, type PayoutRecord, type ViewEvent } from "@/lib/elite/wallet"

// Client state. Shared data (users, articles, panel applications, notifications) lives in Firestore:
// src/lib/live/sync.ts mirrors those collections into this store and writes local changes back, so
// the actions below keep their synchronous shape while Firestore stays the source of truth.
// Only per-browser preferences (theme, bookmarks, claps…) are persisted to localStorage.

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
export type LiveVersion = ArticleVersion

export interface ReviewOutcome {
  reviewer: string // username
  decision: "APPROVED" | "REJECTED"
  notes: string
  at: string
}

/** A story in any state (draft → review → live). Mirrors Firestore `articles/{id}`; see live/schema.ts */
export type Draft = ArticleWorkflow

/** A counter-reason target: a panel vote id, or "employee" for an employee rejection */
export type CounterTarget = string

export type ReviewInput = { rating: number; body: string }
type Result = { ok: true } | { ok: false; error: string }

export interface AppNotification {
  id: string
  kind: "follow" | "clap" | "comment" | "system" | "review" | "idea_published"
  /** Recipient's handle */
  to?: string
  /** Recipient's uid, when known (it's resolved from the handle otherwise) */
  toUid?: string
  articleId?: string
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
  /** Firebase Storage download URL; empty = default avatar */
  avatarUrl: string
  email?: string
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
  interestedTopics: string[]
  setTheme: (theme: Theme) => void
  setFontSize: (size: FontSize) => void
  toggleFocusMode: () => void
  toggleTTS: () => void
  setInterestedTopics: (topics: string[]) => void
  toggleInterestedTopic: (topic: string) => void

  // session (Firebase Auth)
  currentUser: string | null // handle of the signed-in user (users/{uid}.handle)
  authEmail: string | null
  authUid: string | null
  /** The signed-in email is on ADMIN_EMAILS and verified */
  authIsAdmin: boolean
  authLoading: boolean
  setFirebaseUser: (
    user: { uid: string; email: string | null; emailVerified?: boolean; displayName: string | null; photoURL: string | null } | null
  ) => void
  signOut: () => void

  // live Firestore mirrors (written by src/lib/live/sync.ts; never persisted)
  /** users/{uid} documents keyed by handle */
  users: Record<string, UserDoc>
  /** True once the first snapshot of each live collection has arrived */
  live: { users: boolean; articles: boolean }
  applyRemoteUsers: (docs: UserDoc[]) => void
  applyRemoteArticles: (drafts: Record<string, Draft>, pending: ReadonlySet<string>) => void
  applyRemoteApplications: (apps: PanelApplication[]) => void
  applyRemoteNotifications: (notes: AppNotification[]) => void
  setLiveReady: (key: keyof UIState["live"]) => void

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

  // writing
  drafts: Record<string, Draft>
  saveDraft: (
    d: Pick<Draft, "id" | "title" | "subtitle" | "contentHtml" | "tags" | "paywall" | "paper" | "craft" | "panelReview"> & {
      coverImageUrl?: string
      originIdeaId?: string
      originIdeaText?: string
      voterIds?: string[]
    }
  ) => Draft
  deleteDraft: (id: string) => void
  /** Phase 1 result → PHASE_1_FAILED or PENDING_EMPLOYEE_REVIEW. Elite articles go on to the panel after that. */
  recordPhase1: (id: string, report: Phase1Report) => Draft | null
  /** Author pulls a submission out of the queue to keep editing */
  withdrawSubmission: (id: string) => void
  /** Phase 2: an employee approves (publishes) or requests changes. `actor` defaults to the site session. */
  decideReview: (id: string, decision: ReviewOutcome["decision"], notes: string, actor?: string) => Result
  markCelebrated: (id: string) => void

  // Elite peer panel + counter-reasons
  /** A panel member casts PASS or FAIL on a criterion (FAIL needs a written reason; PASS may add a note) */
  castPanelVote: (id: string, decision: PanelDecision, reason: string, criterion: ReviewCriterion) => Result
  /** Writer appeals a FAIL vote or an employee rejection */
  submitCounter: (id: string, target: CounterTarget, reason: string, clarification?: string) => Result
  /** Dissenting member or staff lead accepts (FAIL → PASS) or upholds the original decision */
  reconsiderCounter: (id: string, target: CounterTarget, verdict: "ACCEPT" | "UPHOLD", note: string, actor?: string) => Result

  // Roles: Free → Elite → Panel member live on the main site; Admin exists only inside /admin
  access: Record<string, AccessRecord>
  panelApplications: Record<string, PanelApplication>
  /** Handle of the signed-in user when their email is on the ADMIN_EMAILS whitelist, else null */
  adminSession: string | null
  /** The in-place upgrade dialog (not persisted) */
  upgradeOpen: boolean
  setUpgradeOpen: (open: boolean) => void
  /** The panel application / pending-details dialog (not persisted) */
  panelDialog: "apply" | "pending" | null
  setPanelDialog: (d: "apply" | "pending" | null) => void
  submitPanelApplication: (
    input: ApplicationInput & { uid?: string; email?: string | null; displayName: string }
  ) => Result & { application?: PanelApplication }
  decidePanelApplication: (
    id: string,
    decision: "approved" | "rejected",
    actor: string,
    note?: string
  ) => Result & { application?: PanelApplication }
  /** Admin: put any user on Free, Elite, the panel, or suspend them */
  setManagedRole: (username: string, role: ManagedRole, actor: string) => Result

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

const APPLICATION_STATUSES: readonly PanelApplicationStatus[] = ["none", "pending", "approved", "rejected"]
const isApplicationStatus = (v: unknown): v is PanelApplicationStatus =>
  typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v)
void isApplicationStatus

/** The reviewed version of a draft becomes the live one, and produces notifications for any voters */
function publishDraft(d: Draft, at: string): { draft: Draft; voterNotes: AppNotification[] } {
  const v = d.submitted ?? { title: d.title, subtitle: d.subtitle, contentHtml: d.contentHtml, tags: d.tags, paywall: d.paywall, paper: d.paper, coverImageUrl: d.coverImageUrl }
  const draft: Draft = { ...d, status: "PUBLISHED", live: v, publishedAt: d.publishedAt ?? at, celebrated: false, liveAiPercent: d.phase1?.aiPercent }
  const title = titleOf(d)
  const voterNotes: AppNotification[] = (d.voterIds ?? []).map((voter) => ({
    id: "n_" + uid(),
    kind: "idea_published",
    toUid: voter,
    articleId: d.id,
    text: `An idea you sparked was just published as a full article: “${title}”`,
    href: `/story/${d.id}`,
    createdAt: at,
    read: false,
  }))
  return { draft, voterNotes }
}

const titleOf = (d: Draft) => (d.submitted?.title ?? d.title).trim() || "Untitled story"

const EMPTY_PROFILE: Profile = {
  displayName: "",
  bio: "",
  websiteUrl: "",
  twitterHandle: "",
  linkedinHandle: "",
  instagramHandle: "",
  githubHandle: "",
  avatarUrl: "",
  emailDigest: true,
  emailReplies: true,
}

/** The signed-in user's editable profile, from their users/{uid} document */
const profileFromUserDoc = (u: UserDoc): Profile => ({
  displayName: u.displayName,
  bio: u.bio,
  websiteUrl: u.websiteUrl ?? "",
  twitterHandle: u.twitterHandle ?? "",
  linkedinHandle: u.linkedinHandle ?? "",
  instagramHandle: u.instagramHandle ?? "",
  githubHandle: u.githubHandle ?? "",
  avatarUrl: u.photoURL ?? "",
  email: u.email ?? undefined,
  emailDigest: u.emailDigest !== false,
  emailReplies: u.emailReplies !== false,
})

/**
 * Objects that arrived from Firestore. The sync layer writes back only what the app changed locally,
 * which it recognises as objects NOT in this set (every local action creates new objects).
 */
export const fromRemote = new WeakSet<object>()
const remote = <T extends object>(o: T): T => {
  fromRemote.add(o)
  return o
}

/** Firestore counter hooks, installed by src/lib/live/sync.ts (kept out of the store to avoid a cycle) */
let viewCounter: ((postId: string) => void) | undefined
let likeCounter: ((postId: string, by: number) => void) | undefined
export function setCounterHooks(hooks: { view: (postId: string) => void; like: (postId: string, by: number) => void }) {
  viewCounter = hooks.view
  likeCounter = hooks.like
}

let toastSeq = 0
const MAX_VIEW_EVENTS = 20000

/** A user's resolved access from the store's own data */
const accessOf = (s: Pick<UIState, "access" | "subscriptions">, username: string | null | undefined) =>
  resolveAccess({ subscription: username ? s.subscriptions[username] : undefined, record: username ? s.access[username] : undefined })

/** Every approved panel member */
function panelPool(s: Pick<UIState, "access" | "subscriptions">): string[] {
  return Object.keys(s.access).filter((u) => accessOf(s, u).isPanelMember)
}

/**
 * A newly approved member joins every open panel that still has a free seat (never on their own paper),
 * so they have papers to review straight away. Panels fill up to PANEL_SIZE as the panel grows.
 */
function seatOnOpenPanels(drafts: Record<string, Draft>, username: string, at: string) {
  const next = { ...drafts }
  const notes: AppNotification[] = []
  for (const d of Object.values(drafts)) {
    if (d.status !== "PENDING_PEER_PANEL" || !d.panel || d.authorUsername === username) continue
    if (d.panel.some((v) => v.reviewer === username) || d.panel.length >= PANEL_SIZE) continue
    if (tallyPanel(d.panel).complete) continue
    const panel = [...d.panel, { id: "pv_" + uid(), reviewer: username, decision: null }]
    next[d.id] = { ...d, panel }
    notes.push({
      id: "n_" + uid(),
      kind: "review",
      to: username,
      text: `You've been seated on the peer panel for “${titleOf(d)}”`,
      href: "/panel",
      createdAt: at,
      read: false,
    })
  }
  return { drafts: next, notes }
}

/** Seats up to PANEL_SIZE panelists (never the author) and notifies them. Throws when nobody is eligible. */
function sendToPanel(d: Draft, at: string, pool: string[]): { draft: Draft; notes: AppNotification[] } {
  const panel: PanelVote[] = assignPanel(pool, d.authorUsername).map((reviewer) => ({
    id: "pv_" + uid(),
    reviewer,
    decision: null,
  }))
  const draft: Draft = { ...d, status: "PENDING_PEER_PANEL", panel }
  const notes: AppNotification[] = panel.map((v) => ({
    id: "n_" + uid(),
    kind: "review",
    to: v.reviewer,
    text: `You've been assigned to the peer panel for “${titleOf(d)}”`,
    href: "/panel",
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
    const pub = publishDraft(updated, at)
    updated = { ...pub.draft, panelPassed: true }
    notes.push(...pub.voterNotes)
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
      interestedTopics: ["philosophy", "design", "programming"],
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      toggleTTS: () => set((s) => ({ ttsEnabled: !s.ttsEnabled })),
      setInterestedTopics: (interestedTopics) => set({ interestedTopics }),
      toggleInterestedTopic: (topic) =>
        set((s) => ({
          interestedTopics: s.interestedTopics.includes(topic)
            ? s.interestedTopics.filter((t) => t !== topic)
            : [...s.interestedTopics, topic],
        })),

      currentUser: null,
      authEmail: null,
      authUid: null,
      authIsAdmin: false,
      authLoading: true,
      adminSession: null,
      setFirebaseUser: (fbUser) => {
        if (!fbUser) {
          set({ currentUser: null, authEmail: null, authUid: null, authIsAdmin: false, authLoading: false, adminSession: null, profile: EMPTY_PROFILE, notifications: [] })
          return
        }
        const email = fbUser.email ?? ""
        set((s) => {
          // Prefer the handle already claimed in users/{uid}; the sync layer corrects it once the doc loads
          const known = Object.values(s.users).find((u) => u.uid === fbUser.uid)
          const handle = known?.handle ?? handleFrom(fbUser.displayName, email, fbUser.uid)
          return {
            currentUser: handle,
            authEmail: email || null,
            authUid: fbUser.uid,
            authLoading: false,
            authIsAdmin: isAdminUser(fbUser),
            adminSession: isAdminUser(fbUser) ? handle : null,
            profile: known
              ? profileFromUserDoc(known)
              : {
                  ...EMPTY_PROFILE,
                  displayName: fbUser.displayName || (email ? email.split("@")[0] : "Member"),
                  avatarUrl: fbUser.photoURL || "",
                  email: email || undefined,
                },
          }
        })
      },
      signOut: () => {
        logOutFirebase().catch((err) => console.warn("[auth] Firebase sign-out failed:", err))
        set({ currentUser: null, authEmail: null, authUid: null, authIsAdmin: false, authLoading: false, adminSession: null, profile: EMPTY_PROFILE, notifications: [] })
      },

      users: {},
      live: { users: false, articles: false },
      setLiveReady: (key) => set((s) => (s.live[key] ? {} : { live: { ...s.live, [key]: true } })),
      applyRemoteUsers: (docs) =>
        set((s) => {
          const users: Record<string, UserDoc> = {}
          const access: Record<string, AccessRecord> = {}
          const subscriptions: Record<string, Subscription> = {}
          for (const u of docs) {
            users[u.handle] = u
            access[u.handle] = remote({
              uid: u.uid,
              isPanelMember: u.isPanelMember,
              panelApplicationStatus: u.isPanelMember ? "approved" : u.panelApplicationStatus,
              // Admin comes from the email whitelist, never from a field a client could write
              isAdmin: isAdminEmail(u.email),
              suspended: !!u.suspended,
            })
            if (u.tier === "elite") {
              const sub = activateElite("firestore", "users_doc")
              subscriptions[u.handle] = remote(u.eliteSince ? { ...sub, subscribedAt: new Date(u.eliteSince).toISOString() } : sub)
            }
          }
          const me = s.authUid ? docs.find((u) => u.uid === s.authUid) : undefined
          const mine = me
            ? {
                currentUser: me.handle,
                adminSession: s.authIsAdmin ? me.handle : null,
                profile: remote(profileFromUserDoc(me)),
              }
            : {}
          return { users, access, subscriptions, ...mine }
        }),
      applyRemoteArticles: (incoming, pending) =>
        set((s) => {
          const drafts: Record<string, Draft> = {}
          for (const [id, d] of Object.entries(incoming)) drafts[id] = remote(d)
          // Keep local edits that haven't reached Firestore yet
          for (const id of pending) if (s.drafts[id]) drafts[id] = s.drafts[id]
          return { drafts }
        }),
      applyRemoteApplications: (apps) =>
        set(() => ({ panelApplications: Object.fromEntries(apps.map((a) => [a.id, remote(a)])) })),
      applyRemoteNotifications: (notes) =>
        set(() => ({ notifications: notes.map(remote).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })),

      clappedPosts: {},
      bookmarkedPosts: new Set<string>(),
      followedUsers: new Set<string>(),
      unlockedPosts: new Set<string>(),
      pollVotes: {},
      likedComments: new Set<string>(),
      clapPost: (postId, count) =>
        set((s) => {
          const already = s.clappedPosts[postId] ?? 0
          const added = Math.min(50, already + count) - already
          if (added > 0) likeCounter?.(postId, added)
          return {
          clappedPosts: { ...s.clappedPosts, [postId]: Math.min(50, (s.clappedPosts[postId] ?? 0) + count) },
          }
        }),
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

      drafts: {},
      saveDraft: (d) => {
        const prev = get().drafts[d.id]
        const s = get()
        const at = now()
        const draft: Draft = {
          ...prev,
          ...d,
          authorUsername: prev?.authorUsername ?? s.currentUser ?? "",
          authorUid: prev?.authorUid ?? s.authUid ?? undefined,
          authorName: prev?.authorName ?? (s.profile.displayName || s.currentUser || undefined),
          authorAvatar: prev?.authorAvatar ?? (s.profile.avatarUrl || undefined),
          createdAt: prev?.createdAt ?? at,
          status: prev?.status ?? "DRAFT",
          // The address is fixed once a version has gone live
          slug: prev?.live ? prev.slug : `${slugify(d.title) || "untitled"}-${d.id.slice(-4)}`,
          updatedAt: at,
        }
        set((st) => ({ drafts: { ...st.drafts, [d.id]: draft } }))
        return draft
      },
      recordPhase1: (id, report) => {
        const d = get().drafts[id]
        if (!d) return null
        // Same gate the server applies: 150 words
        if (report.wordCount < MIN_WORDS_FOR_SUBMISSION) return null
        const next = phase1Outcome(report.aiPercent)
        if (!canTransition(d.status, next)) return null
        // The route is fixed at submission time: Elite writers who kept the panel switch on go to the panel
        const track = trackFor(accessOf(get(), d.authorUsername).isElite && d.panelReview !== false)
        // Plagiarism score: phrasing shared with stories already published on Prism
        const corpus = Object.values(get().drafts)
          .filter((x) => x.live && x.id !== id)
          .map((x) => ({ id: x.id, title: x.live!.title, html: x.live!.contentHtml }))
        const plagiarismPercent = overlapWithCorpus(d.contentHtml, corpus, id).percent
        const updated: Draft = {
          ...d,
          status: next,
          phase1: report,
          plagiarismPercent,
          submittedAt: now(),
          review: undefined,
          appeal: undefined,
          track,
          panel: undefined,
          panelPassed: undefined,
          submitted: { title: d.title, subtitle: d.subtitle, contentHtml: d.contentHtml, tags: d.tags, paywall: d.paywall, paper: d.paper, coverImageUrl: d.coverImageUrl },
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
      decideReview: (id, decision, notes, actor) => {
        const reviewer = actor ?? get().currentUser
        const d = get().drafts[id]
        if (!reviewer) return { ok: false, error: "Sign in as a reviewer." }
        if (!accessOf(get(), reviewer).isAdmin) return { ok: false, error: "Only Prism staff can approve or reject stories." }
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
        let voterNotes: AppNotification[] = []
        const pool = panelPool(get()).filter((u) => u !== d.authorUsername)
        // Until the panel has members, a staff approval publishes Elite stories directly
        const panelReady = toPanel && pool.length > 0
        if (panelReady) {
          const sent = sendToPanel({ ...d, review }, at, pool)
          updated = sent.draft
          panelNotes = sent.notes
        } else {
          if (decision === "APPROVED") {
            const pub = publishDraft(d, at)
            updated = { ...pub.draft, review }
            voterNotes = pub.voterNotes
          } else {
            updated = { ...d, status: "REJECTED", review }
          }
        }
        const note: AppNotification = {
          id: "n_" + uid(),
          kind: "review",
          to: d.authorUsername,
          text: panelReady
            ? `“${title}” passed employee review and is now with the peer panel`
            : decision === "APPROVED"
              ? `“${title}” passed review and is now live`
              : `“${title}” needs changes before it can be published`,
          href: decision === "APPROVED" && !panelReady ? `/story/${id}` : `/submissions/${id}`,
          articleId: id,
          createdAt: at,
          read: false,
        }
        set((s) => ({ drafts: { ...s.drafts, [id]: updated }, notifications: [note, ...panelNotes, ...voterNotes, ...s.notifications] }))
        return { ok: true }
      },
      markCelebrated: (id) =>
        set((s) => (s.drafts[id] ? { drafts: { ...s.drafts, [id]: { ...s.drafts[id], celebrated: true } } } : {})),

      castPanelVote: (id, decision, rawReason, criterion) => {
        const me = get().currentUser
        const d = get().drafts[id]
        if (!me || !accessOf(get(), me).isPanelMember) return { ok: false, error: "Only peer-panel members can vote." }
        if (!d?.panel || d.status !== "PENDING_PEER_PANEL") return { ok: false, error: "This paper isn't waiting for panel votes." }
        const vote = d.panel.find((v) => v.reviewer === me)
        if (!vote) return { ok: false, error: "You aren't on this paper's panel." }
        if (vote.decision) return { ok: false, error: "You've already voted on this paper." }
        if (!criterion) return { ok: false, error: "Pick the criterion your vote rests on." }
        const reason = rawReason.trim()
        if (decision === "FAIL" && reason.length < FAILURE_REASON_MIN)
          return { ok: false, error: `Explain why it fails (${FAILURE_REASON_MIN}+ characters).` }
        if (reason.length > TEXT_MAX) return { ok: false, error: `Keep it under ${TEXT_MAX} characters.` }
        const at = now()
        const panel = d.panel.map((v) =>
          v.id === vote.id
            ? {
                ...v,
                decision,
                criterion,
                failureReason: decision === "FAIL" ? reason : undefined,
                note: decision === "PASS" ? reason || undefined : undefined,
                decidedAt: at,
              }
            : v
        )
        set((s) => applyPanel(s, { ...d, panel }, at))
        return { ok: true }
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
            href: "/admin/verification?tab=counters",
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
          href: "/panel?tab=counters",
          createdAt: at,
          read: false,
        }
        set((s) => ({ drafts: { ...s.drafts, [id]: { ...d, panel, status: "COUNTER_SUBMITTED" } }, notifications: [note, ...s.notifications] }))
        return { ok: true }
      },

      reconsiderCounter: (id, target, verdict, note, actor) => {
        const me = actor ?? get().currentUser
        const d = get().drafts[id]
        if (!me) return { ok: false, error: "Sign in as a reviewer." }
        if (!d || d.status !== "COUNTER_SUBMITTED") return { ok: false, error: "There's no open counter-reason on this article." }
        if (d.authorUsername === me) return { ok: false, error: "You can't rule on your own appeal." }
        const text = note.trim()
        if (verdict === "UPHOLD" && text.length < CLOSING_NOTE_MIN)
          return { ok: false, error: `Add a closing note for the writer (${CLOSING_NOTE_MIN}+ characters).` }
        if (text.length > TEXT_MAX) return { ok: false, error: `Keep it under ${TEXT_MAX} characters.` }
        const staff = accessOf(get(), me).isAdmin
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
          let voterNotes: AppNotification[] = []
          const pool = panelPool(get()).filter((u) => u !== d.authorUsername)
          if (toPanel && pool.length > 0) {
            const sent = sendToPanel(approved, at, pool)
            updated = sent.draft
            panelNotes = sent.notes
          } else if (toPanel) {
            const pub = publishDraft(approved, at)
            updated = pub.draft
            voterNotes = pub.voterNotes
          } else {
            if (verdict === "ACCEPT") {
              const pub = publishDraft(approved, at)
              updated = pub.draft
              voterNotes = pub.voterNotes
            } else {
              updated = { ...d, status: "REJECTED", appeal }
            }
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
          set((s) => ({ drafts: { ...s.drafts, [id]: updated }, notifications: [n, ...panelNotes, ...voterNotes, ...s.notifications] }))
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

      subscriptions: {},
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

      access: {},
      panelApplications: {},
      upgradeOpen: false,
      setUpgradeOpen: (open) => set({ upgradeOpen: open }),
      panelDialog: null,
      setPanelDialog: (d) => set({ panelDialog: d }),

      submitPanelApplication: (input) => {
        const s = get()
        const me = s.currentUser
        if (!me) return { ok: false, error: "Sign in to apply." }
        const a = accessOf(s, me)
        if (!a.isElite) return { ok: false, error: "Upgrade to Elite to apply for the Peer Review Panel." }
        if (a.isPanelMember) return { ok: false, error: "You're already on the panel." }
        if (a.panelApplicationStatus === "pending") return { ok: false, error: "Your application is already being reviewed." }
        const problem = validateApplication(input)
        if (problem) return { ok: false, error: problem }
        const application: PanelApplication = {
          id: "pa_" + uid() + uid(),
          username: me,
          uid: input.uid,
          displayName: input.displayName,
          email: input.email ?? null,
          expertise: [...new Set(input.expertise)],
          credentialsUrl: input.credentialsUrl.trim(),
          statement: input.statement.trim(),
          status: "pending",
          submittedAt: now(),
        }
        set((st) => ({
          panelApplications: { ...st.panelApplications, [application.id]: application },
          access: {
            ...st.access,
            [me]: { ...st.access[me], uid: input.uid ?? st.access[me]?.uid, panelApplicationStatus: "pending" },
          },
        }))
        return { ok: true, application }
      },

      decidePanelApplication: (id, decision, actor, note) => {
        const s = get()
        if (!accessOf(s, actor).isAdmin) return { ok: false, error: "Only Prism admins can decide applications." }
        const app = s.panelApplications[id]
        if (!app) return { ok: false, error: "Application not found." }
        if (app.status !== "pending") return { ok: false, error: "This application was already decided." }
        const at = now()
        const approved = decision === "approved"
        const application: PanelApplication = { ...app, status: decision, decidedAt: at, decidedBy: actor, decisionNote: note?.trim() || undefined }
        set((st) => {
          const seated = approved ? seatOnOpenPanels(st.drafts, app.username, at) : { drafts: st.drafts, notes: [] }
          const n: AppNotification = {
            id: "n_" + uid(),
            kind: "system",
            to: app.username,
            text: approved
              ? "You're on the Peer Review Panel. Your first papers are waiting for your vote."
              : "Your Peer Review Panel application wasn't approved this time.",
            href: approved ? "/panel" : "/profile",
            createdAt: at,
            read: false,
          }
          return {
            panelApplications: { ...st.panelApplications, [id]: application },
            access: {
              ...st.access,
              [app.username]: { ...st.access[app.username], panelApplicationStatus: decision, isPanelMember: approved },
            },
            drafts: seated.drafts,
            notifications: [n, ...seated.notes, ...st.notifications],
          }
        })
        return { ok: true, application }
      },

      setManagedRole: (username, role, actor) => {
        if (!accessOf(get(), actor).isAdmin) return { ok: false, error: "Only Prism admins can change roles." }
        if (username === actor && role === "suspended") return { ok: false, error: "You can't suspend your own account." }
        const at = now()
        set((st) => {
          const prev = st.access[username] ?? {}
          const sub = st.subscriptions[username]
          const subscriptions = { ...st.subscriptions }
          let record: AccessRecord = { ...prev, suspended: role === "suspended" }
          let drafts = st.drafts
          let notes: AppNotification[] = []
          const leavePanel = (r: AccessRecord): AccessRecord => ({
            ...r,
            isPanelMember: false,
            panelApplicationStatus: r.panelApplicationStatus === "approved" ? "none" : r.panelApplicationStatus,
          })
          if (role === "free") {
            if (sub) subscriptions[username] = { ...sub, subscriptionStatus: "INACTIVE" }
            record = leavePanel(record)
          } else if (role === "elite" || role === "panel") {
            if (!isEliteActive(sub)) subscriptions[username] = activateElite("admin", `admin_${actor}`)
            if (role === "panel") {
              record = { ...record, isPanelMember: true, panelApplicationStatus: "approved" }
              const seated = seatOnOpenPanels(st.drafts, username, at)
              drafts = seated.drafts
              notes = seated.notes
            } else {
              record = leavePanel(record)
            }
          }
          return { subscriptions, access: { ...st.access, [username]: record }, drafts, notifications: [...notes, ...st.notifications] }
        })
        return { ok: true }
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
        // The shared counter on articles/{id} (the author's own reads don't count)
        if (viewerKey !== author) viewCounter?.(postId)
        return { counted: true, monetized }
      },
      requestPayout: () => {
        const s = get()
        const me = s.currentUser
        if (!me) return { ok: false, error: "Sign in first." }
        if (!isEliteActive(s.subscriptions[me])) return { ok: false, error: "Payouts are an Elite feature." }
        const wallet = walletFromArticles(me, Object.values(s.drafts), s.payouts, true)
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
          ? { ...prev, rating, body, postAuthor, updatedAt: now() }
          : { id: "r_" + uid(), postId, postAuthor, author, rating, body, createdAt: now() }
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

      profile: EMPTY_PROFILE,
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

      notifications: [],
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
      version: 3,
      // v3: shared data moved to Firestore. Anything older than v3 kept demo data here; drop it all and
      // keep only this browser's preferences.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        if (version >= 3) return state as unknown as UIState
        const keep = ["theme", "fontSize", "focusMode", "ttsEnabled", "interestedTopics", "bookmarkedPosts", "unlockedPosts", "pollVotes", "likedComments", "viewerId"]
        return Object.fromEntries(Object.entries(state).filter(([k]) => keep.includes(k))) as unknown as UIState
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
      // Preferences only: identity comes from Firebase Auth, shared data from Firestore
      partialize: (s) => ({
        theme: s.theme,
        fontSize: s.fontSize,
        focusMode: s.focusMode,
        ttsEnabled: s.ttsEnabled,
        interestedTopics: s.interestedTopics,
        clappedPosts: s.clappedPosts,
        bookmarkedPosts: s.bookmarkedPosts,
        followedUsers: s.followedUsers,
        unlockedPosts: s.unlockedPosts,
        pollVotes: s.pollVotes,
        likedComments: s.likedComments,
        viewerId: s.viewerId,
        views: s.views,
        payouts: s.payouts,
        plan: s.plan,
        tips: s.tips,
        newsletterSubscribers: s.newsletterSubscribers,
      }),
    }
  )
)

/** Fire-and-forget feedback from anywhere (event handlers, async flows) */
export const toast = (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) =>
  useUIStore.getState().toast(message, opts)
