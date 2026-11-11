"use client"

import { useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Loader2, MessageSquareText, Pencil, Star, Trash2 } from "lucide-react"
import { useUIStore, toast } from "@/lib/store"
import { mergeReviews, REVIEW_BODY_MAX, reviewKey, summarize, type ArticleReview } from "@/lib/reviews"
import { useHydrated } from "@/components/studio/useHydrated"
import { useIdentity } from "@/components/profile/identity"
import { UserBadges } from "@/components/elite/EliteBadges"
import { Avatar } from "@/components/ui/Avatar"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { Button } from "@/components/ui/Button"
import { dur, ease } from "@/lib/motion"
import { cn, formatRelativeDate } from "@/lib/utils"

/** Reviews for one article: sample reviews merged with ones written in this browser */
export function useArticleReviews(postId: string) {
  const hydrated = useHydrated()
  const local = useUIStore((s) => s.reviews)
  const currentUser = useUIStore((s) => s.currentUser)
  return useMemo(() => {
    const reviews = mergeReviews(postId, hydrated ? local : {})
    const mine = hydrated && currentUser ? (local[reviewKey(postId, currentUser)] ?? undefined) : undefined
    return { reviews, summary: summarize(reviews), mine, currentUser: hydrated ? currentUser : null, hydrated }
  }, [postId, local, currentUser, hydrated])
}

/* ── Stars ──────────────────────────────────────────────────────────────── */

/** Read-only stars; fractional values fill partially */
export function Stars({ value, className, size = "w-4 h-4" }: { value: number; className?: string; size?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className={cn("relative inline-block", size)}>
            <Star className={cn("absolute inset-0 text-[var(--border-strong)]", size)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("text-[var(--fg)] fill-[var(--fg)]", size)} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

const STAR_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]

/** Accessible 1–5 star picker (radio group; arrow keys move between stars) */
export function StarInput({ value, onChange, label = "Your rating" }: { value: number; onChange: (n: number) => void; label?: string }) {
  const name = useId()
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-3">
        <div className="flex items-center" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="peer sr-only"
                aria-label={`${n} star${n === 1 ? "" : "s"} — ${STAR_WORDS[n]}`}
              />
              <Star
                className={cn(
                  "w-7 h-7 transition-[color,fill,transform] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] rounded-sm",
                  n <= shown ? "text-[var(--fg)] fill-[var(--fg)]" : "text-[var(--border-strong)]",
                  hover === n && "scale-110"
                )}
              />
            </label>
          ))}
        </div>
        <span className="text-sm text-[var(--fg-muted)] min-w-[5rem]" aria-live="polite">
          {shown ? STAR_WORDS[shown] : "Tap to rate"}
        </span>
      </div>
    </fieldset>
  )
}

/* ── Summary chip (article header, cards) ──────────────────────────────── */

export function RatingChip({ postId, href, className }: { postId: string; href?: string; className?: string }) {
  const { summary } = useArticleReviews(postId)
  if (!summary.count) return null
  const body = (
    <>
      <Star className="w-3.5 h-3.5 fill-current" aria-hidden />
      <span className="font-semibold tabular-nums">{summary.average.toFixed(1)}</span>
      <span className="text-[var(--fg-muted)] tabular-nums">
        ({summary.count} review{summary.count === 1 ? "" : "s"})
      </span>
    </>
  )
  const cls = cn("inline-flex items-center gap-1 text-sm", className)
  const label = `Rated ${summary.average.toFixed(1)} out of 5 from ${summary.count} review${summary.count === 1 ? "" : "s"}`
  return href ? (
    <a href={href} className={cn(cls, "hover:underline underline-offset-2")} aria-label={label}>
      {body}
    </a>
  ) : (
    <span className={cls} aria-label={label} role="img">
      {body}
    </span>
  )
}

/* ── Full section ───────────────────────────────────────────────────────── */

export function ReviewsSection({ postId, postAuthor, className }: { postId: string; postAuthor: string; className?: string }) {
  const { reviews, summary, mine, currentUser, hydrated } = useArticleReviews(postId)
  const deleteReview = useUIStore((s) => s.deleteReview)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const isAuthor = currentUser === postAuthor
  const others = reviews.filter((r) => r.author !== currentUser)

  return (
    <section id="reviews" aria-labelledby="reviews-title" className={cn("scroll-mt-24", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="reviews-title" className="display text-[1.75rem]">
          Reader reviews
        </h2>
        {summary.count > 0 && <RatingChip postId={postId} />}
      </div>

      <div className="mt-6 grid md:grid-cols-[220px_minmax(0,1fr)] gap-6 md:gap-10">
        {/* Summary */}
        <div>
          <p className="display text-[3rem] leading-none tabular-nums">{summary.count ? summary.average.toFixed(1) : "–"}</p>
          <Stars value={summary.average} className="mt-2" />
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {summary.count ? `${summary.count} review${summary.count === 1 ? "" : "s"}` : "No reviews yet"}
          </p>
          <ul className="mt-4 space-y-1.5" aria-label="Rating distribution">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.distribution[star - 1]
              const share = summary.count ? (n / summary.count) * 100 : 0
              return (
                <li key={star} className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                  <span className="w-3 tabular-nums">{star}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                    <span className="block h-full rounded-full bg-[var(--fg)]" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-5 text-right tabular-nums">{n}</span>
                  <span className="sr-only">{`${n} with ${star} stars`}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="min-w-0">
          {/* Your review */}
          <div ref={formRef}>
            {!hydrated ? (
              <div className="h-28 rounded-[16px] bg-[var(--surface)] animate-pulse" aria-hidden />
            ) : !currentUser ? (
              <div className="p-5 rounded-[16px] border border-[var(--border)] bg-[var(--panel)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-[var(--fg-muted)]">Sign in to rate this article and leave a review.</p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
                >
                  Sign in
                </Link>
              </div>
            ) : isAuthor ? (
              <p className="p-5 rounded-[16px] border border-dashed border-[var(--border-strong)] text-sm text-[var(--fg-muted)]">
                You wrote this article, so you can&apos;t rate it. Readers&apos; reviews appear below.
              </p>
            ) : mine && !editing ? (
              <ReviewCard review={mine} own onEdit={() => setEditing(true)} onDelete={() => setConfirmDelete(true)} />
            ) : (
              <ReviewForm
                postId={postId}
                postAuthor={postAuthor}
                existing={mine}
                onDone={() => setEditing(false)}
                onCancel={mine ? () => setEditing(false) : undefined}
              />
            )}
          </div>

          {/* Everyone else */}
          {others.length > 0 && (
            <ul className="mt-6 space-y-3">
              <AnimatePresence initial={false}>
                {others.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                    exit={{ opacity: 0 }}
                  >
                    <ReviewCard review={r} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      <StudioDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your review?"
        description="Your rating and comment will be removed from this article."
      >
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              deleteReview(postId)
              setConfirmDelete(false)
              setEditing(false)
              toast("Review deleted")
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete review
          </Button>
        </DialogActions>
      </StudioDialog>
    </section>
  )
}

function ReviewForm({
  postId,
  postAuthor,
  existing,
  onDone,
  onCancel,
}: {
  postId: string
  postAuthor: string
  existing?: ArticleReview
  onDone: () => void
  onCancel?: () => void
}) {
  const saveReview = useUIStore((s) => s.saveReview)
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [body, setBody] = useState(existing?.body ?? "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const bodyId = useId()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) {
      setError("Choose a star rating first.")
      return
    }
    setSaving(true)
    const res = saveReview(postId, postAuthor, { rating, body })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast(existing ? "Review updated" : "Thanks for your review", { tone: "success" })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="p-5 rounded-[16px] border border-[var(--border)] bg-[var(--panel)]">
      <p className="text-sm font-semibold">{existing ? "Edit your review" : "Rate this article"}</p>
      <div className="mt-3">
        <StarInput
          value={rating}
          onChange={(n) => {
            setRating(n)
            setError("")
          }}
        />
      </div>
      <label htmlFor={bodyId} className="sr-only">
        Your review
      </label>
      <textarea
        id={bodyId}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={REVIEW_BODY_MAX}
        rows={3}
        placeholder="What worked, what didn't? (optional)"
        className="mt-3 w-full p-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm leading-relaxed resize-y focus:border-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-xs", error ? "text-[var(--error)]" : "text-[var(--fg-subtle)]")} role={error ? "alert" : undefined}>
          {error || `${body.length}/${REVIEW_BODY_MAX}`}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="accent" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {existing ? "Save changes" : "Post review"}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function ReviewCard({
  review,
  own = false,
  onEdit,
  onDelete,
}: {
  review: ArticleReview
  own?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const who = useIdentity(review.author)
  const name = who?.displayName ?? review.author
  return (
    <article className={cn("p-5 rounded-[16px] border bg-[var(--panel)]", own ? "border-[var(--fg)]/20" : "border-[var(--border)]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={who?.avatarUrl} alt={name} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
              <span className="truncate">{name}</span>
              <UserBadges username={review.author} compact />
              {own && <span className="ml-1 meta normal-case tracking-normal">Your review</span>}
            </p>
            <div className="flex items-center gap-2">
              <Stars value={review.rating} size="w-3.5 h-3.5" />
              <span className="sr-only">{review.rating} out of 5 stars</span>
              <span className="text-xs text-[var(--fg-subtle)]">
                {formatRelativeDate(review.updatedAt ?? review.createdAt)}
                {review.updatedAt && " · edited"}
              </span>
            </div>
          </div>
        </div>
        {own && (
          <div className="flex shrink-0 -mr-2 -mt-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit your review"
              className="grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete your review"
              className="grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--error)] hover:bg-[var(--surface)] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {review.body ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--fg-secondary)] whitespace-pre-line break-words">{review.body}</p>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          <MessageSquareText className="w-3.5 h-3.5" /> Rating only
        </p>
      )}
    </article>
  )
}
