// The four roles on Prism, as plain data + pure functions (no React, safe anywhere).
//
//   free  ──upgrade──▶  elite  ──apply──▶  pending  ──admin approves──▶  panel member
//
// Free, Elite and Panel Member are the SAME account on the SAME site: each step unlocks
// capabilities in place. Admin is separate: it only exists inside the isolated /admin portal, and only
// for the emails in ADMIN_EMAILS (src/lib/admin.ts).

import { isEliteActive, type Subscription } from "@/lib/elite/subscription"

export type Tier = "free" | "elite"
export type PanelApplicationStatus = "none" | "pending" | "approved" | "rejected"

/** Domains an applicant can review in; same seven bands as the homepage spectrum */
export const EXPERTISE = [
  { slug: "programming", name: "Programming" },
  { slug: "infrastructure", name: "Infrastructure" },
  { slug: "design", name: "Design" },
  { slug: "science", name: "Science" },
  { slug: "policy", name: "Policy" },
  { slug: "culture", name: "Culture" },
  { slug: "philosophy", name: "Philosophy" },
] as const

export const STATEMENT_MIN = 80
export const STATEMENT_MAX = 1200

/** Per-user role flags, keyed by username in the store and mirrored to Firestore `users/{uid}` */
export interface AccessRecord {
  uid?: string
  isPanelMember?: boolean
  panelApplicationStatus?: PanelApplicationStatus
  isAdmin?: boolean
  suspended?: boolean
}

/** A request to join the 10-member peer panel. Stored in Firestore `panel_applications/{id}`. */
export interface PanelApplication {
  id: string
  username: string
  uid?: string
  displayName: string
  email?: string | null
  expertise: string[]
  credentialsUrl: string
  statement: string
  status: Exclude<PanelApplicationStatus, "none">
  submittedAt: string
  decidedAt?: string
  decidedBy?: string
  decisionNote?: string
}

export type ApplicationInput = Pick<PanelApplication, "expertise" | "credentialsUrl" | "statement">

/** Everything the UI needs to decide what a user can do */
export interface UserAccess {
  tier: Tier
  isElite: boolean
  isPanelMember: boolean
  panelApplicationStatus: PanelApplicationStatus
  isAdmin: boolean
  suspended: boolean
}

export function resolveAccess(input: { subscription?: Subscription; record?: AccessRecord }): UserAccess {
  const { subscription, record } = input
  const suspended = !!record?.suspended
  const isElite = !suspended && isEliteActive(subscription)
  // Members join through an approved application (or an admin putting them on the panel)
  const isPanelMember = !suspended && !!record?.isPanelMember
  return {
    tier: isElite ? "elite" : "free",
    isElite,
    isPanelMember,
    panelApplicationStatus: isPanelMember ? "approved" : (record?.panelApplicationStatus ?? "none"),
    // record.isAdmin is set from the ADMIN_EMAILS whitelist (src/lib/admin.ts)
    isAdmin: !suspended && !!record?.isAdmin,
    suspended,
  }
}

/** The single admin role label shown in the users table */
export type ManagedRole = "free" | "elite" | "panel" | "suspended"

export function managedRoleOf(a: UserAccess): ManagedRole {
  if (a.suspended) return "suspended"
  if (a.isPanelMember) return "panel"
  return a.isElite ? "elite" : "free"
}

/** Returns an error message, or null when the application is complete */
export function validateApplication(input: ApplicationInput): string | null {
  if (!input.expertise.length) return "Pick at least one domain you can review."
  const url = input.credentialsUrl.trim()
  if (!url) return "Add a link to your credentials, portfolio, Google Scholar or GitHub."
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error()
  } catch {
    return "That link doesn't look like a web address (https://…)."
  }
  const s = input.statement.trim()
  if (s.length < STATEMENT_MIN) return `Your statement needs ${STATEMENT_MIN - s.length} more characters.`
  if (s.length > STATEMENT_MAX) return `Keep your statement under ${STATEMENT_MAX} characters.`
  return null
}
