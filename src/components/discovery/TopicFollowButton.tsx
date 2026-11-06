"use client"

import { AnimatePresence, motion } from "motion/react"
import { Check, Plus } from "lucide-react"
import { toast } from "@/lib/store"
import { useFollowedTopics } from "./hooks"
import { cn } from "@/lib/utils"

// Follow-topic toggle; kept in localStorage ("prism-topics") since the store has no topic follows
export function TopicFollowButton({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const { isFollowing, toggle } = useFollowedTopics()
  const following = isFollowing(slug)

  const onClick = () => {
    const now = toggle(slug)
    toast(now ? `Following ${name}` : `Unfollowed ${name}`, { tone: now ? "success" : "default" })
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full text-sm font-medium transition-colors",
        following
          ? "bg-[var(--panel)] border border-[var(--border-strong)] text-[var(--fg)] hover:border-[var(--fg)]"
          : "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={following ? "on" : "off"}
          className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.14 }}
        >
          {following ? <Check className="w-4 h-4 hue-ink" /> : <Plus className="w-4 h-4" />}
          {following ? "Following topic" : "Follow topic"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** Small marker shown on topic cards the reader follows */
export function FollowedTopicMark({ slug }: { slug: string }) {
  const { isFollowing } = useFollowedTopics()
  return (
    <AnimatePresence initial={false}>
      {isFollowing(slug) && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--panel)] text-[0.6875rem] font-medium hue-ink"
        >
          <Check className="w-3 h-3" /> Following
        </motion.span>
      )}
    </AnimatePresence>
  )
}
