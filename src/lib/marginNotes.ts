// Margin Notes & Social Quote Cards Services and Types
// Stored in Firestore collection `margin_notes` with local storage mirroring `prism-margin-notes:v1`

export interface MarginNote {
  id: string
  articleId: string
  paragraphIndex: number
  selectedText: string
  noteText: string
  authorUsername: string
  authorDisplayName: string
  authorAvatar?: string
  createdAt: number
}

const LOCAL_NOTES_KEY = "prism-margin-notes:v1"

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function loadLocalMarginNotes(articleId: string): MarginNote[] {
  const all = readJSON<Record<string, MarginNote[]>>(LOCAL_NOTES_KEY, {})
  return all[articleId] ?? []
}

export function saveLocalMarginNote(note: MarginNote) {
  const all = readJSON<Record<string, MarginNote[]>>(LOCAL_NOTES_KEY, {})
  const current = all[note.articleId] ?? []
  all[note.articleId] = [note, ...current]
  writeJSON(LOCAL_NOTES_KEY, all)
}

export function deleteLocalMarginNote(articleId: string, noteId: string) {
  const all = readJSON<Record<string, MarginNote[]>>(LOCAL_NOTES_KEY, {})
  const current = all[articleId] ?? []
  all[articleId] = current.filter((n) => n.id !== noteId)
  writeJSON(LOCAL_NOTES_KEY, all)
}

/* ── Remote Firestore Integration (Best effort / offline resilient) ───────── */

const NOTES_COLLECTION = "margin_notes"

export async function fetchRemoteMarginNotes(articleId: string): Promise<MarginNote[]> {
  try {
    const [{ collection, query, where, orderBy, getDocs }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("@/lib/firestore"),
    ])
    const q = query(
      collection(db, NOTES_COLLECTION),
      where("articleId", "==", articleId),
      orderBy("createdAt", "desc")
    )
    const snap = await Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 4000)),
    ])
    return snap.docs.map((d) => ({ ...(d.data() as MarginNote), id: d.id }))
  } catch {
    return []
  }
}

export async function saveRemoteMarginNote(note: MarginNote) {
  try {
    const [{ doc, setDoc }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("@/lib/firestore"),
    ])
    await Promise.race([
      setDoc(doc(db, NOTES_COLLECTION, note.id), note),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 4000)),
    ])
  } catch {}
}

export async function deleteRemoteMarginNote(noteId: string) {
  try {
    const [{ doc, deleteDoc }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("@/lib/firestore"),
    ])
    await Promise.race([
      deleteDoc(doc(db, NOTES_COLLECTION, noteId)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 4000)),
    ])
  } catch {}
}

