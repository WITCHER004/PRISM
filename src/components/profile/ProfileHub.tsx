"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, FileText, Lock, PenLine, Settings2, Sparkles, Star, UserRoundPen, Wallet } from "lucide-react"
import { EliteNameBadge } from "@/components/elite/EliteBadges"
import { openUpgrade } from "@/components/elite/UpgradeDialog"
import { useSubscription, useWallet } from "@/components/elite/hooks"
import { useAccess, usePanelInbox } from "@/components/providers/useAccess"
import { PanelApplyButton } from "@/components/panel/PanelApplication"
import { PANEL_PASS_THRESHOLD, PANEL_SIZE, PAYOUT_RPM_INR } from "@/lib/elite/config"
import { useUIStore, type Draft } from "@/lib/store"
import { summarize } from "@/lib/reviews"
import { STATUS_META } from "@/lib/moderation/workflow"
import type { ArticleStatus } from "@/lib/moderation/types"
import { useHydrated } from "@/components/studio/useHydrated"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { StatusPill } from "@/components/moderation/Phase1Report"
import { RatingChip } from "@/components/reviews/ArticleReviews"
import { htmlToText } from "@/components/studio/studio-ui"
import { RoleBadge, useIdentity } from "./identity"
import { UserBadges } from "@/components/elite/EliteBadges"
import { SocialLinks } from "./SocialLinks"
import { EditProfileDialog } from "./EditProfileDialog"
import { ReadingVault } from "./ReadingVault"
import { cn, formatDate, formatRelativeDate } from "@/lib/utils"

const TRACKED: ArticleStatus[] = [
  "PHASE_1_FAILED",
  "PENDING_EMPLOYEE_REVIEW",
  "PENDING_PEER_PANEL",
  "COUNTER_SUBMITTED",
  "PUBLISHED",
  "REJECTED",
]

export function ProfileHub({ username }: { username: string }) {
  const hydrated = useHydrated()
  const identity = useIdentity(username)
  const currentUser = useUIStore((s) => s.currentUser)
  const drafts = useUIStore((s) => s.drafts)
  const [ratings, setRatings] = useState<{ rating: number }[]>([])
  const [editing, setEditing] = useState(false)
  const access = useAccess(username)

  const isMe = hydrated && currentUser === username
  const mine = useMemo(
    () =>
      hydrated
        ? Object.values(drafts)
            .filter((d) => d.authorUsername === username)
            .sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))
        : [],
    [drafts, hydrated, username]
  )
  const liveLocal = mine.filter((d) => d.live)

  // Ratings across everything this author has published (Firestore reviews where postAuthor == handle)
  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
      .then(([{ collection, query, where, onSnapshot }, { db }]) => {
        if (cancelled) return
        stop = onSnapshot(
          query(collection(db, "reviews"), where("postAuthor", "==", username)),
          (snap) => setRatings(snap.docs.map((d) => ({ rating: Number(d.data().rating) || 0 }))),
          () => setRatings([])
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
      stop?.()
    }
  }, [username])
  const rating = useMemo(() => summarize(ratings), [ratings])

  if (!identity) return null
  const counts = Object.fromEntries(TRACKED.map((s) => [s, mine.filter((d) => d.status === s).length])) as Record<ArticleStatus, number>

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
      {/* Identity */}
      <section className="panel p-6 sm:p-8" aria-labelledby="profile-name">
        <div className="flex flex-col sm:flex-row gap-6">
          <Avatar src={identity.avatarUrl} alt={identity.displayName} size="xl" className="w-24 h-24 sm:w-28 sm:h-28" priority />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 id="profile-name" className="display text-[2rem] sm:text-[2.5rem] leading-none break-words">
                    {identity.displayName}
                  </h1>
                  <RoleBadge role={identity.role} verified={identity.base?.isVerifiedHuman} />
                  {hydrated && access.isElite && <EliteNameBadge className="h-6 px-2 text-xs" />}
                </div>
                <UserBadges username={identity.username} className="mt-2.5" />
                <p className="mt-1.5 text-sm text-[var(--fg-muted)]">@{identity.username}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {isMe ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
                    >
                      <UserRoundPen className="w-4 h-4" /> Edit profile
                    </button>
                    <Link
                      href="/settings"
                      aria-label="Settings"
                      className="grid place-items-center w-10 h-10 rounded-full border border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
                    >
                      <Settings2 className="w-4 h-4" />
                    </Link>
                  </>
                ) : (
                  <FollowButton username={identity.username} displayName={identity.displayName} />
                )}
              </div>
            </div>

            <p className={cn("mt-4 max-w-2xl leading-relaxed", identity.bio ? "text-[var(--fg-secondary)]" : "text-[var(--fg-subtle)]")}>
              {identity.bio || (isMe ? "Add a bio so readers know who's writing." : "No bio yet.")}
            </p>
            <SocialLinks handles={identity.handles} className="mt-4" />

            <dl className="mt-6 pt-5 border-t border-[var(--border)] grid grid-cols-3 gap-4 max-w-md">
              <Stat label="Published" value={String(liveLocal.length)} />
              <Stat
                label="Avg rating"
                value={
                  rating.count ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-4 h-4 fill-current" aria-hidden />
                      {rating.average.toFixed(1)}
                    </span>
                  ) : (
                    "–"
                  )
                }
              />
              <Stat label="Reviews" value={String(rating.count)} />
            </dl>
          </div>
        </div>
      </section>

      {/* What this account can do; every card unlocks in place as the role changes */}
      {isMe && <Capabilities username={username} />}

      {/* Private highlights + reading history (owner-only Firestore data) */}
      {isMe && <ReadingVault />}

      {/* Author tracker (own profile only) */}
      {isMe && (
        <section id="tracker" className="mt-10 scroll-mt-24" aria-labelledby="tracker-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="tracker-title" className="display text-[1.75rem]">
                Author tracker
              </h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Where each submission stands: Phase 1, employee review or the peer panel, appeals, and the outcome.
              </p>
            </div>
            <Link
              href="/editor/new"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
            >
              <PenLine className="w-4 h-4" /> New story
            </Link>
          </div>

          <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Submissions by status">
            {TRACKED.map((s) => (
              <li key={s} className="panel p-4 min-w-0">
                <StatusPill status={s} tracker className="max-w-full px-2.5 py-0.5 text-[11px]" />
                <p className="display mt-3 text-[1.75rem] tabular-nums">{counts[s]}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 panel overflow-hidden">
            {mine.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="mx-auto w-6 h-6 text-[var(--fg-subtle)]" />
                <p className="mt-3 font-semibold">Nothing submitted yet</p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">Write a story and submit it for review to track it here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {mine.map((d) => (
                  <TrackerRow key={d.id} draft={d} />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Published */}
      <section className="mt-12" aria-labelledby="published-title">
        <h2 id="published-title" className="display text-[1.75rem]">
          Published articles
        </h2>
        {liveLocal.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--fg-muted)]">
            {isMe ? "Stories appear here once a reviewer approves them." : `${identity.displayName} hasn't published yet.`}
          </p>
        ) : (
          <div className="mt-5 max-w-3xl">
            {liveLocal.map((d) => (
              <LiveStoryRow key={d.id} draft={d} />
            ))}
          </div>
        )}
      </section>

      {isMe && <EditProfileDialog open={editing} onOpenChange={setEditing} />}
    </div>
  )
}

function Capabilities({ username }: { username: string }) {
  const access = useAccess(username)
  const { subscription } = useSubscription(username)
  const wallet = useWallet(username)
  const inbox = usePanelInbox(access.isPanelMember ? username : null)
  const card = "panel p-5 sm:p-6 flex flex-col"

  return (
    <section id="capabilities" className="mt-10 scroll-mt-24" aria-labelledby="capabilities-title">
      <h2 id="capabilities-title" className="display text-[1.75rem]">
        Capabilities
      </h2>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">One account. Each step unlocks more of Prism, right here.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Membership */}
        <article className={cn(card, access.isElite && "border-[var(--elite-line)] bg-[var(--elite-wash)]")}>
          <p className="meta">Membership</p>
          {access.isElite ? (
            <>
              <h3 className="mt-2 flex items-center gap-2 font-display text-lg font-semibold">
                Prism Elite <EliteNameBadge />
              </h3>
              <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed flex-1">
                Full Advanced Papers, Elite publishing, per-view earnings and the peer panel.
                {subscription.subscribedAt && ` Member since ${formatDate(subscription.subscribedAt)}.`}
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-2 font-display text-lg font-semibold">Free</h3>
              <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed flex-1">
                Elite opens every Advanced Paper, Elite-only publishing and panel review, and earnings.
              </p>
              <button
                type="button"
                onClick={openUpgrade}
                className="mt-4 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
              >
                <Sparkles className="w-4 h-4 text-[var(--gold)]" /> Upgrade to Prism Elite
              </button>
            </>
          )}
        </article>

        {/* Earnings & View Monetization */}
        <article className={card} aria-disabled={!access.isElite}>
          <p className="meta flex items-center gap-1.5">
            {!access.isElite && <Lock className="w-3 h-3" />} Earnings &amp; view monetization
          </p>
          {access.isElite ? (
            <>
              <p className="mt-2 display text-[2rem] leading-none tabular-nums">₹{wallet.availableBalance.toFixed(2)}</p>
              <p className="mt-2 text-sm text-[var(--fg-muted)] flex-1">
                {wallet.totalViews.toLocaleString("en-US")} views counted · ₹{PAYOUT_RPM_INR.toFixed(2)} per 1,000 unique readers
              </p>
              <Link
                href="/dashboard/earnings"
                className="mt-4 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)]"
              >
                <Wallet className="w-4 h-4" /> Open earnings
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-lg font-semibold text-[var(--fg-muted)]">Locked</p>
              <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed flex-1">
                Elite writers earn ₹{PAYOUT_RPM_INR.toFixed(2)} for every 1,000 unique readers, with payouts from this card.
              </p>
            </>
          )}
        </article>

        {/* Peer Review Panel */}
        <article className={cn(card, access.isPanelMember && "border-[var(--fg)]")}>
          <p className="meta flex items-center gap-1.5">
            {!access.isElite && <Lock className="w-3 h-3" />} Peer review panel
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold">
            {access.isPanelMember
              ? inbox.total
                ? `${inbox.total} waiting on you`
                : "You're on the panel"
              : access.panelApplicationStatus === "pending"
                ? "Application under review"
                : access.panelApplicationStatus === "rejected"
                  ? "Not approved yet"
                  : `${PANEL_SIZE} reviewers, ${PANEL_PASS_THRESHOLD} to pass`}
          </h3>
          <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed flex-1">
            {access.isPanelMember
              ? "Vote PASS or FAIL on Elite papers with a structured reason, and rule on writers' counter-rebuttals."
              : access.isElite
                ? "Review Elite submissions in your domains. An admin reads every application."
                : "Panel members are Elite writers who review Elite papers in their domains."}
          </p>
          <PanelApplyButton className="mt-4 justify-center" />
        </article>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="meta mt-1">{label}</dt>
      <dd className="font-display font-semibold text-2xl tracking-tight tabular-nums">{value}</dd>
    </div>
  )
}

function TrackerRow({ draft }: { draft: Draft }) {
  const title = draft.title.trim() || "Untitled story"
  const when = draft.review?.at ?? draft.submittedAt ?? draft.updatedAt
  const detail =
    draft.status === "PHASE_1_FAILED" && draft.phase1
      ? `Phase 1: ${Math.round(draft.phase1.aiPercent)}% AI (limit ${draft.phase1.threshold}%). Revise and resubmit.`
      : draft.status === "PENDING_EMPLOYEE_REVIEW"
        ? `Passed Phase 1 at ${Math.round(draft.phase1?.humanPercent ?? 100)}% human. Waiting for an employee.`
        : draft.status === "PENDING_PEER_PANEL" && draft.panel
          ? `With the peer panel: ${draft.panel.filter((v) => v.decision).length}/${draft.panel.length} votes in.`
          : draft.status === "COUNTER_SUBMITTED"
            ? "Your counter-reason is with the reviewers."
        : draft.status === "DRAFT"
          ? "Not submitted yet."
          : draft.status === "PUBLISHED"
            ? "Approved and live."
            : null

  return (
    <li className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={draft.status} tracker />
          {draft.live && draft.status !== "PUBLISHED" && <StatusPill status="PUBLISHED" tracker />}
          <span className="text-xs text-[var(--fg-subtle)]">{formatRelativeDate(when)}</span>
        </div>
        <p className="mt-2 font-semibold leading-snug line-clamp-1">{title}</p>
        {detail && <p className="mt-1 text-sm text-[var(--fg-muted)]">{detail}</p>}
        {draft.status === "REJECTED" && draft.review && !draft.appeal && (
          <blockquote className="mt-2 pl-3 border-l-2 border-[var(--error)]/40 text-sm text-[var(--fg-secondary)] whitespace-pre-line">
            <span className="block meta mb-1 normal-case tracking-normal text-[var(--error)]">Reviewer feedback</span>
            {draft.review.notes}
          </blockquote>
        )}
      </div>
      <div className="flex gap-1 shrink-0 -ml-3 sm:ml-0">
        {(draft.track === "PEER_PANEL" || draft.status === "REJECTED" || draft.status === "COUNTER_SUBMITTED") && draft.submittedAt && (
          <Link
            href={`/submissions/${draft.id}`}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
          >
            {draft.track === "PEER_PANEL" ? "Scorecard" : "Appeal"}
          </Link>
        )}
        <Link
          href={`/editor/${draft.id}`}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
        >
          {draft.status === "REJECTED" || draft.status === "PHASE_1_FAILED" ? "Revise" : "Open"}
        </Link>
        {draft.live && (
          <Link
            href={`/story/${draft.id}`}
            className="inline-flex items-center gap-1 h-10 px-3 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
          >
            View <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <span className="sr-only">Status: {STATUS_META[draft.status].tracker}</span>
    </li>
  )
}

function LiveStoryRow({ draft }: { draft: Draft }) {
  const live = draft.live!
  const excerpt = live.subtitle || htmlToText(live.contentHtml).slice(0, 180)
  return (
    <article className="group relative mb-3 p-4 sm:p-5 rounded-[var(--radius-card)] bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors">
      <div className="flex items-center gap-2">
        <span className="meta">{formatDate(draft.publishedAt ?? draft.updatedAt)}</span>
        <RatingChip postId={draft.id} className="ml-auto text-xs" />
      </div>
      <Link href={`/story/${draft.id}`} className="mt-2 block after:absolute after:inset-0">
        <h3 className="display text-[1.375rem] leading-[1.1] line-clamp-2 group-hover:underline underline-offset-4">
          {live.title.trim() || "Untitled story"}
        </h3>
      </Link>
      {excerpt && <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-2">{excerpt}</p>}
    </article>
  )
}
