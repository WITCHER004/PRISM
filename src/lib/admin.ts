// The only accounts that can open /admin. Matched against the Google-verified email of the signed-in
// Firebase user. firestore.rules and storage.rules carry the same list, so this isn't UI-only: keep
// all three in step when it changes.
export const ADMIN_EMAILS = ["ayushra6111@gmail.com", "surishri03@gmail.com"] as const

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return (ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase())
}

/**
 * A signed-in Firebase user is an admin only if the whitelisted email is verified (always true for
 * Google sign-in). Without this, an unverified email/password sign-up using an admin's address would
 * pass the client check; the security rules apply the same email_verified condition.
 */
export function isAdminUser(user: { email: string | null; emailVerified?: boolean } | null | undefined): boolean {
  return !!user && user.emailVerified === true && isAdminEmail(user.email)
}
