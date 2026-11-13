"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  auth,
  authPersistenceReady,
  getClientAnalytics,
  logOutFirebase,
  onAuthStateChanged,
  signInWithGoogle as firebaseSignInWithGoogle,
  type FirebaseUser,
} from "@/lib/firebase"
import { useUIStore } from "@/lib/store"

export type UserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  [key: string]: unknown
}

type AuthContextValue = {
  user: FirebaseUser | null
  userProfile: UserProfile | null
  /** True until Firebase reports the initial auth state */
  loading: boolean
  signInWithGoogle: () => Promise<FirebaseUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// console.warn, not console.error: in dev, Next.js turns console.error into a full-screen error overlay
const warn = (msg: string, err: unknown) =>
  console.warn(`[auth] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

/**
 * Fetch users/{uid}, creating it on first sign-in. Never throws: if Firestore is offline,
 * unreachable or denied, it falls back to the cached doc, then to a profile built from the Firebase user.
 */
/** Profile built from the auth user alone; the name falls back to the email prefix */
const profileFromAuth = (u: FirebaseUser): UserProfile => ({
  uid: u.uid,
  email: u.email,
  displayName: u.displayName || u.email?.split("@")[0] || null,
  photoURL: u.photoURL,
})

async function syncUserProfile(u: FirebaseUser): Promise<UserProfile> {
  const base = profileFromAuth(u)
  try {
    const [{ doc, getDoc, getDocFromCache, setDoc, serverTimestamp }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("@/lib/firestore"),
    ])
    const ref = doc(db, "users", u.uid)

    let snap
    try {
      snap = await getDoc(ref)
    } catch (err) {
      warn(`Firestore unreachable for users/${u.uid}; trying the local cache.`, err)
      try {
        snap = await getDocFromCache(ref)
      } catch {
        return base // nothing cached: carry on with the auth profile
      }
    }

    // Writes aren't awaited: offline they stay pending until the server acks, and sync once it's back
    const write = snap.exists()
      ? setDoc(ref, { ...base, lastLoginAt: serverTimestamp() }, { merge: true })
      : setDoc(ref, { ...base, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp() })
    write.catch((err) => warn(`Could not save users/${u.uid} (check Firestore rules).`, err))

    return snap.exists() ? { ...(snap.data() as UserProfile), ...base } : base
  } catch (err) {
    warn("Firestore profile sync skipped; using the Firebase auth profile.", err)
    return base
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClientAnalytics().catch(() => {})

    let unsubscribe: (() => void) | undefined
    let cancelled = false

    const subscribe = () => {
      if (cancelled || unsubscribe) return
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        // Update the UI first; the Firestore profile sync below must never block it
        setUser(firebaseUser)
        setLoading(false)
        useUIStore.getState().setFirebaseUser(
          firebaseUser
            ? {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
              }
            : null
        )

        if (!firebaseUser) {
          setUserProfile(null)
          const local = useUIStore.getState().currentUser
          if (local) {
            console.warn(
              `[auth] App session is @${local} but Firebase has no signed-in user. ` +
                "The app treats you as signed in; sign out and back in to restore the Firebase session."
            )
          }
          return
        }
        // Usable profile right away; replaced by the Firestore doc if it loads
        setUserProfile(profileFromAuth(firebaseUser))
        syncUserProfile(firebaseUser).then((profile) => {
          if (auth.currentUser?.uid === firebaseUser.uid) setUserProfile(profile)
        })
      })
    }

    // The persisted UI store is rehydrated after mount (ThemeProvider). Subscribe only after that,
    // so a stale localStorage session can't overwrite what Firebase reports.
    const unsubHydration = useUIStore.persist.onFinishHydration(() => {
      authPersistenceReady.then(subscribe)
    })
    if (useUIStore.persist.hasHydrated()) authPersistenceReady.then(subscribe)

    return () => {
      cancelled = true
      unsubHydration()
      unsubscribe?.()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const result = await firebaseSignInWithGoogle()
    return result?.user ?? null
  }, [])

  const logout = useCallback(async () => {
    useUIStore.getState().signOut()
    await logOutFirebase()
  }, [])

  const value = useMemo(
    () => ({ user, userProfile, loading, signInWithGoogle, logout }),
    [user, userProfile, loading, signInWithGoogle, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
