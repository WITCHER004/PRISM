"use client"

import { BadgeCheck, ShieldCheck } from "lucide-react"
import type { User, UserRole } from "@/lib/data"
import { userFromDoc } from "@/lib/live/schema"
import { useUIStore } from "@/lib/store"
import type { SocialHandles } from "@/lib/social"
import { Avatar } from "@/components/ui/Avatar"
import { cn } from "@/lib/utils"

export interface Identity {
  username: string
  displayName: string
  bio: string
  avatarUrl: string
  role: UserRole
  handles: SocialHandles
  /** The account behind this identity (from Firestore users), if it exists */
  base?: User
}

const FALLBACK_AVATAR = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e2e8f0`

/** Who a handle is: their live users/{uid} document (the signed-in user's own edits apply instantly) */
export function useIdentity(username: string | null | undefined): Identity | null {
  const doc = useUIStore((s) => (username ? s.users[username] : undefined))
  const isMe = useUIStore((s) => !!username && s.currentUser === username)
  const profile = useUIStore((s) => s.profile)
  if (!username) return null
  const base = doc ? userFromDoc(doc) : undefined
  const p = isMe ? profile : undefined
  return {
    username,
    displayName: p?.displayName?.trim() || base?.displayName || username,
    bio: p ? p.bio : (base?.bio ?? ""),
    avatarUrl: p?.avatarUrl || base?.avatarUrl || FALLBACK_AVATAR(username),
    role: doc?.isPanelMember ? "PEER_REVIEWER" : "WRITER",
    handles: {
      linkedinHandle: p ? p.linkedinHandle : base?.linkedinHandle,
      instagramHandle: p ? p.instagramHandle : base?.instagramHandle,
      twitterHandle: p ? p.twitterHandle : base?.twitterHandle,
      githubHandle: p ? p.githubHandle : base?.githubHandle,
      websiteUrl: p ? p.websiteUrl : base?.websiteUrl,
    },
    base,
  }
}

/** An Identity as the `User` shape article components expect */
export function userOfIdentity(id: Identity): User {
  return {
    id: id.base?.id ?? id.username,
    username: id.username,
    displayName: id.displayName,
    bio: id.bio,
    avatarUrl: id.avatarUrl,
    role: id.role,
    isVerifiedHuman: id.base?.isVerifiedHuman ?? false,
    followerCount: id.base?.followerCount ?? 0,
    followingCount: id.base?.followingCount ?? 0,
    postCount: id.base?.postCount ?? 0,
    createdAt: id.base?.createdAt ?? new Date(0).toISOString(),
    ...id.handles,
  }
}

/** Avatar that reflects a user's uploaded photo (for server-rendered bylines) */
export function UserAvatar({
  username,
  fallbackSrc,
  alt,
  size = "md",
  className,
}: {
  username: string
  fallbackSrc?: string
  alt: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const id = useIdentity(username)
  return <Avatar src={id?.avatarUrl ?? fallbackSrc} alt={alt} size={size} className={className} />
}

export const ROLE_LABEL: Record<UserRole, string> = {
  READER: "Reader",
  WRITER: "Writer",
  PUBLICATION_EDITOR: "Editor",
  EMPLOYEE: "Prism staff",
  REVIEWER: "Reviewer",
  PEER_REVIEWER: "Peer panel",
  ADMIN: "Admin",
}

export function RoleBadge({ role, verified, className }: { role: UserRole; verified?: boolean; className?: string }) {
  const staff = role === "EMPLOYEE" || role === "REVIEWER" || role === "PEER_REVIEWER" || role === "ADMIN"
  const Icon = staff ? ShieldCheck : BadgeCheck
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-xs font-medium",
        staff
          ? "border-[var(--accent)]/30 bg-[var(--accent-subtle)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)]",
        className
      )}
    >
      {(staff || verified) && <Icon className="w-3.5 h-3.5" aria-hidden />}
      {ROLE_LABEL[role]}
    </span>
  )
}
