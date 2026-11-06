"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { AtSign, BadgeCheck, BookOpen, CalendarDays, Code, Feather, Globe, PenLine, Settings, UserRound } from "lucide-react"
import type { Post, Tag, User } from "@/lib/data"
import { useUIStore, type Draft } from "@/lib/store"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { PostCard } from "@/components/posts/PostCard"
import { PillTabs } from "./PillTabs"
import { EmptyState } from "./EmptyState"
import { useStoreHydrated } from "./hooks"
import { hueStyle } from "@/lib/topics"
import { dur, ease, stagger } from "@/lib/motion"
import { cn, formatDate, numberWithCommas } from "@/lib/utils"

type Tab = "stories" | "about"

interface ProfileClientProps {
  user: User
  posts: Post[]
  topics: (Tag & { count: number })[]
}

export function ProfileClient({ user, posts, topics }: ProfileClientProps) {
  const hydrated = useStoreHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)
  const followed = useUIStore((s) => s.followedUsers.has(user.username))
  const drafts = useUIStore((s) => s.drafts)
  const [tab, setTab] = useState<Tab>("stories")

  const isMe = currentUser === user.username

  // The signed-in writer sees their settings edits reflected here
  const name = isMe && profile.displayName.trim() ? profile.displayName : user.displayName
  const bio = isMe && profile.bio.trim() ? profile.bio : user.bio
  const website = isMe ? profile.websiteUrl.trim() : user.websiteUrl
  const twitter = (isMe ? profile.twitterHandle.trim() : user.twitterHandle)?.replace(/^@/, "")

  const localStories = useMemo(
    () =>
      hydrated && isMe
        ? Object.values(drafts)
            .filter((d) => d.status === "published")
            .sort((a, b) => +new Date(b.publishedAt ?? b.updatedAt) - +new Date(a.publishedAt ?? a.updatedAt))
        : [],
    [drafts, hydrated, isMe]
  )
  const storyCount = posts.length + localStories.length
  // Following adds you to the count, so the number reacts to the button
  const followers = user.followerCount + (followed && !isMe ? 1 : 0)

  const links = [
    website && { href: /^https?:\/\//.test(website) ? website : `https://${website}`, label: website.replace(/^https?:\/\//, "").replace(/\/$/, ""), icon: Globe },
    twitter && { href: `https://x.com/${twitter}`, label: `@${twitter}`, icon: AtSign },
    user.githubHandle && { href: `https://github.com/${user.githubHandle}`, label: `github/${user.githubHandle}`, icon: Code },
  ].filter(Boolean) as { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]

  return (
    <>
      {/* Identity */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="-mt-14 sm:-mt-16 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <Avatar
            src={user.avatarUrl}
            alt={name}
            size="xl"
            className="w-28 h-28 sm:w-32 sm:h-32 ring-4 ring-[var(--bg)] shadow-[var(--shadow-lift)]"
          />
          <div className="flex flex-wrap gap-2 sm:pb-2">
            {isMe ? (
              <>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] text-sm font-medium hover:border-[var(--fg)] transition-colors"
                >
                  <Settings className="w-4 h-4" /> Edit profile
                </Link>
                <Link
                  href="/editor/new"
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
                >
                  <PenLine className="w-4 h-4" /> Write
                </Link>
              </>
            ) : (
              <FollowButton username={user.username} displayName={user.displayName} />
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="meta">{isMe ? "Your profile" : "Writer"}</p>
          <h1 className="display mt-2 text-[2.5rem] sm:text-[3.5rem] flex items-center gap-3 flex-wrap">
            {name}
            {user.isVerifiedHuman && <BadgeCheck className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--accent)]" aria-label="Verified writer" />}
          </h1>
          <p className="mt-2 meta">@{user.username}</p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--fg-secondary)]">{bio}</p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Readers" value={numberWithCommas(followers)} />
            <Stat label="Following" value={numberWithCommas(user.followingCount)} />
            <Stat label="Stories" value={numberWithCommas(Math.max(user.postCount, storyCount))} />
          </dl>

          {links.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {links.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-colors"
                  >
                    <Icon className="w-4 h-4 hue-ink" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Tabs */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        <div className="pb-6 border-b border-[var(--border)]">
          <PillTabs
            label="Profile sections"
            panelId="profile"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "stories", label: "Stories", icon: BookOpen, count: storyCount },
              { id: "about", label: "About", icon: UserRound },
            ]}
          />
        </div>

        <div className="mt-8" role="tabpanel" id={`profile-${tab}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            >
              {tab === "stories" ? (
                storyCount === 0 ? (
                  <EmptyState
                    icon={Feather}
                    title={isMe ? "Your first story starts here" : "No stories yet"}
                    body={
                      isMe
                        ? "Publish something and it will appear on your profile for readers to find."
                        : `${user.displayName} hasn't published on Prism yet. Follow to hear when they do.`
                    }
                    cta={isMe ? { label: "Write a story", href: "/editor/new" } : { label: "Explore stories", href: "/explore" }}
                  />
                ) : (
                  <div className="max-w-3xl">
                    {localStories.map((d, i) => (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out, delay: i * stagger } }}
                      >
                        <LocalStoryCard draft={d} />
                      </motion.div>
                    ))}
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} showAuthor={false} />
                    ))}
                  </div>
                )
              ) : (
                <About user={user} bio={bio} name={name} topics={topics} links={links} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="meta mt-1">{label}</dt>
      <dd className="font-display font-semibold text-2xl tracking-tight tabular-nums">{value}</dd>
    </div>
  )
}

// A story the signed-in writer published in this browser (lives in the store, read at /story/[id])
function LocalStoryCard({ draft }: { draft: Draft }) {
  const tag = draft.tags[0]
  const slug = tag?.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-")
  const plain = draft.subtitle || draft.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
  return (
    <article
      style={hueStyle(slug)}
      className="group relative mb-3 p-4 sm:p-5 rounded-[var(--radius-card)] bg-[var(--panel)] border border-[var(--border)] shadow-[var(--shadow)] hover:shadow-[var(--shadow-lift)] transition-shadow duration-300"
    >
      <div className="flex items-center gap-2">
        {tag && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full hue-wash hue-ink text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full hue-dot" />
            {tag}
          </span>
        )}
        <span className="inline-flex items-center h-6 px-2 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[0.6875rem] font-medium">
          Published here
        </span>
      </div>
      <Link href={`/story/${draft.id}`} className="mt-2.5 block after:absolute after:inset-0">
        <h2 className="display text-[1.3125rem] sm:text-[1.5rem] leading-[1.08] text-[var(--fg)] line-clamp-3 group-hover:underline decoration-2 underline-offset-4 hue-decoration">
          {draft.title || "Untitled story"}
        </h2>
      </Link>
      {plain && <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-2">{plain}</p>}
      <p className="mt-4 meta">{formatDate(draft.publishedAt ?? draft.updatedAt)}</p>
    </article>
  )
}

function About({
  user,
  name,
  bio,
  topics,
  links,
}: {
  user: User
  name: string
  bio: string
  topics: (Tag & { count: number })[]
  links: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}) {
  return (
    <div className="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
      <div className="panel p-6 shadow-[var(--shadow)]">
        <h2 className="font-display font-semibold text-lg tracking-tight">About {name.split(" ")[0]}</h2>
        <p className="mt-3 font-serif text-[1.0625rem] leading-relaxed text-[var(--fg-secondary)]">{bio}</p>
        <p className="mt-6 inline-flex items-center gap-2 meta">
          <CalendarDays className="w-3.5 h-3.5" /> On Prism since {formatDate(user.createdAt)}
        </p>
      </div>
      <div className="space-y-4">
        {topics.length > 0 && (
          <div className="panel p-6 shadow-[var(--shadow)]">
            <h2 className="font-display font-semibold text-lg tracking-tight">Writes about</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {topics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/explore/${t.slug}`}
                  style={hueStyle(t.slug)}
                  className="inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full hue-wash hue-ink text-sm font-medium border border-transparent hover:hue-border transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full hue-dot" />
                  {t.name}
                  <span className="font-mono text-[0.6875rem] opacity-70">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {links.length > 0 && (
          <div className="panel p-6 shadow-[var(--shadow)]">
            <h2 className="font-display font-semibold text-lg tracking-tight">Elsewhere</h2>
            <ul className="mt-3 -mx-2">
              {links.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-3 h-11 px-2 rounded-[12px] text-sm text-[var(--fg-secondary)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
                    )}
                  >
                    <Icon className="w-4 h-4 hue-ink" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
