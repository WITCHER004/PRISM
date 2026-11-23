import type { Phase1Report } from "@/lib/moderation/types"

// Browser side of POST /api/workflow. Every article status change goes through the server, which
// checks who's asking; the new state then arrives through the normal Firestore listeners.

export type WorkflowRequest =
  | { action: "submit"; articleId: string }
  | { action: "withdraw"; articleId: string }
  | { action: "decide"; articleId: string; decision: "APPROVED" | "REJECTED"; notes: string }
  | { action: "vote"; articleId: string; decision: "PASS" | "FAIL"; reason: string; criterion: string }
  | { action: "counter"; articleId: string; target: string; reason: string; clarification?: string }
  | { action: "reconsider"; articleId: string; target: string; verdict: "ACCEPT" | "UPHOLD"; note: string }

export type WorkflowResult = { ok: true; status?: string; report?: Phase1Report } | { ok: false; error: string }

/** Headers proving who's calling: the Firebase ID token, plus an App Check token when App Check is on */
export async function authHeaders(): Promise<Record<string, string> | null> {
  const { auth } = await import("@/lib/firebase")
  const user = auth.currentUser
  if (!user) return null
  const headers: Record<string, string> = { Authorization: `Bearer ${await user.getIdToken()}` }
  const { appCheckToken } = await import("@/lib/appCheck")
  const check = await appCheckToken()
  if (check) headers["X-Firebase-AppCheck"] = check
  return headers
}

/** Whatever identifies the caller: ID token when signed in, App Check token when App Check is on */
export async function optionalAuthHeaders(): Promise<Record<string, string>> {
  const signedIn = await authHeaders().catch(() => null)
  if (signedIn) return signedIn
  const { appCheckToken } = await import("@/lib/appCheck")
  const check = await appCheckToken()
  return check ? { "X-Firebase-AppCheck": check } : {}
}

export async function callWorkflow(body: WorkflowRequest): Promise<WorkflowResult> {
  try {
    const headers = await authHeaders()
    if (!headers) return { ok: false, error: "Sign in to continue." }
    const res = await fetch("/api/workflow", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string; report?: Phase1Report }
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong. Try again." }
    return { ok: true, status: data.status, report: data.report }
  } catch {
    return { ok: false, error: "Couldn't reach Prism. Check your connection and try again." }
  }
}
