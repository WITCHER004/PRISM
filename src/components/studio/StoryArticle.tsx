"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { BadgeCheck, Gem, Lock } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { MOCK_TAGS, type User } from "@/lib/data"
import type { PaywallChoice } from "@/lib/store"
import { useUIStore, toast } from "@/lib/store"
import { formatDate, numberWithCommas } from "@/lib/utils"
import { hasBody, wordCount } from "@/components/studio/studio-ui"
import { UserBadges } from "@/components/elite/EliteBadges"
import { ElitePaperBadge, MaybePaperScope, PaperAbstract, PaperGate, PaperRibbon } from "@/components/papers/ElitePaper"
import { LockedOnly, PaywalledBody } from "@/components/posts/PaywallContent"
import { deepReadMinutes, PAPER_MASK, PAPER_PREVIEW_FRACTION, type AdvancedPaper } from "@/lib/papers"
import { SelectionPopover, type SelectionPayload } from "@/components/reader/SelectionPopover"
import { MarginNotesDrawer } from "@/components/reader/MarginNotesDrawer"
import { QuoteCardModal } from "@/components/reader/QuoteCardModal"
import {
  loadLocalMarginNotes,
  saveLocalMarginNote,
  deleteLocalMarginNote,
  fetchRemoteMarginNotes,
  saveRemoteMarginNote,
  deleteRemoteMarginNote,
  type MarginNote,
} from "@/lib/marginNotes"

export function topicLabel(tag: string) {
  const known = MOCK_TAGS.find((t) => t.slug === tag)
  return known ? known.name : tag.replace(/-/g, " ")
}

const PAYWALL_LABEL: Record<PaywallChoice, string | null> = {
  FREE: null,
  METERED: "Member preview",
  SUBSCRIBER: "Members only",
  PAID: "Paid story",
}

interface StoryArticleProps {
  title: string
  subtitle?: string
  html: string
  tags: string[]
  paywall: PaywallChoice
  date: string
  author: User
  authorName: string
  /** Extra line under the byline (e.g. rating summary) */
  meta?: React.ReactNode
  /** Advanced Paper settings; gates the body to Elite readers */
  paper?: AdvancedPaper
  /** Needed to gate a paper's body */
  postId?: string
  /** Verification shown on the paper gate */
  paperReview?: string
  /** Rendered between the header and the body (e.g. the peer review dossier) */
  afterHeader?: React.ReactNode
}

// The reader's view of a story written in Prism — same structure and type as the article page.
export function StoryArticle({ title, subtitle, html, tags, paywall, date, author, authorName, meta, paper, postId, paperReview = "Editor-reviewed", afterHeader }: StoryArticleProps) {
  const topic = tags[0]
  const known = topic ? MOCK_TAGS.find((t) => t.slug === topic) : undefined
  const minutes = Math.max(1, Math.ceil(wordCount(html) / 238))
  const gate = PAYWALL_LABEL[paywall]
  const words = wordCount(html)

  const articleContainerRef = useRef<HTMLDivElement | null>(null)
  const [marginNotesOpen, setMarginNotesOpen] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState("")
  const [activeSelection, setActiveSelection] = useState<SelectionPayload | null>(null)
  const [notes, setNotes] = useState<MarginNote[]>([])

  const currentUser = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)
  const effectiveArticleId = postId ?? `article_${author.username}_${title.slice(0, 15)}`

  useEffect(() => {
    // Load local and fetch remote notes
    const local = loadLocalMarginNotes(effectiveArticleId)
    setNotes(local)
    fetchRemoteMarginNotes(effectiveArticleId).then((remote) => {
      if (remote.length) {
        setNotes((prev) => {
          const map = new Map<string, MarginNote>()
          for (const n of remote) map.set(n.id, n)
          for (const n of prev) map.set(n.id, n)
          return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
        })
      }
    })
  }, [effectiveArticleId])

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
      articleId: effectiveArticleId,
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
    deleteLocalMarginNote(effectiveArticleId, noteId)
    deleteRemoteMarginNote(noteId)
    toast("Margin note removed")
  }

  return (
    <MaybePaperScope paper={paper} author={author.username}>
    <article ref={articleContainerRef} className="relative">
      <SelectionPopover
        containerRef={articleContainerRef}
        onAddMarginNote={handleAddMarginNote}
        onCreateQuoteCard={handleCreateQuoteCard}
      />

      <MarginNotesDrawer
        open={marginNotesOpen}
        onClose={() => setMarginNotesOpen(false)}
        articleId={effectiveArticleId}
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
        articleTitle={title}
        authorName={authorName}
        authorHandle={author.username}
      />
      <header>
        {(topic || gate || paper) && (
          <div className="flex flex-wrap items-center gap-2">
            {topic &&
              (known ? (
                <Link
                  href={`/explore/${known.slug}`}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full hue-wash hue-ink text-sm font-medium"
                >
                  <span className="w-2 h-2 rounded-full hue-dot" />
                  {known.name}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full hue-wash hue-ink text-sm font-medium capitalize">
                  <span className="w-2 h-2 rounded-full hue-dot" />
                  {topicLabel(topic)}
                </span>
              ))}
            {paper ? (
              <ElitePaperBadge className="h-8 px-3 text-[0.8125rem]" />
            ) : gate && (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg-muted)]">
                {paywall === "PAID" ? <Gem className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {gate}
              </span>
            )}
          </div>
        )}

        <h1 className="display mt-6 text-[2.5rem] sm:text-[3.75rem] leading-[0.98] break-words">
          {title.trim() || "Untitled story"}
        </h1>
        {subtitle?.trim() && (
          <p className="mt-6 max-w-3xl text-xl sm:text-2xl leading-snug text-[var(--fg-muted)]">{subtitle}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center gap-3">
            <Avatar src={author.avatarUrl} alt={authorName} size="md" />
            <div>
              <Link href={`/${author.username}`} className="flex items-center gap-1 font-semibold hover:underline">
                {authorName}
                {author.isVerifiedHuman && (
                  <BadgeCheck className="w-4 h-4 text-[var(--accent)]" aria-label="Verified writer" />
                )}
              </Link>
              <UserBadges username={author.username} compact className="mt-1" />
              <p className="meta mt-0.5">{numberWithCommas(author.followerCount)} readers</p>
            </div>
          </div>
          <dl className="flex items-center gap-5 meta">
            <div>
              <dt className="sr-only">Date</dt>
              <dd>
                <time dateTime={date}>{formatDate(date)}</time>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Reading time</dt>
              <dd>{minutes} min read</dd>
            </div>
          </dl>
          {meta}
        </div>
      </header>

      {afterHeader && <div className="mt-8">{afterHeader}</div>}

      <div className="mt-12">
        {paper && (
          <>
            <PaperAbstract paper={paper} className="mb-8" />
            <PaperRibbon paper={paper} className="mb-10" />
          </>
        )}
        {paper && postId && hasBody(html) ? (
          <>
            <PaywalledBody postId={postId} paywalled html={html} previewFraction={PAPER_PREVIEW_FRACTION} mask={PAPER_MASK} />
            <LockedOnly postId={postId} paywalled>
              <PaperGate wordCount={words} deepReadMin={deepReadMinutes(words)} review={paperReview} />
            </LockedOnly>
          </>
        ) : hasBody(html) ? (
          <div className="prose-prism" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="prose-prism italic text-[var(--fg-subtle)]">Nothing here yet — the body is empty.</p>
        )}
      </div>
    </article>
    </MaybePaperScope>
  )
}
