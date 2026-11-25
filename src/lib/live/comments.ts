"use client"

// Responses on an article, live from Firestore `comments`:
//   articleId · parentId · body · authorId · authorHandle · authorName · authorAvatar · likerIds · createdAt

import { useCallback, useEffect, useState } from "react"
import { COL } from "@/lib/live/schema"
import { toast, useUIStore } from "@/lib/store"
import { cooldownMessage, markPosted, stampRateLimit } from "@/lib/rateLimit"

export interface LiveComment {
  id: string
  articleId: string
  parentId: string | null
  body: string
  authorUid: string
  authorHandle: string
  authorName: string
  authorAvatar?: string
  likerIds: string[]
  createdAt: string
}

const fs = () => Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
const warn = (msg: string, err: unknown) =>
  console.warn(`[comments] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

export function useComments(articleId: string) {
  const [comments, setComments] = useState<LiveComment[]>([])
  const [ready, setReady] = useState(false)
  const uid = useUIStore((s) => s.authUid)
  const handle = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    fs()
      .then(([{ collection, query, where, onSnapshot }, { db }]) => {
        if (cancelled) return
        stop = onSnapshot(
          query(collection(db, COL.comments), where("articleId", "==", articleId)),
          (snap) => {
            setComments(
              snap.docs.map((d) => {
                const x = d.data()
                return {
                  id: d.id,
                  articleId: x.articleId,
                  parentId: x.parentId ?? null,
                  body: String(x.body ?? ""),
                  authorUid: x.authorId ?? "",
                  authorHandle: x.authorHandle ?? "",
                  authorName: x.authorName ?? x.authorHandle ?? "Reader",
                  authorAvatar: x.authorAvatar || undefined,
                  likerIds: Array.isArray(x.likerIds) ? x.likerIds : [],
                  createdAt: new Date(typeof x.createdAt === "number" ? x.createdAt : 0).toISOString(),
                }
              })
            )
            setReady(true)
          },
          (err) => {
            warn("listener stopped", err)
            setReady(true)
          }
        )
      })
      .catch((err) => warn("Firestore unavailable", err))
    return () => {
      cancelled = true
      stop?.()
    }
  }, [articleId])

  /** Posts a response (or a reply when parentId is set). Resolves to the new id, or null. */
  const add = useCallback(
    async (body: string, parentId?: string): Promise<string | null> => {
      const text = body.trim()
      if (!uid || !handle || !text) return null
      const wait = cooldownMessage("comment")
      if (wait) {
        toast(wait)
        return null
      }
      try {
        const [fsm, { db }] = await fs()
        const ref = fsm.doc(fsm.collection(db, COL.comments))
        const batch = fsm.writeBatch(db)
        stampRateLimit(fsm, batch, db, uid, "comment", ref.id)
        batch.set(ref, {
          articleId,
          parentId: parentId ?? null,
          body: text,
          authorId: uid,
          authorHandle: handle,
          authorName: profile.displayName || handle,
          authorAvatar: profile.avatarUrl || "",
          likerIds: [],
          createdAt: Date.now(),
        })
        await batch.commit()
        markPosted("comment")
        return ref.id
      } catch (err) {
        warn("couldn't post", err)
        toast("Couldn't post your response. Try again.", { tone: "error" })
        return null
      }
    },
    [articleId, uid, handle, profile.displayName, profile.avatarUrl]
  )

  const toggleLike = useCallback(
    (commentId: string) => {
      if (!uid) {
        toast("Sign in to like responses.")
        return
      }
      const liked = comments.find((c) => c.id === commentId)?.likerIds.includes(uid)
      fs()
        .then(([{ doc, updateDoc, arrayUnion, arrayRemove }, { db }]) =>
          updateDoc(doc(db, COL.comments, commentId), { likerIds: liked ? arrayRemove(uid) : arrayUnion(uid) })
        )
        .catch((err) => warn("couldn't save the like", err))
    },
    [uid, comments]
  )

  return { comments, ready, add, toggleLike, uid }
}
