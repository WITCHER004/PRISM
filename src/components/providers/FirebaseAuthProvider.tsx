"use client"

import { useEffect } from "react"
import { auth, onAuthStateChanged, getClientAnalytics } from "@/lib/firebase"
import { useUIStore } from "@/lib/store"

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const setFirebaseUser = useUIStore((s) => s.setFirebaseUser)

  useEffect(() => {
    // Initialize Firebase Analytics on client
    getClientAnalytics().catch(() => {})

    // Listen to real Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        })
      } else {
        setFirebaseUser(null)
      }
    })

    return () => unsubscribe()
  }, [setFirebaseUser])

  return <>{children}</>
}
