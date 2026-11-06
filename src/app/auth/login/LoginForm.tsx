"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check } from "lucide-react"
import { useUIStore } from "@/lib/store"
import { MOCK_USERS } from "@/lib/data"
import { spring } from "@/lib/motion"
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

type Status = "idle" | "sending" | "done"

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const target = safeRedirect(redirectTo, "/dashboard")
  const currentUser = useUIStore((s) => s.currentUser)
  const signIn = useUIStore((s) => s.signIn)
  const toast = useUIStore((s) => s.toast)
  const { hydrated, settled } = useSettled()

  const [email, setEmail] = useState("")
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<Status>("idle")
  const [provider, setProvider] = useState<Provider | null>(null)
  const [welcomeName, setWelcomeName] = useState("")
  const emailRef = useRef<HTMLInputElement>(null)

  const busy = status !== "idle"

  const finish = async (address: string) => {
    const username = signIn(address)
    const name = useUIStore.getState().profile.displayName
    const user = MOCK_USERS.find((u) => u.username === username)
    setWelcomeName(username === MOCK_USERS[0].username ? name : user?.displayName ?? username)
    setStatus("done")
    toast(`Signed in as @${username}`, { tone: "success" })
    await wait(700)
    router.push(target)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const value = email.trim()
    if (!value) {
      setError("Enter your email address.")
      emailRef.current?.focus()
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError("That doesn't look like an email address.")
      emailRef.current?.focus()
      return
    }
    setError(undefined)
    setStatus("sending")
    await wait(800)
    await finish(value)
  }

  const onProvider = async (p: Provider) => {
    if (busy) return
    setProvider(p)
    setStatus("sending")
    await wait(900)
    await finish(`${MOCK_USERS[0].username}@${p}.demo`)
  }

  // Signed in already (and not in the middle of our own sign-in)
  const view = hydrated && currentUser && status === "idle" ? "signed-in" : status === "done" ? "done" : "form"

  const content =
    view === "signed-in" && currentUser ? (
      <motion.div key="signed-in" {...swap}>
        <SignedInCard username={currentUser} continueHref={target} />
      </motion.div>
    ) : view === "done" ? (
      <motion.div key="done" {...swap} className="text-center py-6" aria-live="polite">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
          className="mx-auto w-14 h-14 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] grid place-items-center"
        >
          <Check className="w-7 h-7" strokeWidth={2.5} />
        </motion.div>
        <h1 className="display mt-5 text-[2rem]">Welcome back{welcomeName ? `, ${welcomeName.split(" ")[0]}` : ""}.</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">Taking you where you left off…</p>
      </motion.div>
    ) : (
      <motion.div key="form" {...swap}>
        <p className="meta">Sign in</p>
        <h1 className="display mt-3 text-[2.5rem] sm:text-[3rem]">Welcome back.</h1>
        <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
          Pick up your reading list, your drafts and the writers you follow.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
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
          <SubmitButton pending={status === "sending" && !provider} pendingLabel="Sending sign-in link…">
            Continue with email <ArrowRight className="w-4 h-4" />
          </SubmitButton>
        </form>

        <Divider label="or" />
        <OAuthButtons verb="Sign in" pending={provider} disabled={busy} onSelect={onProvider} />

        <p className="mt-8 text-sm text-[var(--fg-muted)]">
          New to Prism?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-[var(--fg)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--fg)] transition-colors"
          >
            Create an account
          </Link>
        </p>
        <p className="mt-3 text-xs text-[var(--fg-subtle)] leading-relaxed">
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

  // The swap caused by loading the saved session is instant; swaps the user causes animate
  return (
    <AuthShell aside={<Aside />}>
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

function Aside() {
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
