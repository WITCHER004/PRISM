import "server-only"

// Server-side reads of published content from Firestore, for server components, the sitemap and
// llms.txt. Uses the REST-based Firestore Lite SDK on its own app instance: no Auth, no listeners.
// Only public data is read here (published articles, user profiles), which the rules allow anyone.
//
// Queries use single-field filters only, so no composite indexes need deploying; sorting happens here.

import { cache } from "react"
import { getApp, getApps, initializeApp } from "firebase/app"
import { collection, doc, getDoc, getDocs, getFirestore, limit, query, where } from "firebase/firestore/lite"
import type { Post, User } from "@/lib/data"
import { firebaseConfig } from "@/lib/firebase-config"
import { articleFromDoc, COL, postFromArticle, readUserDoc, userFromDoc, type ArticleWorkflow } from "@/lib/live/schema"

const APP_NAME = "prism-server"
const app = getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(firebaseConfig, APP_NAME)
const db = getFirestore(app)

const warn = (what: string, err: unknown) =>
  console.warn(`[content] ${what}:`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

/** Every published article (newest first). Cached per request. */
export const getPublishedArticles = cache(async (max = 500): Promise<ArticleWorkflow[]> => {
  try {
    const snap = await getDocs(query(collection(db, COL.articles), where("verificationStatus", "==", "published"), limit(max)))
    return snap.docs
      .map((d) => articleFromDoc(d.id, d.data()))
      .filter((a) => a.live && a.publishedAt)
      .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
  } catch (err) {
    warn("couldn't load published articles", err)
    return []
  }
})

/** All users, keyed by handle. Cached per request. */
export const getUsersByHandle = cache(async (): Promise<Map<string, User>> => {
  const map = new Map<string, User>()
  try {
    const snap = await getDocs(query(collection(db, COL.users), limit(2000)))
    for (const d of snap.docs) {
      const u = readUserDoc(d.id, d.data())
      if (!u.suspended) map.set(u.handle, userFromDoc(u))
    }
  } catch (err) {
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
    const snap = await getDoc(doc(db, COL.articles, id))
    if (!snap.exists()) return null
    const a = articleFromDoc(snap.id, snap.data())
    const users = await getUsersByHandle()
    return postFromArticle(a, users.get(a.authorUsername))
  } catch (err) {
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
