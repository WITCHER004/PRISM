"use client"

import { useMemo } from "react"
import { resolveAccess, type UserAccess } from "@/lib/access"
import { DEFAULT_AVATAR } from "@/lib/live/schema"
import { useUIStore } from "@/lib/store"

export interface DirectoryRow {
  username: string
  uid: string
  email: string | null
  displayName: string
  avatarUrl?: string
  access: UserAccess
  eliteSince?: string
  joinedAt?: string
}

/** Every account in Firestore `users`, with its resolved role */
export function useDirectory(): DirectoryRow[] {
  const users = useUIStore((s) => s.users)
  const subscriptions = useUIStore((s) => s.subscriptions)
  const access = useUIStore((s) => s.access)

  return useMemo(
    () =>
      Object.values(users).map((u) => {
        const sub = subscriptions[u.handle]
        const created = u.createdAt as { toMillis?: () => number } | undefined
        return {
          username: u.handle,
          uid: u.uid,
          email: u.email,
          displayName: u.displayName || u.handle,
          avatarUrl: u.photoURL || DEFAULT_AVATAR(u.handle),
          access: resolveAccess({ subscription: sub, record: access[u.handle] }),
          eliteSince: sub?.subscribedAt,
          joinedAt: typeof created?.toMillis === "function" ? new Date(created.toMillis()).toISOString() : undefined,
        }
      }),
    [users, subscriptions, access]
  )
}
