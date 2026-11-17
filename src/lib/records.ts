// Standalone copies of an article's earned records (craft certificates, peer dossiers), written by the
// author's client. Both are derived from articles/{id}, which stays the source of truth.

const TIMEOUT_MS = 8000
// One write per record per page load is plenty
const written = new Set<string>()

const warn = (msg: string, err: unknown) =>
  console.warn(`[records] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))])
}

// Firestore rejects undefined values anywhere in the document
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export type RecordCollection = "craft_certificates" | "peer_dossiers"

/** Merge-write a record; never throws */
export async function mirrorRecord(collection: RecordCollection, id: string, data: object) {
  const key = `${collection}/${id}:${JSON.stringify(data).length}`
  if (typeof window === "undefined" || written.has(key)) return
  written.add(key)
  try {
    const [{ doc, setDoc, serverTimestamp }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firestore")])
    await withTimeout(setDoc(doc(db, collection, id), { ...clean(data), updatedAt: serverTimestamp() }, { merge: true }))
  } catch (err) {
    written.delete(key)
    warn(`Couldn't save ${collection}/${id}.`, err)
  }
}
