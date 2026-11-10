"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, FileQuestion, Pencil, PenLine } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { StoryArticle } from "@/components/studio/StoryArticle"
import { PeerReviewSection } from "@/components/posts/PeerReviewSection"
import { useHydrated } from "@/components/studio/useHydrated"
import { useWriter } from "@/components/studio/studio-ui"
import { useUIStore } from "@/lib/store"
import { hueStyle } from "@/lib/topics"

// A story written and published in this browser (demo mode keeps drafts in local storage)
export default function LocalStoryPage() {
  const { id } = useParams<{ id: string }>()
  const hydrated = useHydrated()
  const draft = useUIStore((s) => s.drafts[id])
  const { user, displayName } = useWriter()

  const pill =
    "inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium transition-colors"

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)]" style={hueStyle(draft?.tags[0])}>
      {draft && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] hue-glow" />}
      <SiteHeader />
      <main className="relative flex-1">
        {!hydrated ? (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-14" aria-busy="true" aria-label="Loading story">
            <div className="h-8 w-28 rounded-full bg-[var(--surface)] animate-pulse" />
            <div className="mt-6 h-16 w-4/5 rounded-[14px] bg-[var(--surface)] animate-pulse" />
            <div className="mt-6 h-7 w-3/5 rounded-[10px] bg-[var(--surface)] animate-pulse" />
          </div>
        ) : !draft ? (
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-24 text-center">
            <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
              <FileQuestion className="w-6 h-6" />
            </span>
            <p className="meta mt-6">Story not found</p>
            <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">This story isn&apos;t here</h1>
            <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
              Stories written in demo mode live in the browser they were written in. It may have been deleted.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/dashboard" className={`${pill} justify-center h-11 px-6 bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}>
                Go to Studio
              </Link>
              <Link href="/" className={`${pill} justify-center h-11 px-6 border border-[var(--border-strong)] hover:border-[var(--fg)]`}>
                Back to reading
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-24">
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

            {draft.status === "draft" && (
              <div
                role="note"
                className="mb-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-4 rounded-[16px] bg-[var(--warning-subtle)] text-[var(--warning)]"
              >
                <p className="text-sm">
                  <span className="font-semibold">Draft preview.</span> Only you can see this — it isn&apos;t published yet.
                </p>
                <Link
                  href={`/editor/${draft.id}`}
                  className={`${pill} shrink-0 justify-center bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}
                >
                  <PenLine className="w-4 h-4" /> Continue editing
                </Link>
              </div>
            )}

            <StoryArticle
              id={draft.id}
              title={draft.title}
              subtitle={draft.subtitle}
              html={draft.contentHtml}
              tags={draft.tags}
              paywall={draft.paywall}
              date={draft.publishedAt ?? draft.updatedAt}
              author={user}
              authorName={displayName}
            />

            <PeerReviewSection postId={draft.id} postTitle={draft.title} />

            <div className="mt-16 pt-8 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <p className="meta">
                {draft.status === "published" ? "Published from your Studio" : "Saved as a draft"}
              </p>
              <div className="flex gap-2">
                <Link href={`/editor/${draft.id}`} className={`${pill} border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]`}>
                  <Pencil className="w-4 h-4" /> Edit
                </Link>
                <Link href="/dashboard" className={`${pill} bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}>
                  Back to Studio
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
