"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { MOCK_USERS, type PeerReview, MOCK_PEER_REVIEWS } from "@/lib/data"

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

export interface Draft {
  id: string
  title: string
  subtitle: string
  contentHtml: string
  tags: string[]
  paywall: PaywallChoice
  status: "draft" | "published"
  slug: string
  updatedAt: string
  publishedAt?: string
}

export interface AppNotification {
  id: string
  kind: "follow" | "clap" | "comment" | "system"
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

  // peer reviews of papers and articles
  peerReviews: Record<string, PeerReview[]>
  upvotedReviews: Set<string>
  addPeerReview: (review: Omit<PeerReview, "id" | "createdAt" | "upvotes">) => PeerReview
  toggleUpvotePeerReview: (reviewId: string) => void

  // writing
  drafts: Record<string, Draft>
  saveDraft: (d: Omit<Draft, "updatedAt" | "status" | "slug"> & { status?: Draft["status"] }) => Draft
  publishDraft: (id: string) => Draft | null
  deleteDraft: (id: string) => void

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

const me = MOCK_USERS[0]
const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: "n1", kind: "follow", text: "Priya Rao started following you", href: "/priyarao", createdAt: "2026-11-02T08:10:00.000Z", read: false },
  { id: "n2", kind: "clap", text: "Your story “The Hidden Cost of Distributed Transactions” passed 4,800 claps", href: "/alexchen/hidden-cost-distributed-transactions", createdAt: "2026-11-01T19:30:00.000Z", read: false },
  { id: "n3", kind: "comment", text: "Marcus Williams responded to your story", href: "/alexchen/hidden-cost-distributed-transactions#comments", createdAt: "2026-11-01T12:05:00.000Z", read: true },
]

let toastSeq = 0

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

      currentUser: me.username, // demo: start signed in as the sample writer
      setCurrentUser: (currentUser) => set({ currentUser }),
      signIn: (email, name) => {
        // Demo auth: match existing mock user if matching email/username, or create a new user profile
        const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
        const match = MOCK_USERS.find((u) => u.username === local)
        const username = match ? match.username : (local || "reader")
        const displayName = name?.trim() || (match ? match.displayName : (local ? local.charAt(0).toUpperCase() + local.slice(1) : "Reader"))
        
        const welcomeNotif: AppNotification = {
          id: `welcome-${Date.now()}`,
          kind: "system",
          text: `Welcome to Prism, ${displayName}! Your sanctuary for quiet reading is ready.`,
          href: "/explore",
          createdAt: new Date().toISOString(),
          read: false,
        }

        set((s) => ({
          currentUser: username,
          profile: {
            ...s.profile,
            displayName,
            bio: s.profile.bio || "Reader & thinker on Prism",
          },
          notifications: [welcomeNotif, ...(s.notifications || [])],
        }))
        return username
      },
      signOut: () => set({ currentUser: null }),

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

      peerReviews: MOCK_PEER_REVIEWS,
      upvotedReviews: new Set<string>(),
      addPeerReview: (reviewData) => {
        const id = "pr_" + uid()
        const newReview: PeerReview = {
          ...reviewData,
          id,
          createdAt: now(),
          upvotes: 0,
        }
        set((s) => {
          const postList = s.peerReviews[reviewData.postId] || []
          return {
            peerReviews: {
              ...s.peerReviews,
              [reviewData.postId]: [newReview, ...postList],
            },
            notifications: [
              {
                id: "notif_" + uid(),
                kind: "system",
                text: `New peer review submitted with verdict: ${reviewData.decision}.`,
                href: `#peer-reviews`,
                createdAt: now(),
                read: false,
              },
              ...s.notifications,
            ],
          }
        })
        return newReview
      },
      toggleUpvotePeerReview: (reviewId) =>
        set((s) => {
          const upvoted = new Set(s.upvotedReviews)
          const isUpvoted = upvoted.has(reviewId)
          if (isUpvoted) {
            upvoted.delete(reviewId)
          } else {
            upvoted.add(reviewId)
          }
          const nextReviews: Record<string, PeerReview[]> = {}
          for (const [postId, list] of Object.entries(s.peerReviews)) {
            nextReviews[postId] = list.map((r) =>
              r.id === reviewId ? { ...r, upvotes: Math.max(0, r.upvotes + (isUpvoted ? -1 : 1)) } : r
            )
          }
          return { upvotedReviews: upvoted, peerReviews: nextReviews }
        }),

      drafts: {},
      saveDraft: (d) => {
        const prev = get().drafts[d.id]
        const draft: Draft = {
          ...prev,
          ...d,
          status: d.status ?? prev?.status ?? "draft",
          slug: prev?.status === "published" ? prev.slug : `${slugify(d.title) || "untitled"}-${d.id.slice(-4)}`,
          updatedAt: now(),
        }
        set((s) => ({ drafts: { ...s.drafts, [d.id]: draft } }))
        return draft
      },
      publishDraft: (id) => {
        const d = get().drafts[id]
        if (!d || !d.title.trim()) return null
        const published: Draft = { ...d, status: "published", publishedAt: d.publishedAt ?? now(), updatedAt: now() }
        set((s) => ({ drafts: { ...s.drafts, [id]: published } }))
        return published
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

      profile: {
        displayName: me.displayName,
        bio: me.bio,
        websiteUrl: me.websiteUrl ?? "",
        twitterHandle: me.twitterHandle ?? "",
        emailDigest: true,
        emailReplies: true,
      },
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

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
      version: 1,
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
