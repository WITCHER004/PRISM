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
import { isAdminUser } from "@/lib/admin"
import { handleFrom } from "@/lib/live/schema"

export type UserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  /** Role fields (see src/lib/access.ts); mirrored to Firestore users/{uid} */
  tier?: "free" | "elite"
  isPanelMember?: boolean
  panelApplicationStatus?: "none" | "pending" | "approved" | "rejected"
  isAdmin?: boolean
  suspended?: boolean
  [key: string]: unknown
}

type AuthContextValue = {
  user: FirebaseUser | null
  userProfile: UserProfile | null
  /** True until Firebase reports the initial auth state */
  loading: boolean
  signInWithGoogle: () => Promise<FirebaseUser | null>
  logout: () => Promise<void>
  /** Update the in-memory profile right away (role changes); persisting is the caller's job */
  patchUserProfile: (patch: Partial<UserProfile>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// console.warn, not console.error: in dev, Next.js turns console.error into a full-screen error overlay
const warn = (msg: string, err: unknown) =>
  console.warn(`[auth] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

/** Profile built from the auth user alone; the name falls back to the email prefix */
const profileFromAuth = (u: FirebaseUser): UserProfile => ({
  uid: u.uid,
  email: u.email,
  displayName: u.displayName || u.email?.split("@")[0] || null,
  photoURL: u.photoURL,
})

/** A handle nobody else has claimed: the name-derived base, then base2, base3… */
async function claimHandle(base: string, uid: string): Promise<string> {
  const [{ collection, getDocs, query, where }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 17)}${n}`
    const taken = await getDocs(query(collection(db, "users"), where("handle", "==", candidate)))
    if (taken.docs.every((d) => d.id === uid)) return candidate
  }
  return `${base.slice(0, 12)}${uid.slice(0, 8).toLowerCase()}`
}

/**
 * Creates users/{uid} on first sign-in (uid, email, displayName, handle, photoURL, bio, tier,
 * isPanelMember, panelApplicationStatus, isAdmin, createdAt) and refreshes the login fields after.
 * Never throws: if Firestore is unreachable the session carries on with the auth profile.
 */
async function syncUserProfile(u: FirebaseUser): Promise<UserProfile> {
  const base = profileFromAuth(u)
  try {
    const [{ doc, getDoc, setDoc, serverTimestamp }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
    const ref = doc(db, "users", u.uid)
    const snap = await getDoc(ref)
    const admin = isAdminUser(u)

    if (!snap.exists()) {
      const handle = await claimHandle(handleFrom(u.displayName, u.email, u.uid), u.uid)
      const created = {
        uid: u.uid,
        email: u.email,
        displayName: base.displayName || handle,
        handle,
        photoURL: u.photoURL,
        bio: "",
        tier: "free",
        isPanelMember: false,
        panelApplicationStatus: "none",
        isAdmin: admin,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      }
      await setDoc(ref, created)
      return { ...base, ...created, createdAt: undefined, lastLoginAt: undefined } as UserProfile
    }

    const existing = snap.data() as UserProfile & { handle?: string }
    const patch: Record<string, unknown> = { email: u.email, isAdmin: admin, lastLoginAt: serverTimestamp() }
    // Older docs may predate handles; the profile photo stays whatever the user last uploaded
    if (!existing.handle) patch.handle = await claimHandle(handleFrom(existing.displayName ?? u.displayName, u.email, u.uid), u.uid)
    if (!existing.photoURL && u.photoURL) patch.photoURL = u.photoURL
    setDoc(ref, patch, { merge: true }).catch((err) => warn(`Could not update users/${u.uid}.`, err))
    return { ...base, ...existing, ...patch, lastLoginAt: undefined } as UserProfile
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
                emailVerified: firebaseUser.emailVerified,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
              }
            : null
        )

        if (!firebaseUser) {
          setUserProfile(null)
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

  const patchUserProfile = useCallback((patch: Partial<UserProfile>) => {
    setUserProfile((p) => (p ? { ...p, ...patch } : p))
  }, [])

  const value = useMemo(
    () => ({ user, userProfile, loading, signInWithGoogle, logout, patchUserProfile }),
    [user, userProfile, loading, signInWithGoogle, logout, patchUserProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
