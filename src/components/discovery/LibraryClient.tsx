"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Bookmark, Users } from "lucide-react"
import { MOCK_POSTS, MOCK_USERS } from "@/lib/data"
import { useUIStore } from "@/lib/store"
import { PostCard } from "@/components/posts/PostCard"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { PillTabs } from "./PillTabs"
import { EmptyState } from "./EmptyState"
import { useStoreHydrated } from "./hooks"
import { dur, ease, spring, stagger } from "@/lib/motion"

type Tab = "saved" | "following"

export function LibraryClient() {
  const hydrated = useStoreHydrated()
  const bookmarked = useUIStore((s) => s.bookmarkedPosts)
  const followed = useUIStore((s) => s.followedUsers)
  const [tab, setTab] = useState<Tab>("saved")

  // Most recently saved first (Sets keep insertion order)
  const saved = useMemo(
    () =>
      [...bookmarked]
        .reverse()
        .map((id) => MOCK_POSTS.find((p) => p.id === id))
        .filter((p): p is (typeof MOCK_POSTS)[number] => !!p),
    [bookmarked]
  )
  const writers = useMemo(() => MOCK_USERS.filter((u) => followed.has(u.username)), [followed])
  const fromFollowing = useMemo(
    () =>
      MOCK_POSTS.filter((p) => followed.has(p.author.username)).sort(
        (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
      ),
    [followed]
  )

  const tabs = [
    { id: "saved" as const, label: "Saved", icon: Bookmark, count: hydrated ? saved.length : undefined },
    { id: "following" as const, label: "Following", icon: Users, count: hydrated ? fromFollowing.length : undefined },
  ]

  return (
    <>
      <PillTabs label="Library sections" tabs={tabs} value={tab} onChange={setTab} panelId="library" />

      <div className="mt-8" role="tabpanel" id={`library-${tab}`}>
        {!hydrated ? (
          <Skeleton />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            >
              {tab === "saved" ? (
                <>
                  <p className="meta mb-4" aria-live="polite">
                    {saved.length} {saved.length === 1 ? "story" : "stories"} saved
                  </p>
                  <AnimatedList ids={saved.map((p) => p.id)} empty={
                    <EmptyState
                      icon={Bookmark}
                      title="Nothing saved yet"
                      body="Tap the bookmark on any story to keep it here for later. Your library lives in this browser."
                      cta={{ label: "Explore stories", href: "/explore" }}
                      secondary={{ label: "Search", href: "/search" }}
                    />
                  }>
                    {saved.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </AnimatedList>
                </>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {writers.length > 0 && (
                      <motion.section
                        key="writers"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: dur.fast } }}
                        className="mb-8"
                      >
                        <h2 className="meta mb-3">
                          {writers.length} {writers.length === 1 ? "writer" : "writers"} you follow
                        </h2>
                        <ul className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
                          <AnimatePresence initial={false} mode="popLayout">
                            {writers.map((w) => (
                              <motion.li
                                key={w.username}
                                layout
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: dur.fast } }}
                                transition={{ layout: spring.soft }}
                                className="panel shrink-0 flex items-center gap-3 p-3 pr-4 shadow-[var(--shadow)]"
                              >
                                <Link href={`/${w.username}`} aria-label={w.displayName}>
                                  <Avatar src={w.avatarUrl} alt={w.displayName} size="md" />
                                </Link>
                                <Link href={`/${w.username}`} className="text-sm font-medium hover:underline whitespace-nowrap">
                                  {w.displayName}
                                </Link>
                                <FollowButton username={w.username} displayName={w.displayName} size="sm" />
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      </motion.section>
                    )}
                  </AnimatePresence>

                  <AnimatedList ids={fromFollowing.map((p) => p.id)} empty={
                    <EmptyState
                      icon={Users}
                      title="Follow writers you trust"
                      body="Stories from writers you follow gather here, newest first. Find a few voices worth hearing from."
                      cta={{ label: "Find writers", href: "/explore" }}
                    />
                  }>
                    {fromFollowing.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </AnimatedList>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  )
}

// Items slide out (and the rest close the gap) when removed; the empty state fades in after the last one leaves
function AnimatedList({ ids, children, empty }: { ids: string[]; children: React.ReactNode[]; empty: React.ReactNode }) {
  return (
    <div className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        {ids.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
          >
            {empty}
          </motion.div>
        ) : (
          ids.map((id, i) => (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out, delay: Math.min(i, 8) * stagger } }}
              exit={{ opacity: 0, x: -24, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
              transition={{ layout: spring.soft }}
            >
              {children[i]}
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="h-3 w-28 rounded-full bg-[var(--surface)]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="panel h-[168px] p-5 grid grid-cols-[1fr_auto] gap-5 animate-pulse">
          <div className="space-y-3">
            <div className="h-5 w-24 rounded-full bg-[var(--surface)]" />
            <div className="h-6 w-4/5 rounded-full bg-[var(--surface)]" />
            <div className="h-4 w-3/5 rounded-full bg-[var(--surface)]" />
          </div>
          <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-[14px] bg-[var(--surface)]" />
        </div>
      ))}
    </div>
  )
}
