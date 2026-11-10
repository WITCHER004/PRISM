"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, Sparkles, BookOpen, RotateCcw, Eye, EyeOff } from "lucide-react"
import { useUIStore } from "@/lib/store"
import { MOCK_USERS, MOCK_TAGS } from "@/lib/data"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { signInWithGoogle, signInWithGithub, logInWithEmail, resetPassword, logOutFirebase } from "@/lib/firebase"
import {
  AuthShell,
  Divider,
  EMAIL_RE,
  Field,
  OAuthButtons,
  SignedInCard,
  SubmitButton,
  safeRedirect,
  swap,
  useSettled,
  wait,
  type Provider,
} from "../_components/AuthKit"

type Status = "idle" | "sending" | "categories" | "done"

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const target = safeRedirect(redirectTo, "/")
  const currentUser = useUIStore((s) => s.currentUser)
  const signIn = useUIStore((s) => s.signIn)
  const signOut = useUIStore((s) => s.signOut)
  const interestedTopics = useUIStore((s) => s.interestedTopics)
  const setInterestedTopics = useUIStore((s) => s.setInterestedTopics)
  const toast = useUIStore((s) => s.toast)
  const { hydrated, settled } = useSettled()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<Status>("idle")
  const [provider, setProvider] = useState<Provider | null>(null)
  const [welcomeName, setWelcomeName] = useState("")
  const [selectedTopics, setSelectedTopics] = useState<string[]>(interestedTopics || ["philosophy", "design"])
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const busy = status === "sending"

  const toggleTopic = (slug: string) => {
    setSelectedTopics((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    )
  }

  // After authentication credentials are submitted
  const handleAuthSuccess = async (address: string) => {
    const username = signIn(address)
    const name = useUIStore.getState().profile.displayName
    const user = MOCK_USERS.find((u) => u.username === username)
    setWelcomeName(username === MOCK_USERS[0].username ? name : user?.displayName ?? username)
    setStatus("categories")
  }

  const handleResetPassword = async () => {
    const value = email.trim()
    if (!value) {
      setError("Please enter your email above to receive password reset instructions.")
      emailRef.current?.focus()
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError("That doesn't look like a valid email address.")
      emailRef.current?.focus()
      return
    }
    setError(undefined)
    try {
      await resetPassword(value)
      setResetSent(true)
      toast("Password reset instructions sent to your email!", { tone: "success" })
    } catch (err: any) {
      console.warn("Password reset error:", err)
      setError(err?.message || "Failed to send reset email.")
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const emailVal = email.trim()
    if (!emailVal) {
      setError("Enter your email address.")
      emailRef.current?.focus()
      return
    }
    if (!EMAIL_RE.test(emailVal)) {
      setError("That doesn't look like an email address.")
      emailRef.current?.focus()
      return
    }

    setError(undefined)
    setStatus("sending")

    // If password provided, perform real Firebase Authentication
    if (password) {
      try {
        const res = await logInWithEmail(emailVal, password)
        if (res?.user) {
          const u = res.user
          const address = u.email || emailVal
          const name = u.displayName || address.split("@")[0]
          signIn(address, name)
          setWelcomeName(name)
          setStatus("categories")
          return
        }
      } catch (err: any) {
        console.warn("Firebase email sign-in error:", err)
        setStatus("idle")
        if (
          err?.code === "auth/invalid-credential" ||
          err?.code === "auth/wrong-password" ||
          err?.code === "auth/user-not-found"
        ) {
          setError("Incorrect email or password. Please verify your credentials or create an account.")
          passwordRef.current?.focus()
          return
        }
        if (err?.code === "auth/too-many-requests") {
          setError("Too many failed login attempts. Please reset your password or try again later.")
          return
        }
        if (err?.message) {
          setError(err.message)
          return
        }
      }
    }

    // Direct passwordless sign-in or demo sign-in
    await wait(600)
    await handleAuthSuccess(emailVal)
  }

  const onProvider = async (p: Provider) => {
    if (busy) return
    setProvider(p)
    setStatus("sending")
    setError(undefined)

    try {
      let result: any = null
      if (p === "google") {
        result = await signInWithGoogle()
      } else if (p === "github") {
        result = await signInWithGithub()
      }

      if (result?.user) {
        const u = result.user
        const address = u.email || `${u.uid}@${p}.firebase`
        const name = u.displayName || address.split("@")[0]
        signIn(address, name)
        setWelcomeName(name)
        setStatus("categories")
        return
      }
    } catch (err: any) {
      console.warn("Firebase OAuth sign-in:", err)
      if (err?.code === "auth/popup-closed-by-user") {
        setStatus("idle")
        setProvider(null)
        return
      }
      if (err?.code === "auth/unauthorized-domain") {
        setError("Firebase note: Ensure localhost is added to authorized domains in Firebase Console. Falling back to local demo.")
      }
      // Demo fallback
      await wait(600)
      await handleAuthSuccess(`${MOCK_USERS[0].username}@${p}.demo`)
      return
    }
  }

  // Complete category selection
  const finishCategories = async (saveChosen = true) => {
    if (saveChosen && selectedTopics.length > 0) {
      setInterestedTopics(selectedTopics)
    }
    setStatus("done")
    toast(`Welcome back! Your feed is tuned.`, { tone: "success" })
    await wait(1100)
    router.push(target)
  }

  // Signed in already view
  const view =
    hydrated && currentUser && status === "idle"
      ? "signed-in"
      : status === "categories"
      ? "categories"
      : status === "done"
      ? "done"
      : "form"

  const content =
    view === "signed-in" && currentUser ? (
      <motion.div key="signed-in" {...swap}>
        <SignedInCard username={currentUser} continueHref={target} />
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setStatus("categories")}
            className="w-full h-11 px-6 rounded-full bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] font-medium hover:bg-[var(--panel)] transition-colors inline-flex items-center justify-center gap-2 text-sm"
          >
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            Update interested categories
          </button>
        </div>
      </motion.div>
    ) : view === "categories" ? (
      /* Step 2: Select Interested Categories after Sign In */
      <motion.div key="categories-view" {...swap}>
        <div className="flex items-center justify-between">
          <p className="meta text-[var(--accent)]">Preferences · Feed Tuning</p>
          <button
            type="button"
            onClick={() => finishCategories(false)}
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-4 transition-colors"
          >
            Skip for now
          </button>
        </div>

        <h1 className="display mt-2 sm:mt-3 text-[1.875rem] xs:text-[2.125rem] sm:text-[2.5rem] md:text-[3rem] leading-[1.08] tracking-tight text-balance">
          Select interested categories.
        </h1>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed">
          Welcome back{welcomeName ? `, ${welcomeName.split(" ")[0]}` : ""}. Select the topics you want to explore today to personalize your reading feed.
        </p>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 gap-2 mt-5 sm:mt-6 max-h-[300px] overflow-y-auto pr-1">
          {MOCK_TAGS.map((tag) => {
            const isSelected = selectedTopics.includes(tag.slug)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTopic(tag.slug)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all flex items-center justify-between touch-manipulation",
                  isSelected
                    ? "border-[var(--fg)] bg-[var(--panel)] shadow-sm ring-1 ring-[var(--fg)]"
                    : "border-[var(--border)] bg-[var(--panel)]/70 hover:border-[var(--border-strong)]"
                )}
              >
                <div className="min-w-0 pr-1">
                  <span className="block text-xs sm:text-sm font-semibold truncate text-[var(--fg)]">
                    {tag.name}
                  </span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">
                    {tag.postCount} stories
                  </span>
                </div>
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-[var(--fg)] text-[var(--bg)]"
                      : "bg-[var(--surface)] text-transparent border border-[var(--border)]"
                  )}
                >
                  <Check className="w-3 h-3" />
                </span>
              </button>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => finishCategories(true)}
            className="w-full h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <span>
              {selectedTopics.length > 0
                ? `Continue with ${selectedTopics.length} selected ${
                    selectedTopics.length === 1 ? "category" : "categories"
                  }`
                : "Continue with all categories"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    ) : view === "done" ? (
      /* Success celebration */
      <motion.div key="done" {...swap} className="text-center py-6" aria-live="polite">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
          className="mx-auto w-14 h-14 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] grid place-items-center"
        >
          <Check className="w-7 h-7" strokeWidth={2.5} />
        </motion.div>
        <h1 className="display mt-5 text-[2rem]">
          Welcome back{welcomeName ? `, ${welcomeName.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Feed updated with your chosen topics. Taking you inside…
        </p>
      </motion.div>
    ) : (
      /* Normal Sign-In Form */
      <motion.div key="form" {...swap}>
        {/* Active Session Notice if logged in */}
        {hydrated && currentUser && (
          <div className="mb-4 sm:mb-6 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--fg-muted)] truncate min-w-0">
              Active as <strong className="text-[var(--fg)]">@{currentUser}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                signOut()
                logOutFirebase().catch(() => {})
                toast("Signed out")
              }}
              className="shrink-0 inline-flex items-center gap-1 font-medium text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors py-1 px-2 rounded-lg hover:bg-[var(--panel)] touch-manipulation"
            >
              <RotateCcw className="w-3 h-3" />
              Sign out
            </button>
          </div>
        )}

        <p className="meta">Sign in</p>
        <h1 className="display mt-2 sm:mt-3 text-[1.875rem] xs:text-[2.125rem] sm:text-[2.5rem] md:text-[3rem] leading-[1.08] tracking-tight text-balance">
          Welcome back.
        </h1>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed">
          Pick up your reading list, your drafts and the writers you follow.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-5 sm:mt-8 space-y-3.5 sm:space-y-4">
          <Field
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            error={error}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(undefined)
            }}
          />

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <label htmlFor="login-pass" className="text-sm font-medium text-[var(--fg)]">
                Password
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors underline-offset-2 hover:underline touch-manipulation"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] inline-flex items-center gap-1 transition-colors py-0.5 touch-manipulation"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <input
              ref={passwordRef}
              id="login-pass"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              disabled={busy}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(undefined)
              }}
              className={cn(
                "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border text-base sm:text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none transition-colors focus:border-[var(--fg)] disabled:opacity-60",
                error
                  ? "border-[var(--error)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              )}
            />
            {resetSent && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
                ✓ Password reset email sent. Please check your spam or inbox folder.
              </p>
            )}
          </div>

          <SubmitButton pending={status === "sending" && !provider} pendingLabel="Signing in…">
            Sign in with email <ArrowRight className="w-4 h-4" />
          </SubmitButton>
        </form>

        <Divider label="or" />
        <OAuthButtons verb="Sign in" pending={provider} disabled={busy} onSelect={onProvider} />

        <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-[var(--fg-muted)] text-center sm:text-left">
          New to Prism?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--fg)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--fg)] transition-colors"
          >
            Create an account
          </Link>
        </p>
        <p className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs text-[var(--fg-subtle)] leading-relaxed text-center sm:text-left">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    )

  return (
    <AuthShell aside={<Aside status={status} selectedCount={selectedTopics.length} />}>
      {settled ? (
        <AnimatePresence mode="wait" initial={false}>
          {content}
        </AnimatePresence>
      ) : (
        content
      )}
    </AuthShell>
  )
}

function Aside({ status, selectedCount }: { status: Status; selectedCount: number }) {
  if (status === "categories") {
    return (
      <>
        <p className="font-mono text-xs uppercase tracking-wider opacity-60">Personalized Feed</p>
        <div>
          <blockquote className="display text-[2.25rem] xl:text-[2.75rem] leading-[1.04]">
            A quiet feed,
            <br />
            <span className="spectrum-text">shaped by curiosity.</span>
            <br />
            Zero algorithms.
          </blockquote>

          <div className="mt-6 p-5 rounded-[20px] bg-[var(--bg)]/10 backdrop-blur-md border border-white/10 text-[var(--bg)] space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="opacity-75">Spectrum Preference</span>
              <span className="text-emerald-300 font-semibold">{selectedCount} Selected</span>
            </div>
            <div className="h-2 rounded-full spectrum-bg opacity-90" />
            <p className="text-xs opacity-80 leading-relaxed font-serif">
              Stories matching your selected categories will appear at the top of today&apos;s spectrum when you enter.
            </p>
          </div>
        </div>
        <p className="font-mono text-xs uppercase tracking-wider opacity-50">
          Read only what expands your mind
        </p>
      </>
    )
  }

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-wider opacity-60">Prism</p>
      <div>
        <blockquote className="display text-[2.5rem] xl:text-[3rem] leading-[1.02]">
          Read slowly.
          <br />
          <span className="spectrum-text">Pay attention.</span>
          <br />
          Pay writers.
        </blockquote>
        <p className="mt-6 max-w-sm opacity-70 leading-relaxed">
          Your membership follows your attention: the writers you actually spend time with are the ones who get paid.
        </p>
      </div>
      <p className="font-mono text-xs uppercase tracking-wider opacity-50">Independent writing · Read by humans</p>
    </>
  )
}
