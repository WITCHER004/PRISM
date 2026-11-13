"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { type Post } from "@/lib/data"
import { useUIStore, toast } from "@/lib/store"
import { dur, ease } from "@/lib/motion"
import { Avatar } from "@/components/ui/Avatar"
import { UserAvatar } from "@/components/profile/identity"
import { RatingChip } from "@/components/reviews/ArticleReviews"
import { ElitePaperBadge } from "@/components/papers/ElitePaper"
import { hueStyle } from "@/lib/topics"
import { formatRelativeDate, numberWithCommas, cn } from "@/lib/utils"
import { Bookmark, BookmarkCheck, Lock, BadgeCheck, ArrowUpRight, HandHeart } from "lucide-react"

interface PostCardProps {
  post: Post
  variant?: "default" | "tile" | "compact" | "hero" | "featured"
  showAuthor?: boolean
  /** Renders an ordinal beside compact cards */
  index?: number
  className?: string
}

// Motion handles the lift; the shadow change is a CSS transition (see liftShadow)
const lift = {
  rest: { y: 0 },
  hover: { y: -4 },
}
const liftShadow = "shadow-[var(--shadow)] hover:shadow-[var(--shadow-lift)] transition-shadow duration-300"

// The title link stretches over the whole card (after:inset-0) so the card is one click target;
// inner controls sit above it (relative z-10). Keyboard focus draws a ring around the card shape.
const overlayLink =
  "outline-none after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:after:outline-2 focus-visible:after:outline-[var(--accent)] focus-visible:after:-outline-offset-2"

// Feed the cursor position to the .spotlight overlay as CSS vars — no React re-render per move
const trackPointer = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
}

/** Topic-tinted glow that follows the cursor. `under` sits beneath the card's text (card needs `isolate`). */
function Spotlight({ under }: { under?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "spotlight pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        under && "-z-10"
      )}
    />
  )
}

export function PostCard({ post, variant = "default", showAuthor = true, index, className }: PostCardProps) {
  const href = `/${post.author.username}/${post.slug}`
  const topic = post.tags[0]
  const style = hueStyle(topic?.slug)

  if (variant === "compact") {
    return (
      <article style={style} className={cn("group flex gap-4 py-4", className)}>
        {index !== undefined && (
          <span className="display text-[2rem] leading-none w-10 shrink-0 text-[var(--fg-subtle)] group-hover:hue-ink transition-colors">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <TopicChip post={post} subtle />
          <Link href={href}>
            <h3 className="mt-1.5 font-display font-semibold text-[1.0625rem] leading-snug tracking-[-0.015em] text-[var(--fg)] line-clamp-3 group-hover:underline decoration-2 underline-offset-4 hue-decoration">
              {post.title}
            </h3>
          </Link>
          <p className="mt-1.5 meta">
            {showAuthor && <>{post.author.displayName} · </>}
            {post.readingTimeMin} min
          </p>
        </div>
      </article>
    )
  }

  if (variant === "hero") {
    return (
      <motion.article
        style={style}
        initial="rest"
        whileHover="hover"
        animate="rest"
        variants={lift}
        onPointerMove={trackPointer}
        className={cn("group relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--fg)] min-h-[420px] h-full", liftShadow, className)}
      >
        {post.coverImageUrl && (
          <motion.div className="absolute inset-0" variants={{ rest: { scale: 1 }, hover: { scale: 1.04 } }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}>
            <Image src={post.coverImageUrl} alt="" fill className="object-cover" priority unoptimized />
          </motion.div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
        <Spotlight />
        <div className="relative h-full flex flex-col justify-end p-6 sm:p-8 text-white">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/15 backdrop-blur text-xs font-medium">
              <span className="w-2 h-2 rounded-full hue-dot" />
              {topic?.name ?? "Story"}
            </span>
            <PaywallPill tier={post.paywallTier} paper={!!post.paper} onDark />
          </div>
          <Link href={href} className={cn("mt-4", overlayLink)}>
            <h2 className="display text-[1.875rem] sm:text-[2.5rem] lg:text-[2.75rem] max-w-2xl">{post.title}</h2>
          </Link>
          {post.subtitle && (
            <p className="mt-3 max-w-2xl text-white/75 text-base sm:text-lg leading-snug line-clamp-2">{post.subtitle}</p>
          )}
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="pointer-events-none flex items-center gap-2.5 text-sm">
              <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="sm" priority className="ring-2 ring-white/30" />
              <span className="font-medium">{post.author.displayName}</span>
              <span className="text-white/60 font-mono text-xs uppercase tracking-wide">
                {post.readingTimeMin} min · {numberWithCommas(post.clapCount)} claps
              </span>
            </div>
            <SaveButton postId={post.id} onDark />
          </div>
        </div>
      </motion.article>
    )
  }

  if (variant === "tile" || variant === "featured") {
    const washed = variant === "featured"
    return (
      <motion.article
        style={style}
        initial="rest"
        whileHover="hover"
        animate="rest"
        variants={lift}
        onPointerMove={trackPointer}
        className={cn(
          "group relative isolate flex flex-col h-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]",
          liftShadow,
          washed ? "hue-wash" : "bg-[var(--panel)]",
          className
        )}
      >
        {post.coverImageUrl && !washed && (
          <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface)]">
            <motion.div className="absolute inset-0" variants={{ rest: { scale: 1 }, hover: { scale: 1.05 } }} transition={{ duration: 0.7 }}>
              <Image src={post.coverImageUrl} alt="" fill className="object-cover" unoptimized />
            </motion.div>
          </div>
        )}
        <Spotlight under />
        <div className="flex flex-col flex-1 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TopicChip post={post} />
            <PaywallPill tier={post.paywallTier} paper={!!post.paper} />
            <RatingChip postId={post.id} className="ml-auto text-xs whitespace-nowrap" />
          </div>
          <Link href={href} className={cn("mt-3", overlayLink)}>
            <h3 className={cn("display text-[var(--fg)]", washed ? "text-[1.75rem]" : "text-[1.375rem] leading-[1.08]")}>
              {post.title}
            </h3>
          </Link>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-3">{post.subtitle || post.excerpt}</p>
          <div className="mt-auto pt-5 flex items-center justify-between gap-3">
            {showAuthor ? <Byline post={post} short /> : <span className="meta">{post.readingTimeMin} min read</span>}
            <div className="relative z-10 -my-1 flex items-center gap-0.5">
              <ClapButtonSmall post={post} />
              <SaveButton postId={post.id} />
            </div>
          </div>
        </div>
      </motion.article>
    )
  }

  // default — panel row, works in single-column lists
  return (
    <motion.article
      style={style}
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={lift}
        onPointerMove={trackPointer}
      className={cn(
        "group relative isolate overflow-hidden grid grid-cols-[1fr_auto] gap-5 p-4 sm:p-5 mb-3 rounded-[var(--radius-card)] bg-[var(--panel)] border border-[var(--border)]",
        liftShadow,
        className
      )}
    >
      <Spotlight under />
      <div className="min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <TopicChip post={post} />
          <PaywallPill tier={post.paywallTier} paper={!!post.paper} />
          <RatingChip postId={post.id} className="ml-auto text-xs whitespace-nowrap" />
        </div>
        <Link href={href} className={cn("mt-2.5", overlayLink)}>
          <h2 className="display text-[1.3125rem] sm:text-[1.5rem] leading-[1.08] text-[var(--fg)] line-clamp-3">
            {post.title}
          </h2>
        </Link>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-2 hidden sm:block">
          {post.subtitle || post.excerpt}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {showAuthor ? <Byline post={post} /> : <span className="meta">{formatRelativeDate(post.publishedAt)}</span>}
          <div className="relative z-10 -my-1 flex items-center gap-0.5">
            <ClapButtonSmall post={post} />
            <SaveButton postId={post.id} />
          </div>
        </div>
      </div>

      {post.coverImageUrl && (
        <div aria-hidden className="pointer-events-none relative w-24 h-24 sm:w-36 sm:h-36 rounded-[14px] overflow-hidden bg-[var(--surface)]">
          <motion.div className="absolute inset-0" variants={{ rest: { scale: 1 }, hover: { scale: 1.06 } }} transition={{ duration: 0.7 }}>
            <Image src={post.coverImageUrl} alt="" fill className="object-cover" unoptimized />
          </motion.div>
          <span className="absolute right-2 bottom-2 grid place-items-center w-7 h-7 rounded-full bg-[var(--panel)]/90 text-[var(--fg)] opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>
      )}
    </motion.article>
  )
}

function TopicChip({ post, subtle }: { post: Post; subtle?: boolean }) {
  const topic = post.tags[0]
  if (!topic) return null
  return (
    <Link
      href={`/explore/${topic.slug}`}
      className={cn(
        "relative z-10 inline-flex items-center gap-1.5 text-xs font-medium hue-ink",
        !subtle && "h-6 px-2.5 rounded-full hue-wash"
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full hue-dot" />
      {topic.name}
    </Link>
  )
}

function PaywallPill({ tier, onDark, paper }: { tier: Post["paywallTier"]; onDark?: boolean; paper?: boolean }) {
  if (paper) return <ElitePaperBadge onDark={onDark} />
  if (tier === "FREE") return null
  const label = tier === "METERED" ? "Preview" : tier === "PAID" ? "Paid" : "Members"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[0.6875rem] font-medium",
        onDark ? "bg-white/15 text-white backdrop-blur" : "bg-[var(--surface)] text-[var(--fg-muted)]"
      )}
    >
      <Lock className="w-3 h-3" />
      {label}
    </span>
  )
}

function Byline({ post, short }: { post: Post; short?: boolean }) {
  return (
    <div className="relative z-10 flex items-center gap-2 min-w-0">
      <UserAvatar username={post.author.username} fallbackSrc={post.author.avatarUrl} alt={post.author.displayName} size="xs" />
      <div className="min-w-0 leading-tight">
        <Link href={`/${post.author.username}`} className="flex items-center gap-1 text-[0.8125rem] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg)]">
          <span className="truncate">{post.author.displayName}</span>
          {post.author.isVerifiedHuman && <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-label="Verified writer" />}
        </Link>
        <p className="meta mt-0.5">
          {short ? `${post.readingTimeMin} min read` : `${formatRelativeDate(post.publishedAt)} · ${post.readingTimeMin} min`}
        </p>
      </div>
    </div>
  )
}

function ClapButtonSmall({ post }: { post: Post }) {
  const { clappedPosts, clapPost } = useUIStore()
  const userClaps = clappedPosts[post.id] ?? 0
  const [bursts, setBursts] = useState<number[]>([])

  const clap = () => {
    if (userClaps >= 50) return
    clapPost(post.id, 1)
    const id = Date.now()
    setBursts((b) => [...b, id])
    setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 700)
  }

  return (
    <motion.button
      type="button"
      onClick={clap}
      whileTap={{ scale: 0.88 }}
      className={cn(
        "relative z-10 inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-xs font-mono tabular-nums transition-colors",
        userClaps > 0 ? "hue-wash hue-ink" : "text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
      )}
      aria-label={`Applaud “${post.title}” (${numberWithCommas(post.clapCount + userClaps)} claps)`}
    >
      <HandHeart className="w-4 h-4" aria-hidden />
      {numberWithCommas(post.clapCount + userClaps)}
      <AnimatePresence>
        {bursts.map((id) => (
          <motion.span
            key={id}
            aria-hidden
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -26, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: ease.out }}
            className="absolute left-1/2 -translate-x-1/2 -top-1 text-[0.6875rem] font-semibold hue-ink pointer-events-none"
          >
            +1
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.button>
  )
}

function SaveButton({ postId, onDark }: { postId: string; onDark?: boolean }) {
  const { bookmarkedPosts, toggleBookmark } = useUIStore()
  const saved = bookmarkedPosts.has(postId)
  const onClick = () => {
    toggleBookmark(postId)
    toast(saved ? "Removed from library" : "Saved to library", saved ? undefined : { tone: "success", action: { label: "View", href: "/bookmarks" } })
  }
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.85 }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from library" : "Save to library"}
      className={cn(
        "relative z-10 grid place-items-center w-10 h-10 rounded-full transition-colors",
        onDark
          ? "bg-white/15 text-white hover:bg-white/25 backdrop-blur"
          : saved
          ? "bg-[var(--fg)] text-[var(--bg)]"
          : "text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={saved ? "on" : "off"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: dur.fast }}
        >
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
