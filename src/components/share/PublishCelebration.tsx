"use client"

import { useUIStore } from "@/lib/store"
import { useHydrated } from "@/components/studio/useHydrated"
import { useIdentity } from "@/components/profile/identity"
import { ShareDialog } from "./ShareArticle"

/**
 * Publication happens when a reviewer approves, usually while the author is elsewhere. The next
 * time the author is in the app, this greets them with the share modal for that story, once.
 */
export function PublishCelebration() {
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const markCelebrated = useUIStore((s) => s.markCelebrated)
  const story = useUIStore((s) =>
    s.currentUser
      ? Object.values(s.drafts).find((d) => d.live && d.celebrated === false && d.authorUsername === s.currentUser)
      : undefined
  )
  const me = useIdentity(currentUser)

  if (!hydrated || !story?.live || !me) return null
  return (
    <ShareDialog
      open
      celebrate
      onOpenChange={(o) => !o && markCelebrated(story.id)}
      title={story.live.title.trim() || "Untitled story"}
      url={`/story/${story.id}`}
      authorName={me.displayName}
      handles={me.handles}
      asAuthor
    />
  )
}
