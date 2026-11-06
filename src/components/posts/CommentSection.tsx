"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { type Comment, MOCK_USERS } from "@/lib/data"
import { useUIStore, toast, type LocalComment } from "@/lib/store"
import { Avatar } from "@/components/ui/Avatar"
import { dur, ease, spring } from "@/lib/motion"
import { formatRelativeDate, cn } from "@/lib/utils"
import { ChevronDown, LogIn, MessageCircle, Reply, ThumbsUp } from "lucide-react"

interface CommentSectionProps {
  postId: string
  comments: Comment[]
  postTitle: string
}

const MAX_CHARS = 1000

interface Person {
  username: string
  displayName: string
  avatarUrl?: string
}

interface ThreadItem {
  id: string
  author: Person
  body: string
  createdAt: string
  /** Likes from other readers (seeded for sample responses; 0 for new ones) */
  baseLikes: number
  replies: ThreadItem[]
}

// Stable pseudo-random like count for sample responses so "Top" has something to sort by
function seedLikes(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 3 + (h % 48)
}

export function CommentSection({ postId, comments, postTitle }: CommentSectionProps) {
  const pathname = usePathname()
  const currentUser = useUIStore((s) => s.currentUser)
  const displayName = useUIStore((s) => s.profile.displayName)
  const localComments = useUIStore((s) => s.comments)
  const likedComments = useUIStore((s) => s.likedComments)
  const addComment = useUIStore((s) => s.addComment)
  const toggleCommentLike = useUIStore((s) => s.toggleCommentLike)

  const [sort, setSort] = useState<"top" | "newest">("top")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  // Responses posted in this visit animate in; everything else renders in place
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())

  const person = (username: string): Person => {
    const u = MOCK_USERS.find((m) => m.username === username)
    if (username === currentUser) return { username, displayName: displayName || u?.displayName || username, avatarUrl: u?.avatarUrl }
    return u ? { username, displayName: u.displayName, avatarUrl: u.avatarUrl } : { username, displayName: username }
  }
  const me = currentUser ? person(currentUser) : null

  const threads = useMemo(() => {
    const fromSeed = (c: Comment): ThreadItem => ({
      id: c.id,
      author: { username: c.author.username, displayName: c.author.displayName, avatarUrl: c.author.avatarUrl },
      body: c.body,
      createdAt: c.createdAt,
      baseLikes: seedLikes(c.id),
      replies: (c.replies ?? []).map(fromSeed),
    })
    const fromLocal = (c: LocalComment): ThreadItem => ({
      id: c.id,
      author: person(c.author),
      body: c.body,
      createdAt: c.createdAt,
      baseLikes: 0,
      replies: [],
    })

    const mine = localComments.filter((c) => c.postId === postId)
    const roots = [...comments.map(fromSeed), ...mine.filter((c) => !c.parentId).map(fromLocal)]
    const byId = new Map(roots.map((r) => [r.id, r]))
    for (const c of mine) {
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.replies.push(fromLocal(c))
    }
    for (const r of roots) r.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // "Top" ranks by other readers' likes, so your own like doesn't make a response jump away
    return roots.sort((a, b) =>
      sort === "top" ? b.baseLikes - a.baseLikes || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt)
    )
    // person() reads currentUser/displayName, both listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, localComments, postId, sort, currentUser, displayName])

  const total = threads.reduce((n, t) => n + 1 + t.replies.length, 0)

  const post = (body: string, parentId?: string) => {
    const c = addComment({ postId, parentId, body })
    if (!c) return false
    setFresh((s) => new Set(s).add(c.id))
    if (!parentId) setSort("newest") // make sure the new response is visible at the top
    toast(parentId ? "Reply posted" : "Response posted", { tone: "success" })
    return true
  }

  const loginHref = `/auth/login?redirectTo=${encodeURIComponent(`${pathname}#comments`)}`

  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-16 pt-10 border-t border-[var(--border)] scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <h2 id="comments-title" className="display text-[2rem]">
          Responses <span className="text-[var(--fg-muted)] font-sans font-normal text-lg tabular-nums">({total})</span>
        </h2>
        <SortToggle value={sort} onChange={setSort} />
      </div>

      {me ? (
        <Composer
          me={me}
          placeholder={`What are your thoughts on “${postTitle}”?`}
          submitLabel="Respond"
          onSubmit={(body) => post(body)}
        />
      ) : (
        <div className="panel p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 mb-10">
          <span className="grid place-items-center w-11 h-11 rounded-full hue-wash hue-ink shrink-0">
            <MessageCircle className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Join the conversation</p>
            <p className="text-sm text-[var(--fg-muted)] mt-0.5">Sign in to respond, reply and like responses.</p>
          </div>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
          >
            <LogIn className="w-4 h-4" /> Sign in
          </Link>
        </div>
      )}

      {threads.length === 0 ? (
        <p className="text-center text-[var(--fg-muted)] py-10">No responses yet. Start the conversation.</p>
      ) : (
        <motion.ul className="space-y-3" layout="position">
          <AnimatePresence initial={false}>
            {threads.map((t) => (
              <CommentItem
                key={t.id}
                item={t}
                me={me}
                fresh={fresh}
                liked={likedComments}
                onLike={toggleCommentLike}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                onReply={(body) => post(body, t.id)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  )
}

function SortToggle({ value, onChange }: { value: "top" | "newest"; onChange: (v: "top" | "newest") => void }) {
  return (
    <div role="group" aria-label="Sort responses" className="flex items-center gap-1 p-1 rounded-full bg-[var(--surface)]">
      <span className="meta pl-2 pr-1">Sort</span>
      {(["top", "newest"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "relative h-8 px-3.5 rounded-full text-sm font-medium transition-colors",
            value === v ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          )}
        >
          {value === v && (
            <motion.span
              layoutId="comment-sort"
              className="absolute inset-0 rounded-full bg-[var(--panel)] shadow-[var(--shadow)]"
              transition={spring.snappy}
            />
          )}
          <span className="relative">{v === "top" ? "Top" : "Newest"}</span>
        </button>
      ))}
    </div>
  )
}

function Composer({
  me,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  compact,
  autoFocus,
  initial = "",
}: {
  me: Person
  placeholder: string
  submitLabel: string
  onSubmit: (body: string) => boolean
  onCancel?: () => void
  compact?: boolean
  autoFocus?: boolean
  initial?: string
}) {
  const [text, setText] = useState(initial)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const empty = !text.trim()
  const remaining = MAX_CHARS - text.length

  const submit = () => {
    if (empty) return
    if (onSubmit(text)) {
      setText("")
      ref.current?.blur()
    }
  }

  const expanded = compact || focused || !empty

  return (
    <form
      className={cn("flex gap-3 sm:gap-4", compact ? "mt-4" : "mb-10")}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Avatar src={me.avatarUrl} alt={me.displayName} size={compact ? "sm" : "md"} className="mt-1" />
      <div className="flex-1 min-w-0">
        <textarea
          ref={ref}
          value={text}
          autoFocus={autoFocus}
          maxLength={MAX_CHARS}
          aria-label={placeholder}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
            if (e.key === "Escape" && onCancel) {
              e.preventDefault()
              onCancel()
            }
          }}
          placeholder={placeholder}
          rows={compact ? 3 : expanded ? 4 : 2}
          className="block w-full p-4 rounded-[16px] bg-[var(--panel)] border border-[var(--border)] focus:border-[var(--fg)] outline-none text-[0.9375rem] leading-relaxed resize-y transition-colors placeholder:text-[var(--fg-subtle)]"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span
            aria-live="polite"
            className={cn(
              "meta normal-case tracking-normal transition-opacity",
              remaining <= 100 ? "text-[var(--warning)]" : "",
              remaining === 0 && "text-[var(--error)]",
              expanded ? "opacity-100" : "opacity-0"
            )}
          >
            {remaining <= 100 ? `${remaining} characters left` : `${text.length}/${MAX_CHARS}`}
            <span className="hidden sm:inline text-[var(--fg-subtle)]"> · Ctrl+Enter to post</span>
          </span>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="h-10 px-4 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={empty}
              className="h-10 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function CommentItem({
  item,
  me,
  fresh,
  liked,
  onLike,
  replyingTo,
  setReplyingTo,
  onReply,
  depth = 0,
  rootName,
}: {
  item: ThreadItem
  me: Person | null
  fresh: Set<string>
  liked: Set<string>
  onLike: (id: string) => void
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  onReply: (body: string) => boolean
  depth?: number
  rootName?: string
}) {
  const [expanded, setExpanded] = useState(true)
  const isLiked = liked.has(item.id)
  const likes = item.baseLikes + (isLiked ? 1 : 0)
  const isMine = me?.username === item.author.username
  const replyOpen = replyingTo === item.id
  const pathname = usePathname()

  const toggleReply = () => {
    if (!me) {
      toast("Sign in to reply", { action: { label: "Sign in", href: `/auth/login?redirectTo=${encodeURIComponent(`${pathname}#comments`)}` } })
      return
    }
    setReplyingTo(replyOpen ? null : item.id)
  }

  return (
    <motion.li
      layout="position"
      initial={fresh.has(item.id) ? { opacity: 0, y: 12, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.base, ease: ease.out } }}
      exit={{ opacity: 0, transition: { duration: dur.fast } }}
      className={cn(depth === 0 ? "panel p-5 sm:p-6" : "pt-5")}
    >
      <div className="flex gap-3 sm:gap-4">
        <Link href={`/${item.author.username}`} className="shrink-0 rounded-full" tabIndex={-1} aria-hidden>
          <Avatar src={item.author.avatarUrl} alt={item.author.displayName} size={depth > 0 ? "sm" : "md"} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={`/${item.author.username}`} className="font-semibold text-sm hover:underline">
              {item.author.displayName}
            </Link>
            {isMine && (
              <span className="h-5 px-2 inline-flex items-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[0.6875rem] font-medium">
                You
              </span>
            )}
            <time dateTime={item.createdAt} className="meta normal-case tracking-normal">
              {formatRelativeDate(item.createdAt)}
            </time>
          </div>

          <p className="mt-1.5 text-[0.9375rem] text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line break-words">
            {item.body}
          </p>

          <div className="mt-2 -ml-3 flex flex-wrap items-center gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onLike(item.id)}
              aria-pressed={isLiked}
              aria-label={`${isLiked ? "Unlike" : "Like"} response by ${item.author.displayName} (${likes} likes)`}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-medium tabular-nums transition-colors",
                isLiked ? "text-[var(--accent)] bg-[var(--accent-subtle)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
              )}
            >
              <motion.span
                key={isLiked ? "on" : "off"}
                initial={{ scale: isLiked ? 0.6 : 1 }}
                animate={{ scale: 1, transition: spring.snappy }}
                className="inline-flex"
              >
                <ThumbsUp className={cn("w-4 h-4", isLiked && "fill-current")} />
              </motion.span>
              {likes}
            </motion.button>
            <button
              type="button"
              onClick={toggleReply}
              aria-expanded={replyOpen}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-medium transition-colors",
                replyOpen ? "text-[var(--fg)] bg-[var(--surface)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
              )}
            >
              <Reply className="w-4 h-4" /> Reply
            </button>
            {depth === 0 && item.replies.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="inline-flex items-center gap-1 h-10 px-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
              >
                <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: dur.fast }} className="inline-flex">
                  <ChevronDown className="w-4 h-4" />
                </motion.span>
                {expanded ? "Hide replies" : `${item.replies.length} ${item.replies.length === 1 ? "reply" : "replies"}`}
              </button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {replyOpen && me && (
              <motion.div
                key="reply"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                exit={{ opacity: 0, y: -4, transition: { duration: dur.fast, ease: ease.in } }}
              >
                <Composer
                  me={me}
                  compact
                  autoFocus
                  initial={depth > 0 ? `@${item.author.displayName} ` : ""}
                  placeholder={`Reply to ${depth > 0 ? item.author.displayName : rootName ?? item.author.displayName}…`}
                  submitLabel="Reply"
                  onCancel={() => setReplyingTo(null)}
                  onSubmit={(body) => {
                    const ok = onReply(body)
                    if (ok) {
                      setReplyingTo(null)
                      setExpanded(true)
                    }
                    return ok
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {depth === 0 && item.replies.length > 0 && (
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.ul
                  key="replies"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                  exit={{ opacity: 0, transition: { duration: dur.fast } }}
                  className="mt-1 pl-4 border-l-2 border-[var(--border)]"
                >
                  <AnimatePresence initial={false}>
                    {item.replies.map((r) => (
                      <CommentItem
                        key={r.id}
                        item={r}
                        me={me}
                        fresh={fresh}
                        liked={liked}
                        onLike={onLike}
                        replyingTo={replyingTo}
                        setReplyingTo={setReplyingTo}
                        onReply={onReply}
                        depth={depth + 1}
                        rootName={item.author.displayName}
                      />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.li>
  )
}
