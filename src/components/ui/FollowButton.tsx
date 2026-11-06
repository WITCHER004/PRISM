"use client"

import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { Check, Plus } from "lucide-react"
import { useUIStore, toast } from "@/lib/store"
import { cn } from "@/lib/utils"

interface FollowButtonProps {
  username: string
  displayName: string
  size?: "sm" | "md"
  /** "solid" = ink pill (primary placements), "outline" = bordered (secondary placements) */
  tone?: "solid" | "outline"
  className?: string
}

// Follow / Following toggle backed by the store; signed-out users are sent to sign in
export function FollowButton({ username, displayName, size = "md", tone = "solid", className }: FollowButtonProps) {
  const router = useRouter()
  const { followedUsers, toggleFollow, currentUser } = useUIStore()
  const following = followedUsers.has(username)
  const isMe = currentUser === username

  if (isMe) return null

  const onClick = () => {
    if (!currentUser) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent(location.pathname)}`)
      return
    }
    toggleFollow(username)
    toast(following ? `Unfollowed ${displayName}` : `Following ${displayName}`, { tone: following ? "default" : "success" })
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${displayName}` : `Follow ${displayName}`}
      className={cn(
        "group/follow relative inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
        size === "sm" ? "h-8 px-3.5 text-xs" : "h-10 px-4 text-sm",
        following
          ? "bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-hover)]"
          : tone === "solid"
          ? "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]"
          : "border border-[var(--border-strong)] text-[var(--fg)] hover:border-[var(--fg)]",
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
          {following ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {following ? "Following" : "Follow"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
