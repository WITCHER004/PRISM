"use client"

import { useState, useRef } from "react"
import { SelectionPopover, type SelectionPayload } from "@/components/reader/SelectionPopover"
import { MarginNotesDrawer } from "@/components/reader/MarginNotesDrawer"
import { QuoteCardModal } from "@/components/reader/QuoteCardModal"
import { toast } from "@/lib/store"
import { useMarginNotes } from "@/lib/marginNotes"

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
  const { notes, add, remove, currentUser, displayName } = useMarginNotes(articleId)

  const handleAddMarginNote = (payload: SelectionPayload) => {
    setActiveSelection(payload)
    setMarginNotesOpen(true)
  }

  const handleCreateQuoteCard = (payload: SelectionPayload) => {
    setSelectedQuote(payload.text)
    setQuoteModalOpen(true)
  }

  const handleSaveNote = (noteText: string, payload: SelectionPayload) => {
    if (add(noteText, payload)) toast("Margin note added to paragraph!")
    setActiveSelection(null)
  }

  const handleDeleteNote = (noteId: string) => {
    remove(noteId)
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
        currentDisplayName={displayName}
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

