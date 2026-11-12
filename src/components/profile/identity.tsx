"use client"

import { useShallow } from "zustand/react/shallow"
import { BadgeCheck, ShieldCheck } from "lucide-react"
import { findAccount, type User, type UserRole } from "@/lib/data"
import { SAMPLE_READERS } from "@/lib/reviews"
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
  /** Sample-data account behind this identity, if any */
  base?: User
}

const FALLBACK_AVATAR = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e2e8f0`

/**
 * Who a username is, as seen in this browser: sample data, overlaid with profile edits
 * (name, bio, handles, uploaded avatar) made by that account here.
 */
export function useIdentity(username: string | null | undefined): Identity | null {
  const { currentUser, profile, saved } = useUIStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      profile: s.profile,
      saved: username ? ((s as unknown as { savedProfiles?: Record<string, unknown> }).savedProfiles?.[username] as typeof s.profile | undefined) : undefined,
    }))
  )
  if (!username) return null
  const base = findAccount(username)
  const reader = SAMPLE_READERS.find((u) => u.username === username)
  const p = username === currentUser ? profile : saved
  return {
    username,
    displayName: p?.displayName?.trim() || base?.displayName || reader?.displayName || username,
    bio: p ? p.bio : (base?.bio ?? ""),
    avatarUrl: p?.avatarUrl || base?.avatarUrl || reader?.avatarUrl || FALLBACK_AVATAR(username),
    role: base?.role ?? "READER",
    handles: p
      ? {
          linkedinHandle: (p as { linkedinHandle?: string }).linkedinHandle,
          instagramHandle: (p as { instagramHandle?: string }).instagramHandle,
          twitterHandle: p.twitterHandle,
          githubHandle: (p as { githubHandle?: string }).githubHandle,
          websiteUrl: p.websiteUrl,
        }
      : {
          linkedinHandle: base?.linkedinHandle,
          instagramHandle: base?.instagramHandle,
          twitterHandle: base?.twitterHandle,
          githubHandle: base?.githubHandle,
          websiteUrl: base?.websiteUrl,
        },
    base,
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
