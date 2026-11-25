"use client"

// Paragraph-anchored margin notes, stored in Firestore `margin_notes`:
//   articleId · paragraphIndex · selectedText · noteText · authorId · authorHandle · authorName ·
//   authorAvatar · createdAt

import { useCallback, useEffect, useState } from "react"
import { toast, useUIStore } from "@/lib/store"
import { cooldownMessage, markPosted, stampRateLimit } from "@/lib/rateLimit"

export interface MarginNote {
  id: string
  articleId: string
  paragraphIndex: number
  selectedText: string
  noteText: string
  authorUid?: string
  authorUsername: string
  authorDisplayName: string
  authorAvatar?: string
  createdAt: number
}

const NOTES = "margin_notes"
const fs = () => Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
const warn = (msg: string, err: unknown) =>
  console.warn(`[margin-notes] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

type NoteDoc = {
  articleId: string
  paragraphIndex: number
  selectedText: string
  noteText: string
  authorId: string
  authorHandle: string
  authorName: string
  authorAvatar: string
  createdAt: number
}

const fromDoc = (id: string, d: Partial<NoteDoc>): MarginNote => ({
  id,
  articleId: d.articleId ?? "",
  paragraphIndex: d.paragraphIndex ?? 0,
  selectedText: d.selectedText ?? "",
  noteText: d.noteText ?? "",
  authorUid: d.authorId,
  authorUsername: d.authorHandle ?? "",
  authorDisplayName: d.authorName ?? d.authorHandle ?? "Reader",
  authorAvatar: d.authorAvatar || undefined,
  createdAt: d.createdAt ?? 0,
})

/** Live margin notes on one article, plus add/remove for the signed-in reader */
export function useMarginNotes(articleId: string) {
  const [notes, setNotes] = useState<MarginNote[]>([])
  const uid = useUIStore((s) => s.authUid)
  const handle = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)

  useEffect(() => {
    if (!articleId) return
    let stop: (() => void) | undefined
    let cancelled = false
    fs()
      .then(([{ collection, query, where, onSnapshot }, { db }]) => {
        if (cancelled) return
        // Single-field filter (no composite index); sorted here
        stop = onSnapshot(
          query(collection(db, NOTES), where("articleId", "==", articleId)),
          (snap) => setNotes(snap.docs.map((d) => fromDoc(d.id, d.data() as Partial<NoteDoc>)).sort((a, b) => b.createdAt - a.createdAt)),
          (err) => warn("listener stopped", err)
        )
      })
      .catch((err) => warn("Firestore unavailable", err))
    return () => {
      cancelled = true
      stop?.()
    }
  }, [articleId])

  const add = useCallback(
    (noteText: string, payload: { paragraphIndex: number; text: string }) => {
      if (!uid || !handle) {
        toast("Sign in to leave margin notes.")
        return false
      }
      const data: NoteDoc = {
        articleId,
        paragraphIndex: payload.paragraphIndex,
        selectedText: payload.text,
        noteText: noteText.trim(),
        authorId: uid,
        authorHandle: handle,
        authorName: profile.displayName || handle,
        authorAvatar: profile.avatarUrl || "",
        createdAt: Date.now(),
      }
      const wait = cooldownMessage("margin_note")
      if (wait) {
        toast(wait)
        return false
      }
      fs()
        .then(([fsm, { db }]) => {
          const batch = fsm.writeBatch(db)
          const ref = fsm.doc(fsm.collection(db, NOTES))
          batch.set(ref, data)
          stampRateLimit(fsm, batch, db, uid, "margin_note", ref.id)
          return batch.commit().then(() => markPosted("margin_note"))
        })
        .catch((err) => {
          warn("couldn't save the note", err)
          toast("Couldn't save your margin note.", { tone: "error" })
        })
      return true
    },
    [articleId, uid, handle, profile.displayName, profile.avatarUrl]
  )

  const remove = useCallback((noteId: string) => {
    fs()
      .then(([{ doc, deleteDoc }, { db }]) => deleteDoc(doc(db, NOTES, noteId)))
      .catch((err) => {
        warn("couldn't delete the note", err)
        toast("Couldn't remove that note.", { tone: "error" })
      })
  }, [])

  return { notes, add, remove, currentUser: handle, displayName: profile.displayName || handle || "Reader" }
}
