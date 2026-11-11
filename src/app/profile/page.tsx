"use client"

import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { SignInGate } from "@/components/studio/SignInGate"
import { useHydrated } from "@/components/studio/useHydrated"
import { ProfileHub } from "@/components/profile/ProfileHub"
import { useUIStore } from "@/lib/store"

// The signed-in user's Profile Hub: identity, edit profile, author tracker, published articles
export default function MyProfilePage() {
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        {!hydrated ? (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-14" aria-busy="true" aria-label="Loading profile">
            <div className="h-56 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" />
          </div>
        ) : currentUser ? (
          <ProfileHub username={currentUser} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
            <SignInGate redirectTo="/profile" />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
