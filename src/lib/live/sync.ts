"use client"

// Two-way bridge between Firestore and the UI store.
//
//  Firestore → store   onSnapshot listeners, scoped to what the viewer may read:
//                      users (everyone) · published articles (everyone) · own articles · every article
//                      (admins) · articles on the panel (panel members) · own/all panel applications ·
//                      own notifications
//  store → Firestore   a store subscriber diffs each local change and writes only what changed:
//                      articles (author edits debounced, workflow moves immediate), notifications,
//                      panel applications, role/tier fields and the signed-in user's profile.
//
// Snapshots are applied with `applyingRemote` set, so they're never echoed back as writes.

import {
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Query,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { setDirectory } from "@/lib/data"
import { isEliteActive } from "@/lib/elite/subscription"
import { resolveAccess } from "@/lib/access"
import {
  applicationFromDoc,
  applicationToDoc,
  articleFromDoc,
  articleToDoc,
  clean,
  COL,
  readUserDoc,
  toIso,
  toMillis,
  userFromDoc,
  type NotificationDoc,
} from "@/lib/live/schema"
import { setCounterHooks, useUIStore, type AppNotification, type Draft } from "@/lib/store"

type State = ReturnType<typeof useUIStore.getState>

const warn = (what: string, err: unknown) =>
  console.warn(`[live] ${what}:`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

let applyingRemote = false
function asRemote(fn: () => void) {
  applyingRemote = true
  try {
    fn()
  } finally {
    applyingRemote = false
  }
}

/* ── Firestore → store ────────────────────────────────────────────────────── */

const pendingArticles = new Set<string>()
const articleSources = new Map<string, Map<string, Draft>>()

function publishArticles() {
  const merged: Record<string, Draft> = {}
  for (const src of articleSources.values()) for (const [id, d] of src) merged[id] = d
  asRemote(() => useUIStore.getState().applyRemoteArticles(merged, pendingArticles))
}

function listenArticles(key: string, q: Query<DocumentData>): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => {
      articleSources.set(key, new Map(snap.docs.map((d) => [d.id, articleFromDoc(d.id, d.data())])))
      publishArticles()
      useUIStore.getState().setLiveReady("articles")
    },
    (err) => {
      warn(`articles (${key}) listener stopped`, err)
      useUIStore.getState().setLiveReady("articles")
    }
  )
}

function dropArticleSource(key: string) {
  if (articleSources.delete(key)) publishArticles()
}

function notificationFromDoc(id: string, raw: DocumentData, handle: string): AppNotification {
  const d = raw as Partial<NotificationDoc>
  return {
    id,
    kind: (d.type as AppNotification["kind"]) ?? "system",
    to: handle,
    toUid: d.recipientId,
    text: d.message ?? "",
    href: d.href ?? (d.articleId ? `/story/${d.articleId}` : undefined),
    articleId: d.articleId ?? undefined,
    createdAt: toIso(d.createdAt) || new Date().toISOString(),
    read: d.read === true,
  }
}

/* ── store → Firestore ────────────────────────────────────────────────────── */

const ARTICLE_DEBOUNCE_MS = 900
const articleTimers = new Map<string, ReturnType<typeof setTimeout>>()

function flushArticle(id: string) {
  articleTimers.delete(id)
  const d = useUIStore.getState().drafts[id]
  if (!d) {
    pendingArticles.delete(id)
    return
  }
  if (!d.authorUid) {
    // Not signed in when it was written; nothing to attribute it to
    pendingArticles.delete(id)
    return
  }
  const data = articleToDoc(d) as unknown as DocumentData
  // mergeFields replaces each listed field wholesale (no stale nested keys) and never touches the
  // views/likes counters, which readers increment
  setDoc(doc(db, COL.articles, id), data, { mergeFields: Object.keys(data) })
    .catch((err) => warn(`couldn't save articles/${id}`, err))
    .finally(() => {
      if (!articleTimers.has(id)) pendingArticles.delete(id)
    })
}

function scheduleArticle(id: string, immediate: boolean) {
  pendingArticles.add(id)
  const t = articleTimers.get(id)
  if (t) clearTimeout(t)
  if (immediate) flushArticle(id)
  else articleTimers.set(id, setTimeout(() => flushArticle(id), ARTICLE_DEBOUNCE_MS))
}

/** Writes anything still waiting on a debounce (e.g. before the tab closes) */
export function flushPendingWrites() {
  for (const id of [...articleTimers.keys()]) {
    clearTimeout(articleTimers.get(id)!)
    flushArticle(id)
  }
}

const uidOf = (s: State, handle: string | undefined) => (handle ? s.users[handle]?.uid : undefined)

function writeNotification(s: State, n: AppNotification) {
  const recipientId = n.toUid ?? uidOf(s, n.to)
  if (!recipientId) return
  const data: NotificationDoc = {
    recipientId,
    type: n.kind,
    message: n.text,
    articleId: n.articleId ?? null,
    href: n.href ?? null,
    read: n.read,
    createdAt: Date.parse(n.createdAt) || Date.now(),
  }
  setDoc(doc(db, COL.notifications, n.id), data).catch((err) => warn(`couldn't send notification ${n.id}`, err))
}

function writeRoles(s: State, handle: string) {
  const uid = uidOf(s, handle)
  if (!uid) return
  const a = resolveAccess({ subscription: s.subscriptions[handle], record: s.access[handle] })
  const sub = s.subscriptions[handle]
  const fields = clean({
    tier: a.tier,
    isPanelMember: a.isPanelMember,
    panelApplicationStatus: a.panelApplicationStatus,
    suspended: a.suspended,
    eliteSince: isEliteActive(sub) && sub?.subscribedAt ? Date.parse(sub.subscribedAt) : undefined,
  })
  updateDoc(doc(db, COL.users, uid), fields).catch((err) => warn(`couldn't update roles on users/${uid}`, err))
}

function writeProfile(s: State) {
  if (!s.authUid) return
  const p = s.profile
  updateDoc(doc(db, COL.users, s.authUid), {
    displayName: p.displayName,
    bio: p.bio,
    photoURL: p.avatarUrl || null,
    websiteUrl: p.websiteUrl,
    twitterHandle: p.twitterHandle,
    linkedinHandle: p.linkedinHandle,
    instagramHandle: p.instagramHandle,
    githubHandle: p.githubHandle,
    emailDigest: p.emailDigest,
    emailReplies: p.emailReplies,
  }).catch((err) => warn("couldn't save your profile", err))
}

/** Statuses or panel changes are workflow moves: write them now. Text edits wait for the debounce. */
const isWorkflowChange = (a: Draft | undefined, b: Draft) =>
  !a || a.status !== b.status || a.panel !== b.panel || a.appeal !== b.appeal || a.review !== b.review || a.live !== b.live

function onStoreChange(s: State, prev: State) {
  if (applyingRemote || !s.authUid) return

  if (s.drafts !== prev.drafts) {
    for (const id of new Set([...Object.keys(s.drafts), ...Object.keys(prev.drafts)])) {
      const cur = s.drafts[id]
      const old = prev.drafts[id]
      if (cur === old) continue
      if (!cur) {
        pendingArticles.delete(id)
        const t = articleTimers.get(id)
        if (t) clearTimeout(t)
        articleTimers.delete(id)
        deleteDoc(doc(db, COL.articles, id)).catch((err) => warn(`couldn't delete articles/${id}`, err))
      } else {
        scheduleArticle(id, isWorkflowChange(old, cur))
      }
    }
  }

  if (s.notifications !== prev.notifications) {
    const before = new Map(prev.notifications.map((n) => [n.id, n]))
    for (const n of s.notifications) {
      const old = before.get(n.id)
      if (!old) writeNotification(s, n)
      else if (n.read && !old.read && n.toUid === s.authUid)
        updateDoc(doc(db, COL.notifications, n.id), { read: true }).catch((err) => warn("couldn't mark read", err))
    }
  }

  if (s.panelApplications !== prev.panelApplications) {
    for (const [id, a] of Object.entries(s.panelApplications)) {
      if (a !== prev.panelApplications[id])
        setDoc(doc(db, COL.applications, id), applicationToDoc(a)).catch((err) => warn(`couldn't save panel_applications/${id}`, err))
    }
  }

  if (s.access !== prev.access || s.subscriptions !== prev.subscriptions) {
    const handles = new Set([...Object.keys(s.access), ...Object.keys(s.subscriptions)])
    for (const h of handles) {
      if (s.access[h] !== prev.access[h] || s.subscriptions[h] !== prev.subscriptions[h]) writeRoles(s, h)
    }
  }

  // Only edits made during a session: signing in swaps the profile too, and must never overwrite the doc
  if (s.profile !== prev.profile && s.authUid === prev.authUid && s.currentUser === prev.currentUser) writeProfile(s)

  if (s.reviews !== prev.reviews) {
    for (const [key, rev] of Object.entries(s.reviews)) {
      if (rev === prev.reviews[key]) continue
      const postId = key.slice(0, key.lastIndexOf(":"))
      const ref = doc(db, COL.reviews, `${postId}_${s.authUid}`)
      if (!rev) {
        deleteDoc(ref).catch((err) => warn("couldn't delete your review", err))
        continue
      }
      setDoc(ref, {
        postId,
        postAuthor: rev.postAuthor ?? null,
        authorId: s.authUid,
        authorHandle: rev.author,
        authorName: s.profile.displayName || rev.author,
        authorAvatar: s.profile.avatarUrl || "",
        rating: rev.rating,
        body: rev.body,
        createdAt: Date.parse(rev.createdAt) || Date.now(),
        updatedAt: rev.updatedAt ? Date.parse(rev.updatedAt) : null,
      }).catch((err) => warn("couldn't save your review", err))
    }
  }
}

/** Readers' counters on an article (views, likes). Fire-and-forget. */
export function bumpArticle(id: string, field: "views" | "likes", by = 1) {
  if (!id || !by) return
  updateDoc(doc(db, COL.articles, id), { [field]: increment(by) }).catch((err) => warn(`couldn't count ${field} on ${id}`, err))
}

/* ── lifecycle ────────────────────────────────────────────────────────────── */

/**
 * Starts the always-on listeners and the write-back subscriber, then re-scopes the per-user listeners
 * whenever the signed-in user, their admin status or their panel membership changes.
 * Returns a function that stops everything.
 */
export function startLiveSync(): () => void {
  const stops: Unsubscribe[] = []
  setCounterHooks({ view: (id) => bumpArticle(id, "views"), like: (id, by) => bumpArticle(id, "likes", by) })

  stops.push(
    onSnapshot(
      query(collection(db, COL.users), limit(2000)),
      (snap) => {
        const docs = snap.docs.map((d) => readUserDoc(d.id, d.data()))
        setDirectory(docs.filter((u) => !u.suspended).map((u) => userFromDoc(u)))
        asRemote(() => useUIStore.getState().applyRemoteUsers(docs))
        useUIStore.getState().setLiveReady("users")
      },
      (err) => {
        warn("users listener stopped", err)
        useUIStore.getState().setLiveReady("users")
      }
    )
  )

  stops.push(listenArticles("published", query(collection(db, COL.articles), where("verificationStatus", "==", "published"))))

  // Per-user scope
  let scoped: Unsubscribe[] = []
  let scopeKey = ""
  const rescope = (s: State) => {
    const uid = s.authUid
    const admin = !!uid && s.authIsAdmin
    const panel = !!uid && !!s.currentUser && !!s.access[s.currentUser]?.isPanelMember
    const key = `${uid ?? ""}|${admin}|${panel}|${s.currentUser ?? ""}`
    if (key === scopeKey) return
    scopeKey = key
    scoped.forEach((u) => u())
    scoped = []
    for (const k of ["mine", "all", "panel"]) dropArticleSource(k)
    asRemote(() => {
      useUIStore.getState().applyRemoteApplications([])
      useUIStore.getState().applyRemoteNotifications([])
    })
    if (!uid) return

    const handle = s.currentUser ?? ""
    scoped.push(listenArticles("mine", query(collection(db, COL.articles), where("authorId", "==", uid))))
    if (admin) scoped.push(listenArticles("all", query(collection(db, COL.articles), limit(1000))))
    else if (panel) scoped.push(listenArticles("panel", query(collection(db, COL.articles), where("verificationStatus", "==", "pending_panel"))))

    const apps = admin ? collection(db, COL.applications) : query(collection(db, COL.applications), where("userId", "==", uid))
    scoped.push(
      onSnapshot(
        apps,
        (snap) => asRemote(() => useUIStore.getState().applyRemoteApplications(snap.docs.map((d) => applicationFromDoc(d.id, d.data())))),
        (err) => warn("panel_applications listener stopped", err)
      )
    )

    scoped.push(
      onSnapshot(
        query(collection(db, COL.notifications), where("recipientId", "==", uid), limit(100)),
        (snap) =>
          asRemote(() =>
            useUIStore
              .getState()
              .applyRemoteNotifications(
                snap.docs
                  .map((d) => notificationFromDoc(d.id, d.data(), handle))
                  .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
              )
          ),
        (err) => warn("notifications listener stopped", err)
      )
    )
  }

  rescope(useUIStore.getState())
  // An unreachable or missing database retries silently; stop showing "loading" after a while
  const readyFallback = setTimeout(() => {
    useUIStore.getState().setLiveReady("users")
    useUIStore.getState().setLiveReady("articles")
  }, 8000)

  const unsubStore = useUIStore.subscribe((s, prev) => {
    rescope(s)
    onStoreChange(s, prev)
  })

  const onHide = () => flushPendingWrites()
  window.addEventListener("pagehide", onHide)

  return () => {
    clearTimeout(readyFallback)
    flushPendingWrites()
    window.removeEventListener("pagehide", onHide)
    unsubStore()
    stops.forEach((u) => u())
    scoped.forEach((u) => u())
    articleSources.clear()
    scopeKey = ""
  }
}
