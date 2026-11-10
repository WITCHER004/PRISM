"use client"

import { useEffect } from "react"
import { auth, onAuthStateChanged, getClientAnalytics } from "@/lib/firebase"
import { useUIStore } from "@/lib/store"

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useUIStore((s) => s.currentUser)
  const signIn = useUIStore((s) => s.signIn)
  const updateProfile = useUIStore((s) => s.updateProfile)

  useEffect(() => {
    // Initialize Firebase Analytics on client
    getClientAnalytics().catch(() => {})

    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || `${firebaseUser.uid}@firebase.user`
        const displayName = firebaseUser.displayName || email.split("@")[0]

        if (!currentUser) {
          signIn(email, displayName)
        }
        if (firebaseUser.displayName) {
          updateProfile({ displayName: firebaseUser.displayName })
        }
      }
    })

    return () => unsubscribe()
  }, [currentUser, signIn, updateProfile])

  return <>{children}</>
}

