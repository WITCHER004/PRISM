"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ShieldX } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { isAdminUser } from "@/lib/admin"
import { useUIStore } from "@/lib/store"

/**
 * /admin/login: Google sign-in, then a hard check of the verified email against ADMIN_EMAILS.
 * Whitelisted accounts go straight into the portal; anyone else is told no and can switch accounts.
 */
export function AdminLogin() {
  const router = useRouter()
  const { user, loading, signInWithGoogle, logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const authorized = isAdminUser(user)
  const adminSession = useUIStore((s) => s.adminSession)

  useEffect(() => {
    if (!authorized || !adminSession) return
    const next = new URLSearchParams(window.location.search).get("next")
    router.replace(next?.startsWith("/admin") && next !== "/admin/login" ? next : "/admin")
  }, [authorized, adminSession, router])

  const signIn = async () => {
    setBusy(true)
    setError("")
    try {
      await signInWithGoogle()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request")
        setError((err as Error).message || "Google sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  const switchAccount = async () => {
    setBusy(true)
    await logout().catch(() => {})
    setBusy(false)
    await signIn()
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" aria-hidden className="w-6 h-6">
            <path d="M16 3.5 L3.5 27.5 H19.5 Z" fill="currentColor" />
            <path d="M16 3.5 L28.5 27.5 H19.5 Z" fill="currentColor" fillOpacity="0.38" />
          </svg>
          <span className="font-display font-semibold tracking-[-0.03em] text-xl">prism</span>
          <span className="h-5 px-1.5 rounded-[6px] bg-white/[0.08] text-[10px] font-mono uppercase tracking-[0.14em] grid place-items-center text-[#A1A1AA]">
            Admin
          </span>
        </div>

        <h1 className="mt-10 font-display text-[1.75rem] font-semibold tracking-tight">Staff sign-in</h1>
        <p className="mt-2 text-sm text-[#A1A1AA] leading-relaxed">
          The admin portal is restricted to Prism&apos;s administrators. Sign in with your Google account to continue.
        </p>

        <div className="mt-8 space-y-3" aria-busy={loading}>
          {loading || (authorized && !adminSession) ? (
            <div className="h-24 rounded-[14px] bg-white/[0.04] animate-pulse" />
          ) : authorized ? (
            <p className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <Loader2 className="w-4 h-4 animate-spin" /> Opening the portal…
            </p>
          ) : user ? (
            <div className="p-4 rounded-[14px] border border-white/10 bg-white/[0.03]">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldX className="w-4 h-4 text-[#F87171]" />
                This account isn&apos;t authorized
              </p>
              <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
                {user.email ?? "This account"} isn&apos;t on the administrator list. Admin access can&apos;t be requested from the app.
              </p>
              <button
                type="button"
                onClick={switchAccount}
                disabled={busy}
                className="mt-3 inline-flex h-9 items-center gap-2 px-3.5 rounded-[10px] bg-white text-[#141413] text-sm font-medium hover:bg-[#EDEDEF] disabled:opacity-60"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Use a different Google account
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signIn}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-[14px] bg-white text-[#141413] text-sm font-semibold hover:bg-[#EDEDEF] transition-colors disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleMark />}
              Sign in with Google
            </button>
          )}
          {error && (
            <p role="alert" className="text-xs text-[#F87171]">
              {error}
            </p>
          )}
        </div>

        <Link href="/" className="mt-10 inline-block text-xs text-[#71717A] hover:text-[#D4D4D8]">
          ← Back to Prism
        </Link>
      </div>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  )
}
