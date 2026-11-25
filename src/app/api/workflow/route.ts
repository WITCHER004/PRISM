import { after, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { z } from "zod"
import { analyzeArticle, indexPublishedArticle } from "@/lib/moderation/analyzer"
import { articleFromDoc, articleToDoc, COL, readUserDoc } from "@/lib/live/schema"
import { adminConfigured, adminDb, verifyAppCheck, verifyRequestUser } from "@/lib/server/firebaseAdmin"
import { sharedRateLimit } from "@/lib/server/sharedRateLimit"
import { syncPublicCopy } from "@/lib/server/publicArticles"
import { MY_PANEL_VOTES, PANEL_BALLOTS, sealVotes, unsealVotes, type PanelVote } from "@/lib/elite/panel"
import {
  castPanelVote,
  decideReview,
  reconsiderCounter,
  submitCounter,
  submitForReview,
  withdraw,
  type Draft,
  type Result,
  type WorkflowContext,
  type WorkflowNote,
} from "@/lib/workflow/transitions"

// POST /api/workflow — every status change of an article happens here, never in the browser.
// The caller is identified by their Firebase ID token; their role comes from the verified email
// (staff) and their users document (panel membership, plan), which only staff can change.
// Body: { action, articleId, ... } — see Body below.

const Id = z.string().trim().min(1).max(128)
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit"), articleId: Id }),
  z.object({ action: z.literal("withdraw"), articleId: Id }),
  z.object({ action: z.literal("decide"), articleId: Id, decision: z.enum(["APPROVED", "REJECTED"]), notes: z.string().max(5000) }),
  z.object({ action: z.literal("vote"), articleId: Id, decision: z.enum(["PASS", "FAIL"]), reason: z.string().max(5000), criterion: z.string().min(1).max(100) }),
  z.object({ action: z.literal("counter"), articleId: Id, target: z.string().min(1).max(128), reason: z.string().max(5000), clarification: z.string().max(5000).optional() }),
  z.object({ action: z.literal("reconsider"), articleId: Id, target: z.string().min(1).max(128), verdict: z.enum(["ACCEPT", "UPHOLD"]), note: z.string().max(5000) }),
])

// The ML engine runs transformer models; give the submit check room to finish
export const maxDuration = 90

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

// Published stories for the plagiarism check, cached per server instance for 5 minutes: loading up to
// 1,000 full articles on every submit made each submission expensive (audit F-20)
const CORPUS_TTL_MS = 5 * 60_000
let corpusCache: { at: number; docs: { id: string; title: string; html: string; url: string }[] } | null = null
async function publishedCorpus(db: FirebaseFirestore.Firestore) {
  if (corpusCache && Date.now() - corpusCache.at < CORPUS_TTL_MS) return corpusCache.docs
  const published = await db.collection(COL.articles).where("verificationStatus", "==", "published").limit(1000).get()
  const docs = published.docs
    .map((x) => articleFromDoc(x.id, x.data()))
    .filter((x) => x.live)
    .map((x) => ({ id: x.id, title: x.live!.title, html: x.live!.contentHtml, url: `/${x.authorUsername}/${x.slug}` }))
  corpusCache = { at: Date.now(), docs }
  return docs
}
const newId = () => randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "x"

export async function POST(request: Request) {
  if (!adminConfigured()) {
    console.error("[workflow] Firebase Admin credentials are missing (FIREBASE_SERVICE_ACCOUNT_KEY)")
    return json({ error: "Reviews are temporarily unavailable. Try again later." }, 503)
  }
  if ((await verifyAppCheck(request)) === false) return json({ error: "This request didn't come from the Prism app." }, 401)
  const caller = await verifyRequestUser(request)
  if (!caller) return json({ error: "Sign in to continue." }, 401)

  const limited = await sharedRateLimit(`workflow|${caller.uid}`, 30, 60_000)
  if (!limited.ok) return json({ error: "Too many requests. Slow down and try again shortly." }, 429)

  let body: z.infer<typeof Body>
  try {
    const parsed = Body.safeParse(await request.json())
    if (!parsed.success) return json({ error: "Invalid request." }, 400)
    body = parsed.data
  } catch {
    return json({ error: "Expected a JSON body." }, 400)
  }

  try {
    const db = adminDb()
    const [meSnap, panelSnap] = await Promise.all([
      db.collection(COL.users).doc(caller.uid).get(),
      db.collection(COL.users).where("isPanelMember", "==", true).limit(500).get(),
    ])
    if (!meSnap.exists) return json({ error: "Finish setting up your profile first." }, 403)
    const me = readUserDoc(caller.uid, meSnap.data()!)
    if (me.suspended) return json({ error: "Your account is suspended." }, 403)
    const panel = panelSnap.docs.map((d) => readUserDoc(d.id, d.data())).filter((u) => u.isPanelMember && !u.suspended)

    const ref = db.collection(COL.articles).doc(body.articleId)

    // Submissions are scored on the text as stored, by the server's own Phase 1 check
    let report: Awaited<ReturnType<typeof analyzeArticle>> | null = null
    let corpus: { id: string; title: string; html: string; url: string }[] = []
    let analyzedAt: unknown = null
    if (body.action === "submit") {
      const snap = await ref.get()
      if (!snap.exists) return json({ error: "Story not found." }, 404)
      const d = articleFromDoc(snap.id, snap.data()!)
      if (d.authorUid !== caller.uid) return json({ error: "Only the author can submit this story." }, 403)
      analyzedAt = snap.data()!.updatedAt ?? null
      // Each submit can reach the paid detector: a daily budget per account on top of the per-minute one (F-20)
      const daily = await sharedRateLimit(`submit|${caller.uid}`, 20, 24 * 60 * 60_000)
      if (!daily.ok) return json({ error: "You've submitted a lot today. Try again tomorrow." }, 429)
      corpus = (await publishedCorpus(db)).filter((x) => x.id !== snap.id)
      report = await analyzeArticle({
        title: d.title,
        contentHtml: d.contentHtml,
        articleId: d.id,
        topic: d.tags[0],
        craft: d.craft,
        corpus,
      })
    }

    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { status: 404, result: { ok: false, error: "Story not found." } as Result }
      const raw = snap.data()!
      if (body.action === "submit" && (raw.updatedAt ?? null) !== analyzedAt)
        return { status: 409, result: { ok: false, error: "The story changed while it was being checked. Submit again." } as Result }
      const sealed = articleFromDoc(snap.id, raw)
      // Blind panel (F-21): the article holds sealed votes; the real ballots are server-only
      const ballotRef = db.collection(PANEL_BALLOTS).doc(snap.id)
      const ballots = sealed.panel ? await tx.get(ballotRef) : null
      const d = ballots?.exists && sealed.panel
        ? { ...sealed, panel: unsealVotes(sealed.panel, (ballots.data()!.votes ?? []) as PanelVote[]) }
        : sealed
      const authorSnap = d.authorUid ? await tx.get(db.collection(COL.users).doc(d.authorUid)) : null
      const author = authorSnap?.exists ? readUserDoc(authorSnap.id, authorSnap.data()!) : null

      const ctx: WorkflowContext = {
        actor: me.handle,
        actorUid: caller.uid,
        actorIsAdmin: caller.isAdmin,
        actorIsPanelMember: me.isPanelMember && !me.suspended,
        // The author never sits on their own panel: excluded by uid, which the client can't change
        panelPool: panel.filter((u) => u.uid !== d.authorUid).map((u) => u.handle),
        authorIsElite: author?.tier === "elite",
        at: new Date().toISOString(),
        newId,
      }
      const result: Result = run(body, d, ctx, report, corpus)
      if (!result.ok) return { status: 400, result }

      const data = articleToDoc({ ...result.draft, updatedAt: ctx.at }) as Record<string, unknown>
      const votes = result.draft.panel
      if (votes && result.draft.status === "PENDING_PEER_PANEL") {
        // Still open: keep the ballots sealed on the article, the real ones server-side
        data.peerVotes = sealVotes(votes)
        tx.set(ballotRef, { votes, updatedAt: ctx.at })
        if (body.action === "vote") {
          const mine = votes.find((v) => v.reviewer === me.handle && v.decision)
          if (mine) tx.set(db.collection(MY_PANEL_VOTES).doc(`${snap.id}_${caller.uid}`), { uid: caller.uid, articleId: snap.id, vote: mine })
        }
      } else if (ballots?.exists) {
        // The panel has decided: the full votes go on the article for the dossier
        tx.delete(ballotRef)
      }
      tx.set(ref, data, { mergeFields: Object.keys(data) })
      // Readers only ever see the public copy: a preview for locked stories, the full text otherwise (F-02)
      syncPublicCopy(tx, db, ref.id, { ...raw, ...data })
      await writeNotes(tx, result.notes, [me, author, ...panel].filter(Boolean) as { uid: string; handle: string }[])
      return { status: 200, result }
    })

    if (!outcome.result.ok) return json({ error: outcome.result.error }, outcome.status)
    // Newly published stories join the ML engine's plagiarism corpus (no-op when no engine is configured)
    const published = outcome.result.draft
    if (published.status === "PUBLISHED" && published.live) {
      after(() =>
        indexPublishedArticle({
          id: published.id,
          title: published.live!.title,
          contentHtml: published.live!.contentHtml,
          url: `/${published.authorUsername}/${published.slug}`,
        }).catch((err) => console.warn("[workflow] engine index failed:", (err as Error).message))
      )
    }
    // The stored report, which can differ from the raw one (voice posts with short notes skip the text gate)
    return json({ ok: true, status: outcome.result.draft.status, report: (report && outcome.result.draft.phase1) ?? undefined })
  } catch (err) {
    console.error("[workflow]", body.action, body.articleId, err)
    return json({ error: "Something went wrong. Try again." }, 500)
  }
}

function run(body: z.infer<typeof Body>, d: Draft, ctx: WorkflowContext, report: Awaited<ReturnType<typeof analyzeArticle>> | null, corpus: { id: string; title: string; html: string }[]): Result {
  switch (body.action) {
    case "submit":
      return submitForReview(d, report!, corpus, ctx)
    case "withdraw":
      return withdraw(d, ctx)
    case "decide":
      return decideReview(d, body.decision, body.notes, ctx)
    case "vote":
      return castPanelVote(d, body.decision, body.reason, body.criterion, ctx)
    case "counter":
      return submitCounter(d, body.target, body.reason, body.clarification, ctx)
    case "reconsider":
      return reconsiderCounter(d, body.target, body.verdict, body.note, ctx)
  }
}

/** Notifications go out with the change, addressed by uid (handles resolved from the users we loaded) */
async function writeNotes(tx: FirebaseFirestore.Transaction, notes: WorkflowNote[], known: { uid: string; handle: string }[]) {
  if (!notes.length) return
  const db = adminDb()
  const byHandle = new Map(known.map((u) => [u.handle, u.uid]))
  // Recipients we don't have yet (e.g. the staff member who rejected a story)
  const missing = [...new Set(notes.filter((n) => !n.toUid && n.to && !byHandle.has(n.to)).map((n) => n.to!))]
  for (const handle of missing.slice(0, 10)) {
    const q = await db.collection(COL.users).where("handle", "==", handle).limit(1).get()
    if (!q.empty) byHandle.set(handle, q.docs[0].id)
  }
  for (const n of notes) {
    const recipientId = n.toUid ?? (n.to ? byHandle.get(n.to) : undefined)
    if (!recipientId) continue
    tx.set(db.collection(COL.notifications).doc(n.id), {
      recipientId,
      type: n.kind,
      message: n.text.slice(0, 300),
      articleId: n.articleId ?? null,
      href: n.href ?? null,
      read: false,
      createdAt: Date.parse(n.createdAt) || Date.now(),
    })
  }
}
