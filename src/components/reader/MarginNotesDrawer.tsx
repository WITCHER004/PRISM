"use client"

import { useState } from "react"
import { X, Send, Trash2, MessageSquareQuote } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Avatar } from "@/components/ui/Avatar"
import { formatDate } from "@/lib/utils"
import type { MarginNote } from "@/lib/marginNotes"
import type { SelectionPayload } from "@/components/reader/SelectionPopover"

interface MarginNotesDrawerProps {
  open: boolean
  onClose: () => void
  articleId: string
  notes: MarginNote[]
  onAddNote: (noteText: string, payload: SelectionPayload) => void
  onDeleteNote: (noteId: string) => void
  activeSelection: SelectionPayload | null
  currentUsername: string | null
  currentDisplayName: string
}

export function MarginNotesDrawer({
  open,
  onClose,
  notes,
  onAddNote,
  onDeleteNote,
  activeSelection,
  currentUsername,
  currentDisplayName,
}: MarginNotesDrawerProps) {
  const [draftNote, setDraftNote] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draftNote.trim() || !activeSelection) return
    onAddNote(draftNote.trim(), activeSelection)
    setDraftNote("")
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div aria-hidden className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100]" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label="Margin Notes"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl z-[101] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-amber-500" />
                <h2 className="font-display font-semibold text-lg tracking-tight">Margin Notes</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--panel)] text-[var(--fg-muted)]">
                  {notes.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid place-items-center w-8 h-8 rounded-full hover:bg-[var(--panel)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                aria-label="Close notes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Note Composer (when text was selected) */}
            {activeSelection ? (
              <div className="p-4 border-b border-[var(--border)] bg-[var(--panel)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">
                  Anchored Selection (Paragraph {activeSelection.paragraphIndex + 1})
                </p>
                <blockquote className="text-xs italic text-[var(--fg)] border-l-2 border-amber-500 pl-2.5 py-0.5 mb-3 line-clamp-3 bg-[var(--surface)] p-2 rounded-r">
                  &ldquo;{activeSelection.text}&rdquo;
                </blockquote>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  <textarea
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="Write a margin reflection or critical note..."
                    rows={3}
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      disabled={!draftNote.trim()}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold bg-[#141413] text-[#f4f1ea] hover:bg-black disabled:opacity-40 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      Post Note
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="px-6 py-3 bg-[var(--panel)] border-b border-[var(--border)] text-xs text-[var(--fg-muted)]">
                Highlight any text in the article and click &ldquo;Add Margin Note&rdquo; to anchor a note to a paragraph.
              </div>
            )}

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notes.length === 0 ? (
                <div className="py-12 text-center text-[var(--fg-muted)] text-sm">
                  No margin notes yet. Highlight text in the story to annotate.
                </div>
              ) : (
                notes.map((note) => {
                  const isAuthor = currentUsername && note.authorUsername === currentUsername
                  return (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={note.authorAvatar} alt={note.authorDisplayName} size="sm" />
                          <div>
                            <p className="text-xs font-semibold leading-none">{note.authorDisplayName}</p>
                            <p className="text-[10px] text-[var(--fg-muted)] mt-0.5">
                              @{note.authorUsername} · {formatDate(new Date(note.createdAt).toISOString())}
                            </p>
                          </div>
                        </div>
                        {isAuthor && (
                          <button
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            className="text-[var(--fg-muted)] hover:text-red-500 p-1 rounded transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] text-[var(--fg-muted)] italic border-l-2 border-[var(--border-strong)] pl-2 line-clamp-2">
                        &ldquo;{note.selectedText}&rdquo;
                      </div>

                      <p className="text-xs leading-relaxed text-[var(--fg)] whitespace-pre-wrap">{note.noteText}</p>
                    </div>
                  )
                })
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

