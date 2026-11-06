"use client"

import { forwardRef, useEffect, useId, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, Loader2, LogOut, AlertCircle, FlaskConical } from "lucide-react"
import { useUIStore } from "@/lib/store"
import { MOCK_USERS } from "@/lib/data"
import { Wordmark } from "@/components/ui/Wordmark"
import { Avatar } from "@/components/ui/Avatar"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Shared pieces for /auth/login and /auth/signup (demo auth runs entirely on the client store)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Only same-site relative paths ("/x", never "//evil.com" or "https://…") */
export function safeRedirect(path: string | undefined | null, fallback: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback
  return path
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** True once the persisted store has loaded from localStorage */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useUIStore.persist.onFinishHydration(cb),
    () => useUIStore.persist.hasHydrated(),
    () => false
  )
}

/**
 * True one frame after hydration. Used to skip animating the swap that hydration itself causes
 * (e.g. form -> "already signed in"), while still animating every swap the user triggers.
 */
export function useSettled() {
  const hydrated = useHydrated()
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!hydrated) return
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [hydrated])
  return { hydrated, settled }
}

export const swap = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
  exit: { opacity: 0, y: -6, transition: { duration: dur.fast, ease: ease.in } },
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

export function AuthShell({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-3 p-3">
        {/* Form side */}
        <div className="flex flex-col px-3 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Wordmark />
            <Link
              href="/"
              className="inline-flex items-center h-10 px-4 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              Back to reading
            </Link>
          </div>
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="w-full max-w-[400px]">{children}</div>
          </div>
          <DemoNote />
        </div>

        {/* Visual side */}
        <aside className="hidden lg:flex relative overflow-hidden rounded-[28px] bg-[var(--fg)] text-[var(--bg)]">
          <div className="absolute inset-x-0 top-0 h-1.5 spectrum-bg" />
          <div aria-hidden className="absolute -right-24 -bottom-24 w-[420px] h-[420px] rounded-full spectrum-bg opacity-25 blur-3xl" />
          <div className="relative flex flex-col justify-between p-12 w-full">{aside}</div>
        </aside>
      </div>
    </div>
  )
}

function DemoNote() {
  return (
    <p className="mx-auto flex items-start gap-2 max-w-[400px] text-xs leading-relaxed text-[var(--fg-muted)]">
      <FlaskConical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--accent)]" />
      <span>
        <span className="font-medium text-[var(--fg-secondary)]">Demo mode.</span> No emails are sent and no
        accounts are created on a server: signing in here simply starts a session in this browser.
      </span>
    </p>
  )
}

/* ── Form controls ──────────────────────────────────────────────────────── */

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...props },
  ref
) {
  const auto = useId()
  const inputId = id ?? auto
  const msgId = `${inputId}-msg`
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--fg)]">
          {label}
        </label>
        {hint && !error && <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>}
      </div>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? msgId : undefined}
        className={cn(
          "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none transition-colors focus:border-[var(--fg)] disabled:opacity-60",
          error ? "border-[var(--error)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
        )}
        {...props}
      />
      <motion.div
        initial={false}
        animate={{ height: error ? "auto" : 0, opacity: error ? 1 : 0 }}
        transition={{ duration: dur.fast, ease: ease.out }}
        className="overflow-hidden"
      >
        <p id={msgId} role={error ? "alert" : undefined} className="flex items-center gap-1.5 pt-1.5 text-xs text-[var(--error)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      </motion.div>
    </div>
  )
})

export function SubmitButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="relative w-full h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] active:scale-[0.98] transition-[background-color,transform] disabled:cursor-wait inline-flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export type Provider = "google" | "github"

export function OAuthButtons({
  verb,
  pending,
  disabled,
  onSelect,
}: {
  verb: string
  pending: Provider | null
  disabled: boolean
  onSelect: (p: Provider) => void
}) {
  const providers: { id: Provider; label: string; icon: React.ReactNode }[] = [
    { id: "google", label: "Google", icon: <GoogleIcon /> },
    { id: "github", label: "GitHub", icon: <GitHubIcon /> },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          disabled={disabled}
          aria-label={`${verb} with ${p.label}`}
          className="h-11 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--panel)] border border-[var(--border-strong)] text-sm font-medium text-[var(--fg)] hover:border-[var(--fg)] active:scale-[0.98] transition-[border-color,transform] disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : p.icon}
          {p.label}
        </button>
      ))}
    </div>
  )
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-[var(--border)]" />
      <span className="meta">{label}</span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  )
}

/** Shown instead of the form when a session already exists */
export function SignedInCard({ username, continueHref, note }: { username: string; continueHref: string; note?: string }) {
  const signOut = useUIStore((s) => s.signOut)
  const toast = useUIStore((s) => s.toast)
  const displayName = useUIStore((s) => s.profile.displayName)
  const user = MOCK_USERS.find((u) => u.username === username)
  const name = username === MOCK_USERS[0].username ? displayName : user?.displayName ?? username

  return (
    <div>
      <p className="meta">Session active</p>
      <h1 className="display mt-3 text-[2.25rem] sm:text-[2.75rem]">You&apos;re already in.</h1>
      <div className="mt-6 panel p-4 flex items-center gap-3 shadow-[var(--shadow)]">
        <Avatar src={user?.avatarUrl} alt={name} size="md" />
        <div className="min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-sm text-[var(--fg-muted)] truncate">@{username}</p>
        </div>
      </div>
      {note && <p className="mt-4 text-sm text-[var(--fg-muted)] leading-relaxed">{note}</p>}
      <div className="mt-6 grid gap-2">
        <Link
          href={continueHref}
          className="h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors inline-flex items-center justify-center gap-2"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </Link>
        <button
          type="button"
          onClick={() => {
            signOut()
            toast("Signed out")
          }}
          className="h-11 px-6 rounded-full bg-[var(--panel)] border border-[var(--border-strong)] font-medium hover:border-[var(--fg)] transition-colors inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )
}

/* ── Provider marks (monochrome so they sit in every theme) ─────────────── */

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.67 3.71 14.54 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}
