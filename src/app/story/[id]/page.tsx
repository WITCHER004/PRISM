"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, FileQuestion, Pencil, PenLine } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { StoryArticle } from "@/components/studio/StoryArticle"
import { useHydrated } from "@/components/studio/useHydrated"
import { useIdentity } from "@/components/profile/identity"
import { StatusPill } from "@/components/moderation/Phase1Report"
import { ShareBar } from "@/components/share/ShareArticle"
import { RatingChip, ReviewsSection } from "@/components/reviews/ArticleReviews"
import { ViewTracker } from "@/components/elite/ViewTracker"
import { MOCK_USERS } from "@/lib/data"
import { STATUS_META } from "@/lib/moderation/workflow"
import { useUIStore } from "@/lib/store"
import { hueStyle } from "@/lib/topics"
import { useEffect, useMemo } from "react"
import { CraftBadge } from "@/components/craft/CraftBadge"
import { PeerDossierCard } from "@/components/dossier/PeerDossierCard"
import { wordCount } from "@/components/studio/studio-ui"
import { certificateFrom } from "@/lib/craft"
import { dossierFromPanel } from "@/lib/dossier"
import { mirrorRecord } from "@/lib/records"

const pill = "inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium transition-colors"

// A story written in this browser (demo mode keeps drafts in local storage).
// Readers see the version a reviewer approved; the author also sees where their latest edits stand.
export default function LocalStoryPage() {
  const { id } = useParams<{ id: string }>()
  const hydrated = useHydrated()
  const draft = useUIStore((s) => s.drafts[id])
  const currentUser = useUIStore((s) => s.currentUser)
  const author = useIdentity(draft?.authorUsername)

  const isAuthor = !!draft && draft.authorUsername === currentUser
  const live = draft?.live

  // Proof of craft for the published version, and the panel's dossier once it has decided
  const certificate = useMemo(
    () => (draft?.craft && live ? certificateFrom(draft.craft, wordCount(live.contentHtml), draft.liveAiPercent ?? draft.phase1?.aiPercent) : null),
    [draft?.craft, draft?.liveAiPercent, draft?.phase1?.aiPercent, live]
  )
  const dossier = useMemo(
    () => (draft && live && draft.track === "PEER_PANEL" ? dossierFromPanel(draft.id, draft.panel, draft.publishedAt) : null),
    [draft, live]
  )

  // The author's browser holds the source copy; mirror it to Firestore (best effort, never blocks)
  useEffect(() => {
    if (!isAuthor || !draft) return
    if (certificate) mirrorRecord("craft_certificates", draft.id, { articleId: draft.id, author: draft.authorUsername, ...certificate })
    if (dossier) mirrorRecord("peer_dossiers", draft.id, dossier)
  }, [isAuthor, draft, certificate, dossier])
  // The author previews the working copy until something is live; everyone else only sees live versions
  const view = live ?? (isAuthor ? draft : undefined)

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)]" style={hueStyle(view?.tags[0])}>
      {view && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] hue-glow" />}
      <SiteHeader />
      <main className="relative flex-1">
        {!hydrated ? (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-14" aria-busy="true" aria-label="Loading story">
            <div className="h-8 w-28 rounded-full bg-[var(--surface)] animate-pulse" />
            <div className="mt-6 h-16 w-4/5 rounded-[14px] bg-[var(--surface)] animate-pulse" />
            <div className="mt-6 h-7 w-3/5 rounded-[10px] bg-[var(--surface)] animate-pulse" />
          </div>
        ) : !draft || !view || !author ? (
          <NotFound unpublished={!!draft} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-24">
            {isAuthor && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 h-10 pl-2 pr-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Studio
                </Link>
                <Link
                  href={`/editor/${draft.id}`}
                  className={`${pill} border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]`}
                >
                  <Pencil className="w-4 h-4" /> Edit story
                </Link>
              </div>
            )}

            {/* Author-only: where the latest version stands */}
            {isAuthor && (draft.status !== "PUBLISHED" || !live) && (
              <div
                role="note"
                className="mb-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-4 rounded-[16px] border border-[var(--border)] bg-[var(--panel)]"
              >
                <div className="flex items-start gap-3">
                  <StatusPill status={draft.status} tracker className="mt-0.5" />
                  <p className="text-sm text-[var(--fg-muted)]">
                    {live
                      ? `Readers see the published version. Your latest edits: ${STATUS_META[draft.status].tracker.toLowerCase()}.`
                      : "Preview — only you can see this until a reviewer approves it."}
                  </p>
                </div>
                <Link
                  href={`/editor/${draft.id}`}
                  className={`${pill} shrink-0 justify-center bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}
                >
                  <PenLine className="w-4 h-4" /> Open in editor
                </Link>
              </div>
            )}

            <StoryArticle
              title={view.title}
              subtitle={view.subtitle}
              html={view.contentHtml}
              tags={view.tags}
              paywall={view.paywall}
              paper={view.paper}
              postId={draft.id}
              paperReview={draft.track === "PEER_PANEL" ? "Peer-panel verified" : "Editor-reviewed"}
              date={draft.publishedAt ?? draft.updatedAt}
              author={{ ...(author.base ?? MOCK_USERS[0]), username: author.username, avatarUrl: author.avatarUrl }}
              authorName={author.displayName}
              meta={
                live ? (
                  <>
                    <RatingChip postId={draft.id} href="#reviews" />
                    {certificate && <CraftBadge certificate={certificate} authorName={author.displayName} />}
                  </>
                ) : undefined
              }
              afterHeader={
                dossier ? <PeerDossierCard dossier={dossier} authorName={author.displayName} authorAvatar={author.avatarUrl} /> : undefined
              }
            />

            {live && (
              <>
                <ViewTracker postId={draft.id} author={draft.authorUsername} />
                <div className="mt-16 pt-8 border-t border-[var(--border)]">
                  <ShareBar
                    title={live.title.trim() || "Untitled story"}
                    url={`/story/${draft.id}`}
                    authorName={author.displayName}
                    handles={author.handles}
                    asAuthor={isAuthor}
                  />
                </div>
                <ReviewsSection postId={draft.id} postAuthor={draft.authorUsername} className="mt-16" />
              </>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function NotFound({ unpublished }: { unpublished: boolean }) {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-24 text-center">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
        <FileQuestion className="w-6 h-6" />
      </span>
      <p className="meta mt-6">{unpublished ? "Not published" : "Story not found"}</p>
      <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">
        {unpublished ? "This story isn't published yet" : "This story isn't here"}
      </h1>
      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
        {unpublished
          ? "Stories appear once they pass Prism's AI-content check and a review by our editors."
          : "Stories written in demo mode live in the browser they were written in. It may have been deleted."}
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/" className={`${pill} justify-center h-11 px-6 bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}>
          Back to reading
        </Link>
        <Link href="/dashboard" className={`${pill} justify-center h-11 px-6 border border-[var(--border-strong)] hover:border-[var(--fg)]`}>
          Go to Studio
        </Link>
      </div>
    </div>
  )
}
