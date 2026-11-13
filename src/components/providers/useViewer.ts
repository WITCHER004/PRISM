"use client"

import { useAuth } from "@/components/providers/AuthProvider"
import { useSubscription } from "@/components/elite/hooks"
import { findAccount, type User } from "@/lib/data"
import { DEV_TOOLS } from "@/lib/devtools"
import { useUIStore } from "@/lib/store"

export interface Viewer {
  username: string
  displayName: string
  avatarUrl?: string
  email?: string | null
  uid?: string
  role?: User["role"]
}

/**
 * The person using the app, or null when signed out.
 * Signed in = Firebase has a user OR the app session (store.currentUser) is set — the same rule the
 * login page uses, so every surface agrees. findAccount only enriches the mock/demo accounts.
 */
export function useViewer() {
  const { user: authUser, userProfile, loading } = useAuth()
  const currentUser = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)
  const demoEliteView = useUIStore((s) => s.demoEliteView)
  const { isElite: subscribed } = useSubscription()

  const account = findAccount(currentUser)
  const emailHandle = authUser?.email?.split("@")[0]
  const viewer: Viewer | null =
    authUser || currentUser
      ? {
          username: currentUser ?? emailHandle ?? authUser!.uid.slice(0, 10),
          displayName:
            profile.displayName || authUser?.displayName || account?.displayName || emailHandle || currentUser || "Member",
          avatarUrl: profile.avatarUrl || authUser?.photoURL || account?.avatarUrl || undefined,
          email: authUser?.email ?? profile.email,
          uid: authUser?.uid,
          role: account?.role,
        }
      : null

  // Elite from the subscription, or a tier stored on the Firestore profile
  const isElite = !!viewer && (subscribed || userProfile?.tier === "elite")
  // Dev builds can preview Elite-only content without paying
  const demoElite = DEV_TOOLS && demoEliteView

  return { viewer, loading, isElite, demoElite }
}
