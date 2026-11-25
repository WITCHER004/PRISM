"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  auth,
  authPersistenceReady,
  awaitLoginGate,
  getClientAnalytics,
  logOutFirebase,
  onAuthStateChanged,
  signInWithGoogle as firebaseSignInWithGoogle,
  type FirebaseUser,
} from "@/lib/firebase"
import { useUIStore } from "@/lib/store"
import { resolveAdminRole, type AdminRole } from "@/lib/admin"
import { handleFrom } from "@/lib/live/schema"
import { claimHandle, ensureHandleRegistered } from "@/lib/handles"

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
  /** The signed-in account is a Prism admin (asked of the server; UI only, the rules enforce it) */
  isAdmin: boolean
  /** True while the admin role of the signed-in user is still being checked */
  roleLoading: boolean
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

/**
 * Creates users/{uid} on first sign-in (uid, email, displayName, handle, photoURL, bio, tier,
 * isPanelMember, panelApplicationStatus, isAdmin, createdAt) and refreshes the login fields after.
 * Never throws: if Firestore is unreachable the session carries on with the auth profile.
 */
async function syncUserProfile(u: FirebaseUser, role: AdminRole): Promise<UserProfile> {
  const base = profileFromAuth(u)
  try {
    const [{ doc, getDoc, setDoc, serverTimestamp, deleteField }, { db }] = await Promise.all([import("firebase/firestore"), import("@/lib/firebase")])
    const ref = doc(db, "users", u.uid)
    const snap = await getDoc(ref)
    const admin = role.isAdmin
    // users/{uid} is world-readable, so the email lives in user_private/{uid} (owner + staff only)
    if (u.email)
      // Last sign-in time is private too (audit F-31): it shows when someone is active
      setDoc(doc(db, "user_private", u.uid), { email: u.email, lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch((err) =>
        warn(`Could not save user_private/${u.uid}.`, err)
      )

    if (!snap.exists()) {
      const fields = {
        uid: u.uid,
        displayName: base.displayName || handleFrom(u.displayName, u.email, u.uid),
        photoURL: u.photoURL,
        bio: "",
        tier: "free",
        isPanelMember: false,
        panelApplicationStatus: "none",
        isAdmin: admin,
        createdAt: serverTimestamp(),
      }
      // The profile and its handle-registry entry are written together (the rules require both)
      const handle = await claimHandle(u.uid, handleFrom(u.displayName, u.email, u.uid), { data: fields, merge: false })
      const created = { ...fields, handle }
      return { ...base, ...created, createdAt: undefined, lastLoginAt: undefined } as UserProfile
    }

    const existing = snap.data() as UserProfile & { handle?: string }
    // Older docs carried the email publicly: remove it on the next sign-in
    // isAdmin is rewritten only from a server answer; a fallback guess leaves the stored flag alone
    const patch: Record<string, unknown> = {
      ...(role.definitive ? { isAdmin: admin } : {}),
      // Older docs carried the email and last sign-in publicly: both now live in user_private
      ...("email" in existing ? { email: deleteField() } : {}),
      ...("lastLoginAt" in existing ? { lastLoginAt: deleteField() } : {}),
    }
    // Older docs may predate handles; the profile photo stays whatever the user last uploaded
    if (!existing.photoURL && u.photoURL) patch.photoURL = u.photoURL
    if (!existing.handle) {
      patch.handle = await claimHandle(u.uid, handleFrom(existing.displayName ?? u.displayName, u.email, u.uid), { data: patch, merge: true })
    } else {
      // Joined before the handle registry: register the handle they already use
      void ensureHandleRegistered(u.uid, existing.handle)
      setDoc(ref, patch, { merge: true }).catch((err) => warn(`Could not update users/${u.uid}.`, err))
    }
    return { ...base, ...existing, ...patch, email: u.email, lastLoginAt: undefined } as UserProfile
  } catch (err) {
    warn("Firestore profile sync skipped; using the Firebase auth profile.", err)
    return base
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  /** The resolved admin role and the uid it belongs to */
  const [role, setRole] = useState<{ uid: string; isAdmin: boolean } | null>(null)

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
          setRole(null)
          return
        }
        // Usable profile right away; replaced by the Firestore doc if it loads
        setUserProfile(profileFromAuth(firebaseUser))
        const uid = firebaseUser.uid
        const rolePromise = resolveAdminRole(firebaseUser)
        rolePromise.then(({ isAdmin }) => {
          if (auth.currentUser?.uid !== uid) return
          setRole({ uid, isAdmin })
          useUIStore.setState((s) =>
            s.authUid === uid ? { authIsAdmin: isAdmin, adminSession: isAdmin ? s.currentUser : null } : {}
          )
        })
        // The sign-in page may be about to delete a brand-new account: wait, then skip if it's gone
        awaitLoginGate().then(async () => {
          if (auth.currentUser?.uid !== firebaseUser.uid) return
          const adminRole = await rolePromise
          if (auth.currentUser?.uid !== firebaseUser.uid) return
          return syncUserProfile(firebaseUser, adminRole).then((profile) => {
            if (auth.currentUser?.uid === firebaseUser.uid) setUserProfile(profile)
          })
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

  const isAdmin = !!user && role?.uid === user.uid && role.isAdmin
  const roleLoading = loading || (!!user && role?.uid !== user.uid)

  const value = useMemo(
    () => ({ user, userProfile, loading, isAdmin, roleLoading, signInWithGoogle, logout, patchUserProfile }),
    [user, userProfile, loading, isAdmin, roleLoading, signInWithGoogle, logout, patchUserProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
