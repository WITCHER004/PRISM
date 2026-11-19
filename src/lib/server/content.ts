import "server-only"

// Server-side reads of published content from Firestore, for server components, the sitemap and
// llms.txt. Talks to the Firestore v1 REST API with plain fetch(): no Firebase SDK on the server, so no
// RPC transport, listeners or SDK logging. Only public data is read here (published articles, user
// profiles), which the rules allow anyone, so the web API key is enough.
//
// Queries use single-field filters only, so no composite indexes need deploying; sorting happens here.
// Every read fails soft: if Firestore is unreachable the pages render empty instead of throwing.

import { cache } from "react"
import { unstable_rethrow } from "next/navigation"
import type { Post, User } from "@/lib/data"
import { firebaseConfig } from "@/lib/firebase-config"
import { articleFromDoc, COL, postFromArticle, readUserDoc, userFromDoc, type ArticleWorkflow } from "@/lib/live/schema"

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`
const TIMEOUT_MS = 8000

const warn = (what: string, err: unknown) =>
  console.warn(`[content] ${what}:`, (err as Error)?.message ?? err)

/* ── Firestore REST ───────────────────────────────────────────────────────── */

type RestValue = {
  nullValue?: null
  booleanValue?: boolean
  integerValue?: string
  doubleValue?: number
  timestampValue?: string
  stringValue?: string
  bytesValue?: string
  referenceValue?: string
  geoPointValue?: { latitude: number; longitude: number }
  arrayValue?: { values?: RestValue[] }
  mapValue?: { fields?: Record<string, RestValue> }
}
type RestDoc = { name: string; fields?: Record<string, RestValue> }

/** A REST value → plain JS (timestamps become ISO strings, which the schema readers accept) */
function fromRest(v: RestValue): unknown {
  if ("stringValue" in v) return v.stringValue
  if ("integerValue" in v) return Number(v.integerValue)
  if ("doubleValue" in v) return v.doubleValue
  if ("booleanValue" in v) return v.booleanValue
  if ("timestampValue" in v) return v.timestampValue
  if ("nullValue" in v) return null
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(fromRest)
  if ("mapValue" in v) return fieldsToObject(v.mapValue?.fields)
  if ("referenceValue" in v) return v.referenceValue
  if ("geoPointValue" in v) return v.geoPointValue
  if ("bytesValue" in v) return v.bytesValue
  return undefined
}

function fieldsToObject(fields: Record<string, RestValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = fromRest(v)
  return out
}

const docId = (d: RestDoc) => d.name.slice(d.name.lastIndexOf("/") + 1)

async function rest<T>(url: string, init?: RequestInit): Promise<T> {
  const sep = url.includes("?") ? "&" : "?"
  const res = await fetch(`${url}${sep}key=${firebaseConfig.apiKey}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`)
  return (await res.json()) as T
}

/** A structured query on one collection (optional equality filter) → [id, data] pairs */
async function runQuery(
  collectionId: string,
  opts: { where?: { field: string; equals: string }; limit: number }
): Promise<[string, Record<string, unknown>][]> {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId }], limit: opts.limit }
  if (opts.where) {
    structuredQuery.where = {
      fieldFilter: { field: { fieldPath: opts.where.field }, op: "EQUAL", value: { stringValue: opts.where.equals } },
    }
  }
  const rows = await rest<{ document?: RestDoc }[]>(`${BASE}:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery }),
  })
  return rows.filter((r) => r.document).map((r) => [docId(r.document!), fieldsToObject(r.document!.fields)])
}

/** One document, or null when it doesn't exist */
async function getDocument(collectionId: string, id: string): Promise<[string, Record<string, unknown>] | null> {
  try {
    const d = await rest<RestDoc>(`${BASE}/${collectionId}/${encodeURIComponent(id)}`)
    return [docId(d), fieldsToObject(d.fields)]
  } catch (err) {
    unstable_rethrow(err)
    if ((err as Error).message?.startsWith("HTTP 404")) return null
    throw err
  }
}

/* ── Reads ────────────────────────────────────────────────────────────────── */

/** Every published article (newest first). Cached per request. */
export const getPublishedArticles = cache(async (max = 500): Promise<ArticleWorkflow[]> => {
  try {
    const rows = await runQuery(COL.articles, { where: { field: "verificationStatus", equals: "published" }, limit: max })
    return rows
      .map(([id, data]) => articleFromDoc(id, data))
      .filter((a) => a.live && a.publishedAt)
      .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
  } catch (err) {
    unstable_rethrow(err) // Next's own signals (e.g. dynamic rendering) must not be swallowed
    warn("couldn't load published articles", err)
    return []
  }
})

/** All users, keyed by handle. Cached per request. */
export const getUsersByHandle = cache(async (): Promise<Map<string, User>> => {
  const map = new Map<string, User>()
  try {
    for (const [id, data] of await runQuery(COL.users, { limit: 2000 })) {
      const u = readUserDoc(id, data)
      if (!u.suspended) map.set(u.handle, userFromDoc(u))
    }
  } catch (err) {
    unstable_rethrow(err) // Next's own signals (e.g. dynamic rendering) must not be swallowed
    warn("couldn't load users", err)
  }
  return map
})

/** Published posts with their authors' live profiles */
export const getPublishedPosts = cache(async (max = 500): Promise<Post[]> => {
  const [articles, users] = await Promise.all([getPublishedArticles(max), getUsersByHandle()])
  const counts = new Map<string, number>()
  for (const a of articles) counts.set(a.authorUsername, (counts.get(a.authorUsername) ?? 0) + 1)
  return articles
    .map((a) => {
      const u = users.get(a.authorUsername)
      return postFromArticle(a, u ? { ...u, postCount: counts.get(a.authorUsername) ?? 0 } : undefined)
    })
    .filter((p): p is Post => !!p)
})

/** The published article document behind a /{handle}/{slug} URL (for craft certificates and dossiers) */
export async function getArticleBySlug(handle: string, slug: string): Promise<ArticleWorkflow | null> {
  const articles = await getPublishedArticles()
  return articles.find((a) => a.authorUsername === handle && a.slug === slug) ?? null
}

export async function getPostBySlug(handle: string, slug: string): Promise<Post | null> {
  const posts = await getPublishedPosts()
  return posts.find((p) => p.author.username === handle && p.slug === slug) ?? null
}

export async function getPostById(id: string): Promise<Post | null> {
  try {
    const row = await getDocument(COL.articles, id)
    if (!row) return null
    const a = articleFromDoc(row[0], row[1])
    const users = await getUsersByHandle()
    return postFromArticle(a, users.get(a.authorUsername))
  } catch (err) {
    unstable_rethrow(err) // Next's own signals (e.g. dynamic rendering) must not be swallowed
    warn(`couldn't load articles/${id}`, err)
    return null
  }
}

export async function getUserByHandle(handle: string): Promise<User | null> {
  const [users, posts] = await Promise.all([getUsersByHandle(), getPublishedPosts()])
  const u = users.get(handle)
  return u ? { ...u, postCount: posts.filter((p) => p.author.username === handle).length } : null
}

/** Writers with at least one published story, most published first */
export async function getActiveWriters(max = 12): Promise<User[]> {
  const [users, posts] = await Promise.all([getUsersByHandle(), getPublishedPosts()])
  const counts = new Map<string, number>()
  for (const p of posts) counts.set(p.author.username, (counts.get(p.author.username) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h, n]) => {
      const u = users.get(h)
      return u ? { ...u, postCount: n } : null
    })
    .filter((u): u is User => !!u)
    .slice(0, max)
}

/** Published-story count per topic slug */
export async function getTopicCounts(): Promise<Map<string, number>> {
  const posts = await getPublishedPosts()
  const counts = new Map<string, number>()
  for (const p of posts) for (const t of p.tags) counts.set(t.slug, (counts.get(t.slug) ?? 0) + 1)
  return counts
}
