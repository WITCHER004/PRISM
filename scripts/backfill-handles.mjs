// One-time: register every existing member's handle in handles/{handle}, so nobody can claim a handle
// that an existing member already uses. Run once, right after deploying the new Firestore rules:
//
//   FIREBASE_SERVICE_ACCOUNT_KEY="$(cat service-account.json)" node scripts/backfill-handles.mjs
//   (add --dry-run to only report)
//
// Duplicates (two members already sharing a handle) are reported, not changed: rename one of them in
// /admin, then re-run.
import { cert, initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

const dryRun = process.argv.includes("--dry-run")
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
const sa = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null
initializeApp({ credential: sa ? cert(sa) : applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || sa?.project_id || "prism-2d284" })
const db = getFirestore()

const users = await db.collection("users").get()
const owners = new Map()
for (const u of users.docs) {
  const handle = u.get("handle")
  if (typeof handle !== "string" || !/^[a-z0-9_]{1,40}$/.test(handle)) {
    console.log(`skip  users/${u.id}: no valid handle (${JSON.stringify(handle)}); they get one on next sign-in`)
    continue
  }
  if (!owners.has(handle)) owners.set(handle, [])
  owners.get(handle).push(u.id)
}

let created = 0, existing = 0, conflicts = 0
for (const [handle, uids] of owners) {
  const ref = db.collection("handles").doc(handle)
  const reg = await ref.get()
  if (uids.length > 1) {
    conflicts++
    console.log(`DUPLICATE @${handle}: ${uids.join(", ")}${reg.exists ? ` (registered to ${reg.get("uid")})` : ""}`)
    continue
  }
  if (reg.exists) {
    existing++
    if (reg.get("uid") !== uids[0]) {
      conflicts++
      console.log(`CONFLICT @${handle}: registered to ${reg.get("uid")} but used by ${uids[0]}`)
    }
    continue
  }
  if (!dryRun) await ref.create({ uid: uids[0], createdAt: FieldValue.serverTimestamp() })
  created++
}
console.log(`\n${dryRun ? "[dry run] would register" : "registered"} ${created}, already registered ${existing}, conflicts ${conflicts}`)
process.exit(conflicts ? 1 : 0)
