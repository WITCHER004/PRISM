"use client"

import { useAuth } from "@/components/providers/AuthProvider"
import { useSubscription } from "@/components/elite/hooks"
import { useUIStore } from "@/lib/store"

export interface Viewer {
  username: string
  displayName: string
  avatarUrl?: string
  email?: string | null
  uid?: string
}

/**
 * The person using the app, or null when signed out. Signed in means Firebase Auth has a user;
 * the handle and profile come from their users/{uid} document (mirrored into the store).
 */
export function useViewer() {
  const { user: authUser, userProfile, loading } = useAuth()
  const currentUser = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)
  const { isElite: subscribed } = useSubscription()

  const emailHandle = authUser?.email?.split("@")[0]
  const viewer: Viewer | null = authUser
    ? {
        username: currentUser ?? emailHandle ?? authUser.uid.slice(0, 10),
        displayName: profile.displayName || authUser.displayName || emailHandle || "Member",
        avatarUrl: profile.avatarUrl || authUser.photoURL || undefined,
        email: authUser.email,
        uid: authUser.uid,
      }
    : null

  const isElite = !!viewer && (subscribed || userProfile?.tier === "elite")

  return { viewer, loading, isElite }
}
