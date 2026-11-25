"use client"

import { create } from "zustand"

// The reader's side of the server-enforced paywall (audit F-02). Locked stories arrive with only their
// preview; the full text is fetched from /api/articles/{id}/body, which checks who is asking. Nothing
// here grants access: it only remembers what the server already handed over (in memory, per tab).

type Status = "checking" | "locked" | "open"

interface PaywallState {
  /** postId → full rendered body, once the server granted it */
  bodies: Record<string, string>
  /** `${uid}|${postId}` → where the check stands for that reader */
  status: Record<string, Status>
}

export const usePaywallStore = create<PaywallState>(() => ({ bodies: {}, status: {} }))

const keyOf = (uid: string | null | undefined, postId: string) => `${uid ?? "anon"}|${postId}`

async function headers(signedInOnly: boolean): Promise<Record<string, string> | null> {
  const { authHeaders, optionalAuthHeaders } = await import("@/lib/workflow/client")
  return signedInOnly ? authHeaders().catch(() => null) : optionalAuthHeaders().catch(() => ({}))
}

/** Ask the server whether this reader may see the whole story; stores the body if so. One check per reader. */
export async function checkAccess(postId: string, uid: string | null | undefined) {
  const key = keyOf(uid, postId)
  const st = usePaywallStore.getState()
  if (st.bodies[postId] || st.status[key]) return
  usePaywallStore.setState((s) => ({ status: { ...s.status, [key]: "checking" } }))
  let html: string | null = null
  try {
    const res = await fetch(`/api/articles/${encodeURIComponent(postId)}/body`, { headers: (await headers(false)) ?? {}, cache: "no-store" })
    if (res.ok) html = ((await res.json()) as { html?: string }).html ?? null
  } catch {
    // Offline or the server is down: the story stays at its preview
  }
  usePaywallStore.setState((s) => ({
    bodies: html ? { ...s.bodies, [postId]: html } : s.bodies,
    status: { ...s.status, [key]: html ? "open" : "locked" },
  }))
}

export type UnlockMethod = "meter" | "share" | "purchase"

/** Record an unlock on the server (a free monthly story, a share, a purchase) and load the body */
export async function requestUnlock(postId: string, method: UnlockMethod): Promise<{ ok: true; remaining?: number } | { ok: false; error: string }> {
  const h = await headers(true)
  if (!h) return { ok: false, error: "Sign in to keep reading." }
  try {
    const res = await fetch(`/api/articles/${encodeURIComponent(postId)}/unlock`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ method }),
    })
    const data = (await res.json().catch(() => ({}))) as { html?: string; remaining?: number; error?: string }
    if (!res.ok || !data.html) return { ok: false, error: data.error ?? "Couldn't unlock this story. Try again." }
    usePaywallStore.setState((s) => ({ bodies: { ...s.bodies, [postId]: data.html! } }))
    return { ok: true, remaining: data.remaining }
  } catch {
    return { ok: false, error: "Couldn't reach Prism. Check your connection and try again." }
  }
}

export const usePaywallBody = (postId: string) => usePaywallStore((s) => s.bodies[postId])
export const useAccessStatus = (postId: string, uid: string | null | undefined) => usePaywallStore((s) => s.status[keyOf(uid, postId)])
