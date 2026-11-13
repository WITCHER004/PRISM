"use client"

import { useState, useRef, useEffect } from "react"
import { SelectionPopover, type SelectionPayload } from "@/components/reader/SelectionPopover"
import { MarginNotesDrawer } from "@/components/reader/MarginNotesDrawer"
import { QuoteCardModal } from "@/components/reader/QuoteCardModal"
import { useUIStore, toast } from "@/lib/store"
import {
  loadLocalMarginNotes,
  saveLocalMarginNote,
  deleteLocalMarginNote,
  fetchRemoteMarginNotes,
  saveRemoteMarginNote,
  deleteRemoteMarginNote,
  type MarginNote,
} from "@/lib/marginNotes"

interface ArticleInteractiveProps {
  articleId: string
  articleTitle: string
  authorName: string
  authorHandle: string
  children: React.ReactNode
}

/**
 * Wraps an article reading view with highlight-to-share Quote Card Studio
 * and paragraph-anchored Margin Notes.
 */
export function ArticleInteractiveWrapper({
  articleId,
  articleTitle,
  authorName,
  authorHandle,
  children,
}: ArticleInteractiveProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [marginNotesOpen, setMarginNotesOpen] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState("")
  const [activeSelection, setActiveSelection] = useState<SelectionPayload | null>(null)
  const [notes, setNotes] = useState<MarginNote[]>([])

  const currentUser = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)

  useEffect(() => {
    const local = loadLocalMarginNotes(articleId)
    setNotes(local)
    fetchRemoteMarginNotes(articleId).then((remote) => {
      if (remote.length) {
        setNotes((prev) => {
          const map = new Map<string, MarginNote>()
          for (const n of remote) map.set(n.id, n)
          for (const n of prev) map.set(n.id, n)
          return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
        })
      }
    })
  }, [articleId])

  const handleAddMarginNote = (payload: SelectionPayload) => {
    setActiveSelection(payload)
    setMarginNotesOpen(true)
  }

  const handleCreateQuoteCard = (payload: SelectionPayload) => {
    setSelectedQuote(payload.text)
    setQuoteModalOpen(true)
  }

  const handleSaveNote = (noteText: string, payload: SelectionPayload) => {
    const newNote: MarginNote = {
      id: "note_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      articleId,
      paragraphIndex: payload.paragraphIndex,
      selectedText: payload.text,
      noteText,
      authorUsername: currentUser || "reader",
      authorDisplayName: profile.displayName || currentUser || "Reader",
      authorAvatar: profile.avatarUrl,
      createdAt: Date.now(),
    }

    setNotes((prev) => [newNote, ...prev])
    saveLocalMarginNote(newNote)
    saveRemoteMarginNote(newNote)
    toast("Margin note added to paragraph!")
    setActiveSelection(null)
  }

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    deleteLocalMarginNote(articleId, noteId)
    deleteRemoteMarginNote(noteId)
    toast("Margin note removed")
  }

  return (
    <div ref={containerRef} className="relative">
      <SelectionPopover
        containerRef={containerRef}
        onAddMarginNote={handleAddMarginNote}
        onCreateQuoteCard={handleCreateQuoteCard}
      />

      <MarginNotesDrawer
        open={marginNotesOpen}
        onClose={() => setMarginNotesOpen(false)}
        articleId={articleId}
        notes={notes}
        onAddNote={handleSaveNote}
        onDeleteNote={handleDeleteNote}
        activeSelection={activeSelection}
        currentUsername={currentUser}
        currentDisplayName={profile.displayName || currentUser || "Reader"}
      />

      <QuoteCardModal
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        quote={selectedQuote}
        articleTitle={articleTitle}
        authorName={authorName}
        authorHandle={authorHandle}
      />

      {children}
    </div>
  )
}

