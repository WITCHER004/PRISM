"use client"

import { useMemo, useRef, useState } from "react"
import { SelectionPopover, type SelectionPayload } from "@/components/reader/SelectionPopover"
import { MarginNotesDrawer } from "@/components/reader/MarginNotesDrawer"
import { QuoteCardModal } from "@/components/reader/QuoteCardModal"
import { InlineHighlights } from "@/components/reader/InlineHighlights"
import { ResumeToast } from "@/components/reader/ResumeToast"
import { toast } from "@/lib/store"
import { useMarginNotes } from "@/lib/marginNotes"
import { useHighlightActions, useMyHighlights, type HighlightColor } from "@/lib/highlights"
import { useReadingTracker, type ReadingMeta } from "@/lib/readingProgress"

interface ArticleInteractiveProps {
  articleId: string
  articleTitle: string
  authorName: string
  authorHandle: string
  /**
   * Set on published stories: enables private highlights, cross-device resume and reading history.
   * Left out for unpublished previews.
   */
  reading?: Omit<ReadingMeta, "articleId" | "articleTitle" | "authorName">
  className?: string
  children: React.ReactNode
}

/**
 * Wraps an article reading view with highlight-to-share Quote Card Studio, paragraph-anchored
 * Margin Notes, private highlights, and the reader's synced position and history.
 */
export function ArticleInteractiveWrapper({
  articleId,
  articleTitle,
  authorName,
  authorHandle,
  reading,
  className,
  children,
}: ArticleInteractiveProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [marginNotesOpen, setMarginNotesOpen] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState("")
  const [activeSelection, setActiveSelection] = useState<SelectionPayload | null>(null)
  const { notes, add, remove, currentUser, displayName } = useMarginNotes(articleId)

  const enabled = !!reading
  const { highlights } = useMyHighlights(articleId, enabled)
  const highlightActions = useHighlightActions()

  const meta = useMemo<ReadingMeta | null>(
    () =>
      reading
        ? { articleId, articleTitle, authorName, ...reading }
        : null,
    // Primitive deps: callers pass a fresh object each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articleId, articleTitle, authorName, reading?.href, reading?.topic, reading?.articleSubtitle, reading?.authorAvatar, reading?.isAdvancedPaper]
  )
  const { resumed, dismissResume } = useReadingTracker(containerRef, meta)

  const handleAddMarginNote = (payload: SelectionPayload) => {
    setActiveSelection(payload)
    setMarginNotesOpen(true)
  }

  const handleCreateQuoteCard = (payload: SelectionPayload) => {
    setSelectedQuote(payload.text)
    setQuoteModalOpen(true)
  }

  const handlePrivateHighlight = async (payload: SelectionPayload, color: HighlightColor) => {
    if (!reading) return
    window.getSelection()?.removeAllRanges()
    const ok = await highlightActions.add({
      articleId,
      articleTitle,
      authorName,
      articleHref: reading.href,
      paragraphIndex: payload.paragraphIndex,
      selectedText: payload.text,
      color,
    })
    if (ok) toast("Highlighted — only you can see it", { tone: "success", action: { label: "Vault", href: "/profile#highlights" } })
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
    <div ref={containerRef} className={className ?? "relative"}>
      <SelectionPopover
        containerRef={containerRef}
        onAddMarginNote={handleAddMarginNote}
        onCreateQuoteCard={handleCreateQuoteCard}
        onPrivateHighlight={enabled ? handlePrivateHighlight : undefined}
      />

      {enabled && <InlineHighlights containerRef={containerRef} highlights={highlights} />}
      {enabled && <ResumeToast resumed={resumed} onDismiss={dismissResume} />}

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
