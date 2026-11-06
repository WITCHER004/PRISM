"use client"

import { useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { useUIStore, toast } from "@/lib/store"
import { TipModal } from "@/components/payments/TipModal"
import { numberWithCommas, cn } from "@/lib/utils"
import { Bookmark, BookmarkCheck, MessageCircle, Link2, Check, HandCoins, HandHeart } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { copyText } from "@/components/posts/copyText"

interface ArticleDockProps {
  postId: string
  clapCount: number
  commentCount: number
  author: { id: string; displayName: string; username: string }
  /** "rail": vertical, sits in the sticky side column. "bar": floating bottom bar for small screens. */
  layout: "rail" | "bar"
}

export function ArticleDock({ postId, clapCount, commentCount, author, layout }: ArticleDockProps) {
  const { clappedPosts, clapPost, bookmarkedPosts, toggleBookmark } = useUIStore()
  const userClaps = clappedPosts[postId] ?? 0
  const saved = bookmarkedPosts.has(postId)
  const [bursts, setBursts] = useState<number[]>([])
  const [copied, setCopied] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)

  // Bar hides while scrolling down, returns on scroll up
  const [hidden, setHidden] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, "change", (y) => {
    if (layout !== "bar") return
    const prev = scrollY.getPrevious() ?? 0
    setHidden(y > prev && y > 400)
  })

  const clap = () => {
    if (userClaps >= 50) return
    clapPost(postId, 1)
    const id = Date.now()
    setBursts((b) => [...b, id])
    setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 750)
  }

  const copy = async () => {
    if (await copyText(window.location.href.split("#")[0])) {
      setCopied(true)
      toast("Link copied", { tone: "success" })
      setTimeout(() => setCopied(false), 1800)
    } else {
      toast("Couldn’t copy the link", { tone: "error" })
    }
  }

  const save = () => {
    toggleBookmark(postId)
    toast(saved ? "Removed from library" : "Saved to library", saved ? undefined : { tone: "success", action: { label: "View", href: "/bookmarks" } })
  }

  const rail = layout === "rail"
  const btn = cn(
    "relative grid place-items-center border border-[var(--border)] bg-[var(--panel)] transition-colors cursor-pointer",
    "w-10 h-10",
    "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
  )
  const count = cn("font-mono text-[11px] text-[var(--fg-muted)]", rail ? "text-center mt-0.5" : "")

  const items = (
    <>
      <div className={cn("flex items-center", rail ? "flex-col gap-1" : "gap-1")}>
        <motion.button
          type="button"
          onClick={clap}
          whileTap={{ scale: 0.85 }}
          aria-label={userClaps >= 50 ? "You’ve given the maximum 50 claps" : `Applaud this story (${numberWithCommas(clapCount + userClaps)})`}
          className={cn(btn, userClaps > 0 && "hue-wash hue-ink hover:hue-wash")}
        >
          <HandHeart className="w-[18px] h-[18px]" />
          <AnimatePresence>
            {bursts.map((id) => (
              <motion.span
                key={id}
                aria-hidden
                initial={{ opacity: 1, y: 0, scale: 0.7 }}
                animate={{ opacity: 0, y: -34, scale: 1.15 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: ease.out }}
                className="absolute -top-2 px-1.5 rounded-full hue-dot text-[var(--bg)] text-[0.6875rem] font-semibold pointer-events-none"
              >
                +{userClaps}
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.button>
        <span className={count}>{numberWithCommas(clapCount + userClaps)}</span>
      </div>

      <div className={cn("flex items-center", rail ? "flex-col gap-1" : "gap-1")}>
        <a href="#comments" className={btn} aria-label="Jump to responses">
          <MessageCircle className="w-[18px] h-[18px]" />
        </a>
        <span className={count}>{commentCount}</span>
      </div>

      {rail && <div className="w-6 h-px bg-[var(--border)] my-1" />}

      <motion.button
        onClick={save}
        whileTap={{ scale: 0.85 }}
        aria-pressed={saved}
        aria-label={saved ? "Remove from library" : "Save to library"}
        className={cn(btn, saved && "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]")}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={saved ? "on" : "off"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: dur.fast }}
          >
            {saved ? <BookmarkCheck className="w-[18px] h-[18px]" /> : <Bookmark className="w-[18px] h-[18px]" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <button type="button" onClick={copy} className={btn} aria-label={copied ? "Link copied" : "Copy link"}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "on" : "off"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: dur.fast }}
          >
            {copied ? <Check className="w-[18px] h-[18px] text-[var(--accent)]" /> : <Link2 className="w-[18px] h-[18px]" />}
          </motion.span>
        </AnimatePresence>
      </button>

      <button
        type="button"
        onClick={() => setTipOpen(true)}
        className={cn(btn, "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] hover:text-[var(--on-accent)]")}
        aria-label={`Tip ${author.displayName}`}
        title={`Tip ${author.displayName}`}
      >
        <HandCoins className="w-[18px] h-[18px]" />
      </button>
    </>
  )

  return (
    <>
      {rail ? (
        <div className="post-footer-nav flex flex-col items-center gap-2 p-2 border border-[var(--border-strong)] bg-[var(--panel)] w-fit">{items}</div>
      ) : (
        <motion.div
          className="post-footer-nav fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
          animate={{ y: hidden ? 110 : 0, opacity: hidden ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 pr-2 border border-[var(--border-strong)] bg-[var(--panel)]">
            {items}
          </div>
        </motion.div>
      )}

      <TipModal
        authorId={author.id}
        authorName={author.displayName}
        authorUsername={author.username}
        isOpen={tipOpen}
        onClose={() => setTipOpen(false)}
      />
    </>
  )
}
