"use client"

// The Discussions forum, live from Firestore:
//
//   forum_threads/{id}   title · body · topicTag · linkedArticleId/Title/Href · author* · replyCount ·
//                        upvoterIds · createdAt · lastActivityAt
//   forum_replies/{id}   threadId · parentId (null = top level) · body · author* · upvoterIds · createdAt
//
// Replies live in their own collection (filtered by threadId) so one listener per open thread is enough.
// A reply and its thread's counter are written in one batch; the rules only let the counter move by one.

import { useCallback, useEffect, useState } from "react"
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast, useUIStore } from "@/lib/store"
import { cooldownMessage, markPosted, stampRateLimit } from "@/lib/rateLimit"

export const THREADS = "forum_threads"
export const REPLIES = "forum_replies"
export const TITLE_MAX = 160
export const BODY_MAX = 5000

interface Authored {
  authorId: string
  authorHandle: string
  authorName: string
  authorAvatar: string
}

export interface ForumThread extends Authored {
  id: string
  title: string
  body: string
  topicTag: string
  linkedArticleId: string | null
  linkedArticleTitle: string | null
  linkedArticleHref: string | null
  replyCount: number
  upvoterIds: string[]
  createdAt: number
  lastActivityAt: number
}

export interface ForumReply extends Authored {
  id: string
  threadId: string
  parentId: string | null
  body: string
  upvoterIds: string[]
  createdAt: number
}

const warn = (msg: string, err: unknown) =>
  console.warn(`[forum] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)
const s = (v: unknown) => (typeof v === "string" ? v : "")
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

const authored = (d: Record<string, unknown>): Authored => ({
  authorId: s(d.authorId),
  authorHandle: s(d.authorHandle),
  authorName: s(d.authorName) || s(d.authorHandle) || "Member",
  authorAvatar: s(d.authorAvatar),
})

const threadFrom = (id: string, d: Record<string, unknown>): ForumThread => ({
  id,
  ...authored(d),
  title: s(d.title) || "Untitled discussion",
  body: s(d.body),
  topicTag: s(d.topicTag),
  linkedArticleId: s(d.linkedArticleId) || null,
  linkedArticleTitle: s(d.linkedArticleTitle) || null,
  linkedArticleHref: s(d.linkedArticleHref) || null,
  replyCount: n(d.replyCount),
  upvoterIds: ids(d.upvoterIds),
  createdAt: n(d.createdAt),
  lastActivityAt: n(d.lastActivityAt) || n(d.createdAt),
})

const replyFrom = (id: string, d: Record<string, unknown>): ForumReply => ({
  id,
  ...authored(d),
  threadId: s(d.threadId),
  parentId: s(d.parentId) || null,
  body: s(d.body),
  upvoterIds: ids(d.upvoterIds),
  createdAt: n(d.createdAt),
})

/** Every thread (most recent 300), live */
export function useThreads() {
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, THREADS), limit(300)),
        (snap) => {
          setThreads(snap.docs.map((d) => threadFrom(d.id, d.data())))
          setLoading(false)
        },
        (err) => {
          warn("threads listener stopped", err)
          setLoading(false)
        }
      ),
    []
  )
  return { threads, loading }
}

/** One thread's replies, live (oldest first) */
export function useReplies(threadId: string | null) {
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!threadId) {
      setReplies([])
      return
    }
    setLoading(true)
    return onSnapshot(
      query(collection(db, REPLIES), where("threadId", "==", threadId)),
      (snap) => {
        setReplies(snap.docs.map((d) => replyFrom(d.id, d.data())).sort((a, b) => a.createdAt - b.createdAt))
        setLoading(false)
      },
      (err) => {
        warn("replies listener stopped", err)
        setLoading(false)
      }
    )
  }, [threadId])
  return { replies, loading }
}

/** The signed-in member as a thread/reply author, or null */
export function useForumAuthor(): (Authored & { uid: string }) | null {
  const uid = useUIStore((st) => st.authUid)
  const handle = useUIStore((st) => st.currentUser)
  const profile = useUIStore((st) => st.profile)
  if (!uid || !handle) return null
  return { uid, authorId: uid, authorHandle: handle, authorName: profile.displayName || handle, authorAvatar: profile.avatarUrl || "" }
}

export function useForumActions() {
  const me = useForumAuthor()

  const startThread = useCallback(
    async (input: { title: string; body: string; topicTag: string; linked?: { id: string; title: string; href: string } | null }) => {
      if (!me) return null
      const wait = cooldownMessage("forum_thread")
      if (wait) {
        toast(wait)
        return null
      }
      const ref = doc(collection(db, THREADS))
      const now = Date.now()
      try {
        const batch = writeBatch(db)
        stampRateLimit({ doc, serverTimestamp }, batch, db, me.uid, "forum_thread", ref.id)
        batch.set(ref, {
          authorId: me.authorId,
          authorHandle: me.authorHandle,
          authorName: me.authorName,
          authorAvatar: me.authorAvatar,
          title: input.title.trim().slice(0, TITLE_MAX),
          body: input.body.trim().slice(0, BODY_MAX),
          topicTag: input.topicTag,
          linkedArticleId: input.linked?.id ?? null,
          linkedArticleTitle: input.linked?.title ?? null,
          linkedArticleHref: input.linked?.href ?? null,
          replyCount: 0,
          upvoterIds: [],
          createdAt: now,
          lastActivityAt: now,
        })
        await batch.commit()
        markPosted("forum_thread")
        return ref.id
      } catch (err) {
        warn("couldn't start the thread", err)
        toast("Couldn't post your discussion.", { tone: "error" })
        return null
      }
    },
    [me]
  )

  const reply = useCallback(
    async (threadId: string, body: string, parentId: string | null) => {
      if (!me) return false
      const wait = cooldownMessage("forum_reply")
      if (wait) {
        toast(wait)
        return false
      }
      const now = Date.now()
      try {
        const batch = writeBatch(db)
        const replyRef = doc(collection(db, REPLIES))
        stampRateLimit({ doc, serverTimestamp }, batch, db, me.uid, "forum_reply", replyRef.id)
        batch.set(replyRef, {
          threadId,
          parentId,
          body: body.trim().slice(0, BODY_MAX),
          authorId: me.authorId,
          authorHandle: me.authorHandle,
          authorName: me.authorName,
          authorAvatar: me.authorAvatar,
          upvoterIds: [],
          createdAt: now,
        })
        // The rules only accept the +1 together with the reply it counts (lastReplyId, audit F-15)
        batch.update(doc(db, THREADS, threadId), { replyCount: increment(1), lastActivityAt: now, lastReplyId: replyRef.id })
        await batch.commit()
        markPosted("forum_reply")
        return true
      } catch (err) {
        warn("couldn't reply", err)
        toast("Couldn't post your reply.", { tone: "error" })
        return false
      }
    },
    [me]
  )

  const toggleUpvote = useCallback(
    async (col: typeof THREADS | typeof REPLIES, id: string, upvoted: boolean) => {
      if (!me) {
        toast("Sign in to upvote.")
        return
      }
      try {
        await updateDoc(doc(db, col, id), { upvoterIds: upvoted ? arrayRemove(me.uid) : arrayUnion(me.uid) })
      } catch (err) {
        warn("couldn't vote", err)
        toast("Couldn't record your vote.", { tone: "error" })
      }
    },
    [me]
  )

  const deleteReply = useCallback(async (r: ForumReply) => {
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, REPLIES, r.id))
      batch.update(doc(db, THREADS, r.threadId), { replyCount: increment(-1), lastReplyId: r.id })
      await batch.commit()
    } catch (err) {
      warn("couldn't delete the reply", err)
      toast("Couldn't delete that reply.", { tone: "error" })
    }
  }, [])

  /** The thread and every reply under it (the rules let a thread's author clear its replies) */
  const deleteThread = useCallback(async (threadId: string) => {
    try {
      const snap = await getDocs(query(collection(db, REPLIES), where("threadId", "==", threadId)))
      const refs = snap.docs.map((d) => d.ref)
      for (let i = 0; i < refs.length; i += 450) {
        const batch = writeBatch(db)
        refs.slice(i, i + 450).forEach((r) => batch.delete(r))
        await batch.commit()
      }
      const batch = writeBatch(db)
      batch.delete(doc(db, THREADS, threadId))
      await batch.commit()
      return true
    } catch (err) {
      warn("couldn't delete the thread", err)
      toast("Couldn't delete that discussion.", { tone: "error" })
      return false
    }
  }, [])

  return { me, startThread, reply, toggleUpvote, deleteReply, deleteThread }
}
