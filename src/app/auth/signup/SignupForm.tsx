"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRight,
  Check,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  AtSign,
  User,
  FileText,
  Compass,
} from "lucide-react"
import { useUIStore, type Plan } from "@/lib/store"
import { MOCK_USERS } from "@/lib/data"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/Avatar"
import {
  AuthShell,
  Divider,
  EMAIL_RE,
  Field,
  OAuthButtons,
  SubmitButton,
  swap,
  useSettled,
  wait,
  type Provider,
} from "../_components/AuthKit"

const PLAN_LABEL: Record<Plan, { name: string; price: string }> = {
  reader: { name: "Reader", price: "$8/mo" },
  patron: { name: "Patron", price: "$20/mo" },
}

const UNIFIED_PERKS = [
  "Ad-free reading with typography tuned for focus and audio listen mode",
  "A personal library to save bookmarks, highlight text, and discuss stories",
  "A minimalist editor with code blocks, rich media, and polls to write whenever you like",
  "Your own byline and subscriber list that you 100% own",
]

const POPULAR_TOPICS = [
  "Essays",
  "Philosophy",
  "Design Systems",
  "Technology",
  "Climate",
  "Architecture",
]

type Step = "credentials" | "profile"
type Status = "idle" | "creating" | "done"
type Errors = { name?: string; email?: string; password?: string; username?: string }

export function SignupForm({
  initialWriter = false,
  initialPlan = null,
}: {
  initialWriter?: boolean
  initialPlan?: Plan | null
}) {
  const router = useRouter()
  const currentUser = useUIStore((s) => s.currentUser)
  const signIn = useUIStore((s) => s.signIn)
  const signOut = useUIStore((s) => s.signOut)
  const setCurrentUser = useUIStore((s) => s.setCurrentUser)
  const updateProfile = useUIStore((s) => s.updateProfile)
  const toast = useUIStore((s) => s.toast)
  const { hydrated, settled } = useSettled()

  // Step 1: Credentials
  const [step, setStep] = useState<Step>("credentials")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [plan, setPlanChoice] = useState<Plan | null>(initialPlan)

  // Step 2: Profile & Stage Name
  const [stageName, setStageName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])

  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>("idle")
  const [provider, setProvider] = useState<Provider | null>(null)
  const [finalIdentity, setFinalIdentity] = useState({ name: "", handle: "" })

  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)

  const busy = status !== "idle"
  const destination = initialWriter ? "/editor/new" : plan ? `/membership?plan=${plan}` : "/"
  const destinationLabel = initialWriter
    ? "Opening your editor…"
    : plan
    ? "Taking you to membership checkout…"
    : "Taking you to your reading feed…"

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  // Validate Step 1
  const validateCredentials = (): Errors => {
    const next: Errors = {}
    const n = name.trim()
    if (!n) next.name = "Tell us what to call you."
    else if (n.length < 2) next.name = "Use at least 2 characters."
    else if (n.length > 50) next.name = "Keep it under 50 characters."

    const e = email.trim()
    if (!e) next.email = "Enter your email address."
    else if (!EMAIL_RE.test(e)) next.email = "That doesn't look like an email address."

    if (password && password.length < 6) {
      next.password = "Password must be at least 6 characters."
    }

    return next
  }

  // Validate Step 2
  const validateProfile = (): Errors => {
    const next: Errors = {}
    const u = username.trim().toLowerCase().replace(/^@/, "")
    if (!u) next.username = "Choose a username."
    else if (u.length < 3) next.username = "Username must be at least 3 characters."
    else if (!/^[a-z0-9_]+$/.test(u)) next.username = "Only lowercase letters, numbers, and underscores."
    return next
  }

  // Move from Step 1 -> Step 2
  const handleProceedToProfile = (enteredName: string, enteredEmail: string) => {
    const cleanName = enteredName.trim()
    const rawHandle =
      cleanName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) ||
      enteredEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) ||
      "reader"

    setStageName(cleanName)
    setUsername(rawHandle)
    setStep("profile")
  }

  const onSubmitCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const next = validateCredentials()
    setErrors(next)
    if (next.name) return nameRef.current?.focus()
    if (next.email) return emailRef.current?.focus()
    if (next.password) return passwordRef.current?.focus()

    handleProceedToProfile(name, email)
  }

  const onProvider = async (p: Provider) => {
    if (busy) return
    setProvider(p)
    setStatus("creating")
    await wait(700)
    setStatus("idle")
    const defaultName = p === "google" ? "Google User" : "GitHub Dev"
    const defaultEmail = `${p}.user@example.com`
    setName(defaultName)
    setEmail(defaultEmail)
    handleProceedToProfile(defaultName, defaultEmail)
  }

  // Complete Step 2 and Finish Registration
  const finishRegistration = async (useDefaults = false) => {
    if (busy) return
    if (!useDefaults) {
      const next = validateProfile()
      if (Object.keys(next).length > 0) {
        setErrors(next)
        usernameRef.current?.focus()
        return
      }
    }

    const finalDisplayName = (useDefaults ? stageName : stageName.trim()) || name.trim() || "Member"
    const finalHandle = (useDefaults ? username : username.trim().toLowerCase().replace(/^@/, "")) || "member"
    const finalBio = bio.trim()

    setStatus("creating")
    await wait(800)

    // Register user in store
    signIn(email || `${finalHandle}@prism.pub`, finalDisplayName)
    setCurrentUser(finalHandle)
    updateProfile({
      displayName: finalDisplayName,
      bio: finalBio,
    })

    setFinalIdentity({ name: finalDisplayName, handle: finalHandle })
    setStatus("done")
    toast(`Welcome to Prism, @${finalHandle}!`, { tone: "success" })
    await wait(1200)
    router.push(destination)
  }

  const content =
    status === "done" ? (
      /* Celebration View */
      <motion.div key="done" {...swap} className="text-center py-6" aria-live="polite">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
          className="mx-auto w-14 h-14 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] grid place-items-center"
        >
          <Check className="w-7 h-7" strokeWidth={2.5} />
        </motion.div>
        <h1 className="display mt-5 text-[2rem]">
          You&apos;re all set, {finalIdentity.name.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Profile created as <strong className="text-[var(--fg)]">@{finalIdentity.handle}</strong>. {destinationLabel}
        </p>
      </motion.div>
    ) : step === "profile" ? (
      /* Step 2: Build Your Profile & Select Stage Name */
      <motion.div key="profile-step" {...swap}>
        <div className="flex items-center justify-between">
          <p className="meta text-[var(--accent)]">Step 2 of 2 · Identity</p>
          <button
            type="button"
            onClick={() => finishRegistration(true)}
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-4 transition-colors"
          >
            Skip for now
          </button>
        </div>

        <h1 className="display mt-2 sm:mt-3 text-[1.875rem] xs:text-[2.125rem] sm:text-[2.5rem] md:text-[3rem] leading-[1.08] tracking-tight text-balance">
          Build your profile.
        </h1>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed">
          Set your stage name and handle. This is how you appear on your byline, bookmarks, and responses.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            finishRegistration(false)
          }}
          noValidate
          className="mt-5 sm:mt-7 space-y-3.5 sm:space-y-4"
        >
          {/* Stage Name / Display Name */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-[var(--fg)] mb-1.5">
              Stage name / Display name
            </label>
            <input
              type="text"
              value={stageName}
              placeholder="e.g. Ada Lovelace or The Midnight Essayist"
              onChange={(e) => setStageName(e.target.value)}
              className="w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border border-[var(--border)] text-base sm:text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:border-[var(--fg)] hover:border-[var(--border-strong)] transition-colors"
            />
          </div>

          {/* Username / Handle */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-[var(--fg)] mb-1.5">
              Username <span className="text-xs text-[var(--fg-muted)]">(@handle)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--fg-muted)] font-mono">
                @
              </span>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                placeholder="username"
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  if (errors.username) setErrors((x) => ({ ...x, username: undefined }))
                }}
                className={cn(
                  "w-full h-11 pl-8 pr-4 rounded-[12px] bg-[var(--panel)] border text-base sm:text-sm text-[var(--fg)] font-mono placeholder:text-[var(--fg-subtle)] outline-none transition-colors",
                  errors.username
                    ? "border-[var(--error)] focus:border-[var(--error)]"
                    : "border-[var(--border)] focus:border-[var(--fg)] hover:border-[var(--border-strong)]"
                )}
              />
            </div>
            {errors.username ? (
              <p className="text-xs text-[var(--error)] mt-1.5">{errors.username}</p>
            ) : (
              <p className="text-[11px] text-[var(--fg-muted)] mt-1 font-mono">
                Your profile URL: prism.pub/@{username || "yourhandle"}
              </p>
            )}
          </div>

          {/* Short Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs sm:text-sm font-medium text-[var(--fg)]">
                Short bio <span className="text-xs font-normal text-[var(--fg-subtle)]">(optional)</span>
              </label>
              <span className="text-[11px] text-[var(--fg-muted)] font-mono">{bio.length}/160</span>
            </div>
            <textarea
              rows={2}
              maxLength={160}
              value={bio}
              placeholder="What do you read, write, or think about?"
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 rounded-[12px] bg-[var(--panel)] border border-[var(--border)] text-base sm:text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:border-[var(--fg)] hover:border-[var(--border-strong)] transition-colors resize-none"
            />
          </div>

          {/* Topics of Interest */}
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-2">
              Topics you enjoy (tailors your reading feed):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic)
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={cn(
                      "h-7 px-2.5 rounded-full text-xs transition-all flex items-center gap-1 touch-manipulation",
                      isSelected
                        ? "bg-[var(--fg)] text-[var(--bg)] font-medium scale-[1.02]"
                        : "bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {topic}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pt-2">
            <SubmitButton pending={status === "creating"} pendingLabel="Saving profile…">
              Enter Prism <ArrowRight className="w-4 h-4" />
            </SubmitButton>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setStep("credentials")}
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            ← Back to account details
          </button>
        </div>
      </motion.div>
    ) : (
      /* Step 1: Account Credentials */
      <motion.div key="credentials-step" {...swap}>
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
                toast("Signed out")
              }}
              className="shrink-0 inline-flex items-center gap-1 font-medium text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors py-1 px-2 rounded-lg hover:bg-[var(--panel)] touch-manipulation"
            >
              <RotateCcw className="w-3 h-3" />
              Sign out
            </button>
          </div>
        )}

        <p className="meta">Step 1 of 2 · Sign up</p>
        <h1 className="display mt-2 sm:mt-3 text-[1.875rem] xs:text-[2.125rem] sm:text-[2.5rem] md:text-[3rem] leading-[1.08] tracking-tight text-balance">
          Create your account.
        </h1>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed">
          One account to read, write, and discuss. Free forever, with no algorithms between you and good words.
        </p>

        {/* Plan carried over from /membership if present */}
        <AnimatePresence initial={false}>
          {plan && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: dur.fast, ease: ease.in } }}
              className="mt-4 sm:mt-5 flex items-center gap-3 rounded-[16px] bg-[var(--accent-subtle)] pl-3.5 sm:pl-4 pr-1.5 py-1.5 text-xs sm:text-sm"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
              <p className="flex-1 min-w-0 truncate">
                <span className="font-medium">{PLAN_LABEL[plan].name} membership</span>
                <span className="text-[var(--fg-muted)]"> · {PLAN_LABEL[plan].price}</span>
              </p>
              <button
                type="button"
                onClick={() => setPlanChoice(null)}
                aria-label="Remove membership selection"
                className="grid place-items-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors shrink-0 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={onSubmitCredentials} noValidate className="mt-5 sm:mt-7 space-y-3.5 sm:space-y-4">
          <Field
            ref={nameRef}
            label="Full name"
            name="name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            disabled={busy}
            error={errors.name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
            }}
          />

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
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
            }}
          />

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <label htmlFor="signup-pass" className="text-sm font-medium text-[var(--fg)]">
                Password <span className="text-xs font-normal text-[var(--fg-subtle)]">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] inline-flex items-center gap-1 transition-colors py-1 px-1.5 -mr-1.5 touch-manipulation"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              ref={passwordRef}
              id="signup-pass"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              placeholder="Create a password, or leave blank for magic link"
              value={password}
              disabled={busy}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
              }}
              className={cn(
                "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border text-base sm:text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none transition-colors focus:border-[var(--fg)] disabled:opacity-60",
                errors.password
                  ? "border-[var(--error)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              )}
            />
            {errors.password && (
              <p className="text-xs text-[var(--error)] mt-1.5">{errors.password}</p>
            )}
          </div>

          <SubmitButton pending={false} pendingLabel="Continuing…">
            Continue to Profile <ArrowRight className="w-4 h-4" />
          </SubmitButton>
        </form>

        <Divider label="or" />
        <OAuthButtons verb="Sign up" pending={provider} disabled={busy} onSelect={onProvider} />

        <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-[var(--fg-muted)] text-center sm:text-left">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--fg)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--fg)] transition-colors"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs text-[var(--fg-subtle)] leading-relaxed text-center sm:text-left">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Terms
          </Link>
          ,{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/content-policy" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Content Policy
          </Link>
          .
        </p>
      </motion.div>
    )

  return (
    <AuthShell aside={<Aside step={step} stageName={stageName} username={username} bio={bio} />}>
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

function Aside({
  step,
  stageName,
  username,
  bio,
}: {
  step: Step
  stageName: string
  username: string
  bio: string
}) {
  if (step === "profile") {
    const displayName = stageName.trim() || "Your Name"
    const displayHandle = username.trim() || "handle"

    return (
      <>
        <p className="font-mono text-xs uppercase tracking-wider opacity-60">Your Byline & Identity</p>

        <div>
          <blockquote className="display text-[2.25rem] xl:text-[2.75rem] leading-[1.04]">
            Your voice.
            <br />
            <span className="spectrum-text">Your byline.</span>
            <br />
            Your sanctuary.
          </blockquote>

          {/* Live Profile Card Preview */}
          <div className="mt-7 p-5 rounded-[20px] bg-[var(--bg)]/10 backdrop-blur-md border border-white/10 text-[var(--bg)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-display font-bold text-lg text-white shrink-0">
                {displayName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "✦"}
              </div>
              <div className="min-w-0">
                <p className="font-display font-semibold text-lg truncate leading-tight text-white">
                  {displayName}
                </p>
                <p className="text-xs font-mono opacity-70 truncate">@{displayHandle}</p>
              </div>
            </div>

            <p className="text-xs opacity-80 leading-relaxed font-serif line-clamp-2">
              {bio.trim() || "Curious reader and writer sharing thoughts on Prism."}
            </p>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono opacity-75">
              <span>prism.pub/@{displayHandle}</span>
              <span className="text-emerald-300">✓ Verified Profile</span>
            </div>
          </div>
        </div>

        <p className="font-mono text-xs uppercase tracking-wider opacity-50">
          You can refine your profile anytime in Settings
        </p>
      </>
    )
  }

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-wider opacity-60">Prism</p>

      <div>
        <blockquote className="display text-[2.5rem] xl:text-[3rem] leading-[1.02]">
          Read deeply.
          <br />
          <span className="spectrum-text">Write freely.</span>
          <br />
          Own your audience.
        </blockquote>

        <p className="mt-6 max-w-sm opacity-70 leading-relaxed">
          One account gives you complete access: follow thoughtful thinkers, build a quiet personal library, and publish your own writing whenever inspiration strikes.
        </p>

        {/* Structured Perks List */}
        <ul className="mt-8 space-y-3">
          {UNIFIED_PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3 opacity-80 text-sm">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-white" />
              <span className="leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-xs uppercase tracking-wider opacity-50">
        Built for readers & writers · Human-first publishing
      </p>
    </>
  )
}
