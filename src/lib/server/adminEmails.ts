import "server-only"

// The only accounts that can open /admin, matched against the verified email of the signed-in Firebase
// user. Server code only: browsers learn their own role from GET /api/auth/role and never see this list.
// firestore.rules and storage.rules carry the same list, so keep all three in step when it changes.
const ADMIN_EMAILS: readonly string[] = ["ayushra6111@gmail.com", "surishri03@gmail.com"]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
