// One-time (safe to re-run): remove the public `email` and `lastLoginAt` fields from every users/{uid}
// document (security audit F-31). Both now live in the owner-only user_private/{uid}. Members who sign
// in are cleaned up automatically; this covers everyone who hasn't signed in since.
//
//   npx tsx scripts/backfill-private-profile.ts --dry-run     # report only
//   npx tsx scripts/backfill-private-profile.ts               # write
import { existsSync, readFileSync } from "node:fs"
import { applicationDefault, cert, initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

const dryRun = process.argv.includes("--dry-run")
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="))
  if (line) process.env.FIREBASE_SERVICE_ACCOUNT_KEY = line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")
}
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
const sa = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null
initializeApp({ credential: sa ? cert(sa) : applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || sa?.project_id || "prism-2d284" })
const db = getFirestore()

async function main() {
  const users = await db.collection("users").get()
  let cleaned = 0
  for (const u of users.docs) {
    const d = u.data()
    if (!("email" in d) && !("lastLoginAt" in d)) continue
    cleaned++
    if (dryRun) continue
    const priv: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
    if (typeof d.email === "string") priv.email = d.email
    if (d.lastLoginAt) priv.lastLoginAt = d.lastLoginAt
    await db.collection("user_private").doc(u.id).set(priv, { merge: true })
    await u.ref.update({ email: FieldValue.delete(), lastLoginAt: FieldValue.delete() })
  }
  console.log(`${dryRun ? "[dry run] would clean" : "cleaned"} ${cleaned} of ${users.size} public profiles`)
}

main().catch((err) => {
  console.error("backfill failed:", (err as Error).message)
  process.exit(1)
})
