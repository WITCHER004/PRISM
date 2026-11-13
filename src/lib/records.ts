// Best-effort Firestore mirror for article records (craft certificates, peer dossiers).
// The source of truth stays local (the persisted store / seeded data), so the UI never waits on
// Firestore and an offline or misconfigured database only produces a console warning.

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
    warn(`Couldn't confirm ${collection}/${id} reached Firestore; the local copy is used.`, err)
  }
}
