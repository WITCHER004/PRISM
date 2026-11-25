"use client"

import { useMemo } from "react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useViewer } from "@/components/providers/useViewer"
import { resolveAccess, type ApplicationInput, type ManagedRole, type UserAccess } from "@/lib/access"
import { reconsiderationStatus } from "@/lib/elite/panel"
import { useUIStore } from "@/lib/store"

// Role changes go through the store; src/lib/live/sync.ts writes them to Firestore (users/{uid},
// panel_applications/{id}) and the users listener brings every client the result.

/** Resolved role for a user (default: whoever is signed in to the site) */
export function useAccess(username?: string | null): UserAccess & { username: string | null } {
  const { viewer } = useViewer()
  const who = username === undefined ? (viewer?.username ?? null) : username
  const sub = useUIStore((s) => (who ? s.subscriptions[who] : undefined))
  const record = useUIStore((s) => (who ? s.access[who] : undefined))
  return useMemo(() => ({ username: who, ...resolveAccess({ subscription: sub, record }) }), [who, sub, record])
}

/** The signed-in user's own role changes */
export function useRoleActions() {
  const { viewer } = useViewer()
  const { user, patchUserProfile } = useAuth()
  const uid = user?.uid

  return useMemo(
    () => ({
      upgrade(reference: string) {
        const res = useUIStore.getState().upgradeToElite(reference)
        if (res.ok) patchUserProfile({ tier: "elite" })
        return res
      },
      cancel() {
        // Access continues until the period ends; isEliteActive lapses it at expiresAt
        useUIStore.getState().cancelElite()
      },
      resume() {
        useUIStore.getState().resumeElite()
      },
      applyForPanel(input: ApplicationInput) {
        const res = useUIStore.getState().submitPanelApplication({
          ...input,
          uid,
          email: viewer?.email ?? null,
          displayName: viewer?.displayName ?? viewer?.username ?? "Member",
        })
        if (res.ok) patchUserProfile({ panelApplicationStatus: "pending" })
        return res
      },
    }),
    [uid, viewer?.email, viewer?.displayName, viewer?.username, patchUserProfile]
  )
}

/** Actions inside /admin, performed as the whitelisted admin who is signed in */
export function useAdminActions() {
  const actor = useUIStore((s) => s.adminSession)
  return useMemo(
    () => ({
      actor,
      decideApplication(id: string, decision: "approved" | "rejected", note?: string) {
        if (!actor) return { ok: false as const, error: "Sign in with an admin account." }
        return useUIStore.getState().decidePanelApplication(id, decision, actor, note)
      },
      setRole(username: string, role: ManagedRole) {
        if (!actor) return { ok: false as const, error: "Sign in with an admin account." }
        return useUIStore.getState().setManagedRole(username, role, actor)
      },
    }),
    [actor]
  )
}

/** Panel papers waiting on this member's vote + counter-rebuttals waiting on their reconsideration */
export function usePanelInbox(username: string | null | undefined) {
  const drafts = useUIStore((s) => s.drafts)
  return useMemo(() => {
    if (!username) return { votes: 0, counters: 0, total: 0 }
    let votes = 0
    let counters = 0
    for (const d of Object.values(drafts)) {
      if (d.authorUsername === username || !d.panel) continue
      if (d.status === "PENDING_PEER_PANEL" && d.panel.some((v) => v.reviewer === username && !v.decision)) votes++
      if (d.status === "COUNTER_SUBMITTED")
        counters += d.panel.filter((v) => v.reviewer === username && reconsiderationStatus(v) === "PENDING").length
    }
    return { votes, counters, total: votes + counters }
  }, [drafts, username])
}
