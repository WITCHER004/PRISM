// One-time (safe to re-run): create the public copy and server-only body of every published article,
// for the server-enforced paywall (security audit F-02). Run it AFTER deploying the new app code and
// BEFORE deploying the new Firestore rules, or feeds will be empty until it has run:
//
//   npx tsx scripts/backfill-public-articles.ts --dry-run     # report only
//   npx tsx scripts/backfill-public-articles.ts               # write
//
// Credentials: FIREBASE_SERVICE_ACCOUNT_KEY (JSON or base64), read from the environment or .env.local.
import { readFileSync, existsSync } from "node:fs"
import { cert, initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import { ARTICLE_BODIES, isPubliclyPublished, PUBLIC_ARTICLES, publicCopyOf } from "../src/lib/paywall"

const dryRun = process.argv.includes("--dry-run")

// Load .env.local the way Next does for this one variable, without printing it
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="))
  if (line) process.env.FIREBASE_SERVICE_ACCOUNT_KEY = line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")
}
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
const sa = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null
initializeApp({ credential: sa ? cert(sa) : applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || sa?.project_id || "prism-2d284" })
const db = getFirestore()

async function main() {
  const articles = await db.collection("articles").get()
  let published = 0
  let locked = 0
  let removed = 0
  for (const doc of articles.docs) {
    const full = doc.data()
    const publicRef = db.collection(PUBLIC_ARTICLES).doc(doc.id)
    const bodyRef = db.collection(ARTICLE_BODIES).doc(doc.id)
    if (!isPubliclyPublished(full)) {
      const existing = await publicRef.get()
      if (existing.exists) {
        removed++
        if (!dryRun) await Promise.all([publicRef.delete(), bodyRef.delete()])
      }
      continue
    }
    const { copy, body } = publicCopyOf(full)
    published++
    if ((copy.live as { locked?: boolean }).locked) locked++
    if (dryRun) continue
    const existing = await publicRef.get()
    // First copy: carry the article's counters over; later runs keep the copy's own
    const counters = existing.exists ? {} : { likes: Number(full.likes ?? 0), views: Number(full.views ?? 0) }
    const data: Record<string, unknown> = { ...copy, ...counters }
    for (const k of ["submitted", "review", "rebuttal", "audiobookUrl", "audiobookDurationSec", "audiobookSource"]) data[k] = FieldValue.delete()
    await publicRef.set(data, { mergeFields: Object.keys(data) })
    if (body) await bodyRef.set({ ...body, updatedAt: Date.now() })
  }
  console.log(`${dryRun ? "[dry run] would write" : "wrote"} ${published} public copies (${locked} locked to a preview); ${removed} stale copies ${dryRun ? "would be " : ""}removed`)
}

main().catch((err) => {
  console.error("backfill failed:", (err as Error).message)
  process.exit(1)
})
