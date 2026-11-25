"use client"

import { useMemo } from "react"
import type { Post, User } from "@/lib/data"
import { DEFAULT_AVATAR, postFromArticle, userFromDoc } from "@/lib/live/schema"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/** The signed-in writer, from their users/{uid} document (profile edits apply instantly) */
export function useWriter() {
  const currentUser = useUIStore((s) => s.currentUser) ?? ""
  const doc = useUIStore((s) => (s.currentUser ? s.users[s.currentUser] : undefined))
  const displayName = useUIStore((s) => s.profile.displayName)
  const avatarUrl = useUIStore((s) => s.profile.avatarUrl)
  const user: User = useMemo(() => {
    const base: User = doc
      ? userFromDoc(doc)
      : {
          id: currentUser,
          username: currentUser,
          displayName: displayName || currentUser,
          bio: "",
          avatarUrl: DEFAULT_AVATAR(currentUser),
          role: "WRITER",
          isVerifiedHuman: false,
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          createdAt: new Date(0).toISOString(),
        }
    return avatarUrl ? { ...base, avatarUrl } : base
  }, [doc, currentUser, displayName, avatarUrl])
  return { user, displayName: displayName || user.displayName }
}

/** The writer's published stories, live from Firestore (with view and like counters) */
export function usePublishedBy(username: string | null | undefined): Post[] {
  const drafts = useUIStore((s) => s.drafts)
  return useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.authorUsername === username && d.live && d.publishedAt)
        .map((d) => postFromArticle(d))
        .filter((p): p is Post => !!p)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [drafts, username]
  )
}

/** Strip tags so word counts and excerpts work from stored HTML */
export function htmlToText(html: string) {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export function wordCount(html: string) {
  const t = htmlToText(html)
  return t ? t.split(" ").length : 0
}

/** True when the HTML has any readable text or an image */
export function hasBody(html: string) {
  return wordCount(html) > 0 || /<img\s/i.test(html)
}

export const money = (n: number) =>
  n.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })

export function PageHead({
  title,
  lede,
  actions,
}: {
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
      <div className="max-w-2xl">
        <p className="meta">Studio</p>
        <h1 className="display mt-3 text-[2.5rem] sm:text-[3.25rem]">{title}</h1>
        {lede && <p className="mt-4 text-[var(--fg-muted)] text-base sm:text-lg leading-relaxed">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div className={cn("panel p-5 flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="meta">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-[var(--fg-subtle)]" />}
      </div>
      <p className="display mt-4 text-[2rem] tabular-nums">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
        {sub}
      </div>
    </div>
  )
}

export const inputClass =
  "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--fg)] outline-none transition-colors"
