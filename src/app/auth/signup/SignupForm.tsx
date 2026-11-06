"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, PenLine, X } from "lucide-react"
import { useUIStore, type Plan } from "@/lib/store"
import { MOCK_USERS } from "@/lib/data"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import {
  AuthShell,
  Divider,
  EMAIL_RE,
  Field,
  OAuthButtons,
  SignedInCard,
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

type Status = "idle" | "creating" | "done"
type Errors = { name?: string; email?: string }

export function SignupForm({ initialWriter, initialPlan }: { initialWriter: boolean; initialPlan: Plan | null }) {
  const router = useRouter()
  const currentUser = useUIStore((s) => s.currentUser)
  const signIn = useUIStore((s) => s.signIn)
  const toast = useUIStore((s) => s.toast)
  const { hydrated, settled } = useSettled()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [writer, setWriter] = useState(initialWriter)
  const [plan, setPlanChoice] = useState<Plan | null>(initialPlan)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>("idle")
  const [provider, setProvider] = useState<Provider | null>(null)
  const [firstName, setFirstName] = useState("")
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const busy = status !== "idle"
  const destination = writer ? "/editor/new" : plan ? `/membership?plan=${plan}` : "/"
  const destinationLabel = writer ? "Opening the editor…" : plan ? "Taking you to checkout…" : "Taking you to your feed…"

  const finish = async (address: string, displayName?: string) => {
    const username = signIn(address, displayName)
    const shown = displayName || useUIStore.getState().profile.displayName
    setFirstName(shown.split(" ")[0])
    setStatus("done")
    toast(writer ? "Account created. Your first story awaits." : `Welcome to Prism, @${username}`, { tone: "success" })
    await wait(900)
    router.push(destination)
  }

  const validate = (): Errors => {
    const next: Errors = {}
    const n = name.trim()
    if (!n) next.name = "Tell us what to call you."
    else if (n.length < 2) next.name = "Use at least 2 characters."
    else if (n.length > 50) next.name = "Keep it under 50 characters."
    const e = email.trim()
    if (!e) next.email = "Enter your email address."
    else if (!EMAIL_RE.test(e)) next.email = "That doesn't look like an email address."
    return next
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const next = validate()
    setErrors(next)
    if (next.name) return nameRef.current?.focus()
    if (next.email) return emailRef.current?.focus()
    setStatus("creating")
    await wait(900)
    await finish(email.trim(), name.trim())
  }

  const onProvider = async (p: Provider) => {
    if (busy) return
    setProvider(p)
    setStatus("creating")
    await wait(900)
    await finish(`${MOCK_USERS[0].username}@${p}.demo`)
  }

  const view = hydrated && currentUser && status === "idle" ? "signed-in" : status === "done" ? "done" : "form"

  const content =
    view === "signed-in" && currentUser ? (
      <motion.div key="signed-in" {...swap}>
        <SignedInCard
          username={currentUser}
          continueHref={writer ? "/editor/new" : plan ? `/membership?plan=${plan}` : "/"}
          note="Want a separate account? Sign out first, then create a new one here."
        />
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
        <h1 className="display mt-5 text-[2rem]">You&apos;re in{firstName ? `, ${firstName}` : ""}.</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">{destinationLabel}</p>
      </motion.div>
    ) : (
      <motion.div key="form" {...swap}>
        <p className="meta">{writer ? "Start publishing" : "Join Prism"}</p>
        <h1 className="display mt-3 text-[2.5rem] sm:text-[3rem]">
          {writer ? "Your publication starts here." : "Create your account."}
        </h1>
        <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
          Free to read and free to write. Upgrade only if you want to fund the writers you love.
        </p>

        {/* Plan carried over from /membership */}
        <AnimatePresence initial={false}>
          {plan && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: dur.fast, ease: ease.in } }}
              className="mt-6 flex items-center gap-3 rounded-[16px] bg-[var(--accent-subtle)] pl-4 pr-1.5 py-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              <p className="flex-1 text-sm">
                <span className="font-medium">{PLAN_LABEL[plan].name} membership</span>
                <span className="text-[var(--fg-muted)]"> · {PLAN_LABEL[plan].price}, confirm after signup</span>
              </p>
              <button
                type="button"
                onClick={() => setPlanChoice(null)}
                aria-label="Remove membership selection"
                className="grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <Field
            ref={nameRef}
            label="Name"
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

          {/* Writer toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={writer}
            onClick={() => setWriter((w) => !w)}
            disabled={busy}
            className={cn(
              "w-full flex items-center gap-3 p-3 pr-4 rounded-[16px] border text-left transition-colors",
              writer
                ? "border-[var(--fg)] bg-[var(--panel)]"
                : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]"
            )}
          >
            <span
              className={cn(
                "grid place-items-center w-10 h-10 rounded-full shrink-0 transition-colors",
                writer ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--surface)] text-[var(--fg-muted)]"
              )}
            >
              <PenLine className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">I want to write</span>
              <span className="block text-xs text-[var(--fg-muted)]">We&apos;ll open the editor right after signup.</span>
            </span>
            <Switch on={writer} />
          </button>

          <SubmitButton pending={status === "creating" && !provider} pendingLabel="Creating your account…">
            Create account <ArrowRight className="w-4 h-4" />
          </SubmitButton>
        </form>

        <Divider label="or" />
        <OAuthButtons verb="Sign up" pending={provider} disabled={busy} onSelect={onProvider} />

        <p className="mt-8 text-sm text-[var(--fg-muted)]">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-[var(--fg)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--fg)] transition-colors"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-xs text-[var(--fg-subtle)] leading-relaxed">
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
    <AuthShell aside={<Aside writer={writer} />}>
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

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200",
        on ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--panel)] shadow-[var(--shadow)] transition-transform duration-200 ease-out",
          on && "translate-x-5"
        )}
      />
    </span>
  )
}

const READER_PERKS = [
  "Follow writers and build a reading list",
  "Clap, highlight and respond to stories",
  "Read in light, dark or sepia, or listen aloud",
]
const WRITER_PERKS = [
  "A clean editor with polls, charts and code blocks",
  "Your own domain and a portable subscriber list",
  "Earnings from real reading time, plus direct tips",
]

function Aside({ writer }: { writer: boolean }) {
  const perks = writer ? WRITER_PERKS : READER_PERKS
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-wider opacity-60">{writer ? "For writers" : "For readers"}</p>
      <div>
        <h2 className="display text-[2.5rem] xl:text-[3rem] leading-[1.02]">
          {writer ? (
            <>
              Your readers.
              <br />
              <span className="spectrum-text">Your domain.</span>
              <br />
              Your rules.
            </>
          ) : (
            <>
              One beam of curiosity,
              <br />
              <span className="spectrum-text">every topic worth it.</span>
            </>
          )}
        </h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={writer ? "w" : "r"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            className="mt-8 space-y-3"
          >
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 opacity-80">
                <Check className="w-4 h-4 mt-1 shrink-0" />
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
      <p className="font-mono text-xs uppercase tracking-wider opacity-50">Built for writers · Owned by writers</p>
    </>
  )
}
