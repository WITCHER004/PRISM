"use client"

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  Loader2,
  LogOut,
  Moon,
  Sun,
  Type,
  User,
  UserRound,
  Volume2,
  Glasses,
  Mail,
  MessageCircle,
  Shield,
} from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Avatar } from "@/components/ui/Avatar"
import { useUIStore, type Profile } from "@/lib/store"
import { MOCK_USERS } from "@/lib/data"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { Dialog } from "@/app/membership/_components/Dialog"
import { AvatarUploader } from "@/components/profile/AvatarUploader"
import { cleanProfileFields, profileFieldErrors } from "@/components/profile/EditProfileDialog"
import { SOCIALS } from "@/lib/social"

/* ── Helpers ──────────────────────────────────────────────────────────── */

function useHydrated() {
  return useSyncExternalStore(
    (cb) => useUIStore.persist.onFinishHydration(cb),
    () => useUIStore.persist.hasHydrated(),
    () => false
  )
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "reading", label: "Reading", icon: BookOpen },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: Shield },
] as const
type TabId = (typeof TABS)[number]["id"]
const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v)

const panelMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
  exit: { opacity: 0, y: -6, transition: { duration: dur.fast, ease: ease.in } },
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function SettingsClient() {
  const [tab, setTab] = useState<TabId>("profile")
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // The URL hash (#reading, #account…) selects a tab, so tabs can be linked to and survive reloads
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1)
      if (isTab(h)) setTab(h)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  const select = (id: TabId) => {
    setTab(id)
    history.replaceState(null, "", `#${id}`)
  }

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    let next: number | null = null
    if (e.key in keys) next = (i + keys[e.key] + TABS.length) % TABS.length
    if (e.key === "Home") next = 0
    if (e.key === "End") next = TABS.length - 1
    if (next === null) return
    e.preventDefault()
    select(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <p className="meta">Settings</p>
          <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem]">Make Prism yours.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--fg-muted)]">
            Your profile, how stories look and sound, and what we email you. Changes are saved in this browser.
          </p>

          <div className="mt-10 grid md:grid-cols-[200px_minmax(0,1fr)] gap-6 md:gap-10 items-start">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Settings sections"
              aria-orientation="vertical"
              className="md:sticky md:top-24 flex md:flex-col gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0"
            >
              {TABS.map((t, i) => {
                const active = tab === t.id
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      tabRefs.current[i] = el
                    }}
                    id={`tab-${t.id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => select(t.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    className={cn(
                      "relative shrink-0 flex items-center gap-2.5 h-11 px-4 rounded-full text-sm font-medium transition-colors",
                      active ? "text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-tab"
                        className="absolute inset-0 rounded-full bg-[var(--fg)]"
                        transition={spring.snappy}
                      />
                    )}
                    <Icon className="relative w-4 h-4" />
                    <span className="relative">{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Panels */}
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  id={`panel-${tab}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${tab}`}
                  tabIndex={-1}
                  className="outline-none"
                  {...panelMotion}
                >
                  {tab === "profile" && <ProfilePanel />}
                  {tab === "reading" && <ReadingPanel />}
                  {tab === "notifications" && <NotificationsPanel />}
                  {tab === "account" && <AccountPanel />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ── Building blocks ──────────────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
  aside,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("panel p-5 sm:p-7", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-[var(--fg-muted)] leading-relaxed">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function AutoSaved() {
  return (
    <span className="meta shrink-0 inline-flex items-center gap-1.5 mt-1.5">
      <Check className="w-3 h-3" /> Saves automatically
    </span>
  )
}

function SwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  const id = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onClick={onChange}
      className="w-full flex items-center gap-4 py-4 text-left group rounded-[12px]"
    >
      <span
        className={cn(
          "grid place-items-center w-10 h-10 rounded-full shrink-0 transition-colors duration-200",
          checked ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "bg-[var(--surface)] text-[var(--fg-muted)]"
        )}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span id={`${id}-t`} className="block font-medium">
          {title}
        </span>
        <span id={`${id}-d`} className="block text-sm text-[var(--fg-muted)] leading-relaxed">
          {description}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200",
          checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)] group-hover:bg-[var(--fg-subtle)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--panel)] shadow-[var(--shadow)] transition-transform duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  )
}

function SignInPrompt({ what }: { what: string }) {
  return (
    <div className="panel p-8 sm:p-10 text-center">
      <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
        <User className="w-5 h-5" />
      </span>
      <h2 className="display mt-4 text-[1.75rem]">Sign in to manage {what}.</h2>
      <p className="mt-2 text-sm text-[var(--fg-muted)] max-w-sm mx-auto leading-relaxed">
        Reading preferences work without an account. Everything else belongs to your profile.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/auth/login?redirectTo=/settings"
          className="h-11 px-6 inline-flex items-center gap-2 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors"
        >
          Sign in <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/auth/signup"
          className="h-11 px-6 inline-flex items-center rounded-full bg-[var(--panel)] border border-[var(--border-strong)] font-medium hover:border-[var(--fg)] transition-colors"
        >
          Create account
        </Link>
      </div>
    </div>
  )
}

function useSession() {
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  return { hydrated, currentUser, signedOut: hydrated && !currentUser }
}

/* ── Profile ──────────────────────────────────────────────────────────── */

type ProfileFields = Pick<
  Profile,
  "displayName" | "bio" | "websiteUrl" | "twitterHandle" | "linkedinHandle" | "instagramHandle" | "githubHandle" | "avatarUrl"
>
const BIO_MAX = 200 // fits every sample bio (longest is 175), still short enough to read as a bio

const profileErrors = (d: ProfileFields): Partial<Record<keyof ProfileFields, string>> => profileFieldErrors(d)

function ProfilePanel() {
  const { hydrated, currentUser, signedOut } = useSession()
  if (signedOut) return <SignInPrompt what="your profile" />
  // Remount once saved data has loaded so the form starts from it
  return <ProfileForm key={hydrated ? "ready" : "init"} username={currentUser} />
}

function ProfileForm({ username }: { username: string | null }) {
  const profile = useUIStore((s) => s.profile)
  const updateProfile = useUIStore((s) => s.updateProfile)
  const toast = useUIStore((s) => s.toast)

  const saved: ProfileFields = {
    displayName: profile.displayName,
    bio: profile.bio,
    websiteUrl: profile.websiteUrl,
    twitterHandle: profile.twitterHandle,
    linkedinHandle: profile.linkedinHandle,
    instagramHandle: profile.instagramHandle,
    githubHandle: profile.githubHandle,
    avatarUrl: profile.avatarUrl,
  }
  const [draft, setDraft] = useState<ProfileFields>(saved)
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [attempted, setAttempted] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const dirty = (Object.keys(saved) as (keyof ProfileFields)[]).some((k) => draft[k] !== saved[k])
  const errors = profileErrors(draft)
  const hasErrors = Object.keys(errors).length > 0
  // Show a field's error once it has content worth judging, or after a save attempt
  const shown = (k: keyof ProfileFields) => (attempted || draft[k].trim() || k === "displayName" ? errors[k] : undefined)

  const set = (k: keyof ProfileFields) => (v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    if (status === "saved") setStatus("idle")
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (!dirty || hasErrors || status === "saving") return
    setStatus("saving")
    await wait(700)
    const clean: ProfileFields = cleanProfileFields(draft)
    updateProfile(clean)
    setDraft(clean)
    setStatus("saved")
    setAttempted(false)
    toast("Profile saved", { tone: "success", action: username ? { label: "View", href: "/profile" } : undefined })
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setStatus("idle"), 2200)
  }

  const user = MOCK_USERS.find((u) => u.username === username)
  const name = draft.displayName.trim() || "Your name"

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Section title="Public profile" description="This is how you appear on your stories, responses and profile page.">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_240px] gap-8">
          <div className="space-y-5">
            <AvatarUploader
              value={draft.avatarUrl}
              fallbackSrc={MOCK_USERS.find((u) => u.username === username)?.avatarUrl}
              name={draft.displayName || "You"}
              onChange={(url) => {
                setDraft((d) => ({ ...d, avatarUrl: url }))
                if (status === "saved") setStatus("idle")
              }}
            />
            <TextField
              label="Display name"
              value={draft.displayName}
              onChange={set("displayName")}
              error={shown("displayName")}
              autoComplete="name"
              maxLength={60}
            />
            <TextAreaField
              label="Bio"
              value={draft.bio}
              onChange={set("bio")}
              error={shown("bio")}
              max={BIO_MAX}
              placeholder="A sentence or two about what you write and read."
            />
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                label="Website"
                value={draft.websiteUrl}
                onChange={set("websiteUrl")}
                error={shown("websiteUrl")}
                placeholder="yourname.com"
                inputMode="url"
                autoComplete="url"
                hint="Optional"
              />
              {(["linkedinHandle", "instagramHandle", "twitterHandle", "githubHandle"] as const).map((k) => (
                <TextField
                  key={k}
                  label={SOCIALS[k].label}
                  value={draft[k]}
                  onChange={set(k)}
                  error={shown(k)}
                  placeholder={SOCIALS[k].placeholder}
                  prefix={SOCIALS[k].prefix}
                  hint="Optional"
                />
              ))}
            </div>
            <p className="text-xs text-[var(--fg-muted)]">Your handles are added to the share text when you share your articles.</p>
          </div>

          {/* Live preview */}
          <div>
            <p className="meta mb-2">Preview</p>
            <div className="rounded-[16px] bg-[var(--bg)] border border-[var(--border)] p-5">
              <Avatar src={draft.avatarUrl || user?.avatarUrl} alt={name} size="lg" />
              <p className="mt-4 font-display text-lg font-semibold tracking-tight leading-tight break-words">{name}</p>
              {username && <p className="text-sm text-[var(--fg-muted)]">@{username}</p>}
              <p className="mt-3 text-sm text-[var(--fg-secondary)] leading-relaxed break-words">
                {draft.bio.trim() || <span className="text-[var(--fg-subtle)]">No bio yet.</span>}
              </p>
              {(draft.websiteUrl.trim() || draft.twitterHandle.trim()) && (
                <div className="mt-3 space-y-1 text-xs text-[var(--fg-muted)] break-all">
                  {draft.websiteUrl.trim() && <p>{draft.websiteUrl.trim().replace(/^https?:\/\//, "")}</p>}
                  {draft.twitterHandle.trim() && <p>@{draft.twitterHandle.trim().replace(/^@/, "")}</p>}
                </div>
              )}
            </div>
            {username && (
              <Link
                href="/profile"
                className="mt-2 inline-flex items-center gap-1 h-10 px-3 -ml-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
              >
                View your profile <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </Section>

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AnimatePresence initial={false}>
          {dirty && status !== "saving" && (
            <motion.button
              key="discard"
              type="button"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0, transition: { duration: dur.base, ease: ease.out } }}
              exit={{ opacity: 0, x: 4, transition: { duration: dur.fast, ease: ease.in } }}
              onClick={() => {
                setDraft(saved)
                setAttempted(false)
              }}
              className="h-11 px-5 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              Discard changes
            </motion.button>
          )}
        </AnimatePresence>
        <button
          type="submit"
          disabled={(!dirty || hasErrors) && status !== "saved"}
          aria-disabled={!dirty || hasErrors || status !== "idle"}
          aria-live="polite"
          className={cn(
            "h-11 min-w-[148px] px-6 rounded-full font-medium inline-flex items-center justify-center gap-2 transition-[background-color,color,opacity,transform] active:scale-[0.98]",
            status === "saved"
              ? "bg-[var(--accent-subtle)] text-[var(--accent)] cursor-default"
              : "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.fast, ease: ease.out } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: ease.in } }}
              className="inline-flex items-center gap-2"
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : status === "saved" ? (
                <>
                  <Check className="w-4 h-4" /> Saved
                </>
              ) : (
                "Save changes"
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </form>
  )
}

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  counter,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  counter?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {counter ?? (hint && <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>)}
      </div>
      {children}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          error ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <p id={`${id}-err`} className="overflow-hidden text-xs text-[var(--error)]">
          <span className="block pt-1.5">{error}</span>
        </p>
      </div>
    </div>
  )
}

const inputClass = (error?: string) =>
  cn(
    "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none transition-colors focus:border-[var(--fg)]",
    error ? "border-[var(--error)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
  )

function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  prefix,
  ...rest
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
  prefix?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] pointer-events-none">{prefix}</span>
        )}
        <input
          id={id}
          value={prefix ? value.replace(/^@/, "") : value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(inputClass(error), prefix && "pl-8")}
          // Longer prefixes ("github.com/") need more room than "@"
          style={prefix && prefix.length > 1 ? { paddingLeft: `calc(1rem + ${prefix.length}ch)` } : undefined}
          {...rest}
        />
      </div>
    </FieldShell>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  error,
  max,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  max: number
  placeholder?: string
}) {
  const id = useId()
  const left = max - value.length
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      counter={
        <span
          className={cn(
            "font-mono text-xs tabular-nums transition-colors",
            left < 0 ? "text-[var(--error)]" : left < 20 ? "text-[var(--warning)]" : "text-[var(--fg-subtle)]"
          )}
          aria-live="polite"
        >
          {left}
        </span>
      }
    >
      <textarea
        id={id}
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(inputClass(error), "h-auto py-3 resize-none leading-relaxed")}
      />
    </FieldShell>
  )
}

/* ── Reading ──────────────────────────────────────────────────────────── */

const THEMES = [
  { value: "light", label: "Light", desc: "Bright canvas, white pages", icon: Sun },
  { value: "dark", label: "Dark", desc: "Easy on the eyes at night", icon: Moon },
  { value: "sepia", label: "Sepia", desc: "Warm, like an old paperback", icon: BookOpen },
] as const

const SIZES = [
  { value: "sm", label: "Small", px: "text-[0.8rem]" },
  { value: "md", label: "Default", px: "text-[0.95rem]" },
  { value: "lg", label: "Large", px: "text-[1.1rem]" },
  { value: "xl", label: "Extra large", px: "text-[1.25rem]" },
] as const

function ReadingPanel() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const fontSize = useUIStore((s) => s.fontSize)
  const setFontSize = useUIStore((s) => s.setFontSize)
  const focusMode = useUIStore((s) => s.focusMode)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)
  const ttsEnabled = useUIStore((s) => s.ttsEnabled)
  const toggleTTS = useUIStore((s) => s.toggleTTS)
  const group = useId()

  // The new theme spreads out from the option that was chosen (same effect as the header switch)
  const switchTheme = (value: (typeof THEMES)[number]["value"], origin: HTMLElement) => {
    const apply = () => {
      document.documentElement.setAttribute("data-theme", value)
      setTheme(value)
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduce || value === theme) return apply()
    const r = origin.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty("--vt-x", `${r.left + r.width / 2}px`)
    root.style.setProperty("--vt-y", `${r.top + r.height / 2}px`)
    document.startViewTransition(apply)
  }

  return (
    <div className="space-y-4">
      <Section title="Appearance" description="Applies across Prism right away." aside={<AutoSaved />}>
        <fieldset>
          <legend className="text-sm font-medium mb-3">Theme</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon
              const active = theme === t.value
              return (
                <label
                  key={t.value}
                  className={cn(
                    "relative flex sm:flex-col items-center sm:items-start gap-3 p-4 rounded-[16px] border cursor-pointer transition-[border-color,background-color] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]",
                    active ? "border-[var(--fg)] bg-[var(--bg)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <input
                    type="radio"
                    name={`${group}-theme`}
                    value={t.value}
                    checked={active}
                    onChange={(e) => switchTheme(t.value, e.currentTarget.parentElement ?? e.currentTarget)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "grid place-items-center w-10 h-10 rounded-full transition-colors",
                      active ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--surface)] text-[var(--fg-muted)]"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-sm">{t.label}</span>
                    <span className="block text-xs text-[var(--fg-muted)]">{t.desc}</span>
                  </span>
                  {active && (
                    <motion.span
                      layoutId={`${group}-theme-check`}
                      transition={spring.snappy}
                      className="sm:absolute sm:top-3 sm:right-3 grid place-items-center w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-sm font-medium mb-3 flex items-center gap-2">
            <Type className="w-4 h-4 text-[var(--fg-muted)]" /> Story text size
          </legend>
          <div className="grid grid-cols-4 p-1 rounded-full bg-[var(--surface)]">
            {SIZES.map((s) => {
              const active = fontSize === s.value
              return (
                <label
                  key={s.value}
                  className="relative h-11 flex items-center justify-center gap-1.5 rounded-full cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]"
                >
                  <input
                    type="radio"
                    name={`${group}-size`}
                    value={s.value}
                    checked={active}
                    onChange={() => setFontSize(s.value)}
                    className="sr-only"
                  />
                  {active && (
                    <motion.span
                      layoutId={`${group}-size-pill`}
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-full bg-[var(--panel)] shadow-[var(--shadow)]"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn("relative font-serif font-semibold leading-none", s.px, active ? "text-[var(--fg)]" : "text-[var(--fg-muted)]")}
                  >
                    Aa
                  </span>
                  <span className={cn("relative hidden sm:inline text-xs", active ? "text-[var(--fg)] font-medium" : "text-[var(--fg-muted)]")}>
                    {s.label}
                  </span>
                  <span className="sr-only sm:hidden">{s.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </Section>

      <Section title="While reading" description="How stories behave once you open one." aside={<AutoSaved />}>
        <div className="divide-y divide-[var(--border)] -my-4">
          <SwitchRow
            icon={Glasses}
            title="Focus mode"
            description="Fades the header and side rails away so only the story remains."
            checked={focusMode}
            onChange={toggleFocusMode}
          />
          <SwitchRow
            icon={Volume2}
            title="Read aloud"
            description="Shows a Listen button on stories so you can hear them read to you."
            checked={ttsEnabled}
            onChange={toggleTTS}
          />
        </div>
      </Section>

      <ReadingPreview focusMode={focusMode} tts={ttsEnabled} />
    </div>
  )
}

function ReadingPreview({ focusMode, tts }: { focusMode: boolean; tts: boolean }) {
  return (
    <section aria-label="Preview of your reading settings" className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 pt-5">
        <p className="meta">Live preview</p>
        <p className="meta text-[var(--fg-subtle)]">Updates as you change settings</p>
      </div>
      <div className="m-3 sm:m-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
        {/* Mock site header: fades out in focus mode */}
        <div
          className={cn(
            "flex items-center gap-3 h-11 px-4 border-b border-[var(--border)] transition-opacity duration-300",
            focusMode ? "opacity-0" : "opacity-100"
          )}
          aria-hidden
        >
          <span className="w-2.5 h-2.5 rounded-full spectrum-bg" />
          <span className="h-2 w-14 rounded-full bg-[var(--surface-hover)]" />
          <span className="h-2 w-10 rounded-full bg-[var(--surface)]" />
          <span className="ml-auto h-6 w-6 rounded-full bg-[var(--surface)]" />
        </div>
        <div className="px-5 sm:px-8 py-7">
          <div className="flex items-center justify-between gap-3">
            <p className="meta">Essay · 6 min read</p>
            <AnimatePresence initial={false}>
              {tts && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: dur.fast, ease: ease.in } }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--fg)] text-[var(--bg)] text-xs font-medium"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Listen
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <h3 className="display mt-3 text-[1.75rem] sm:text-[2rem]">The quiet economics of attention</h3>
          <div className="prose-prism mt-5">
            <p>
              Every hour you spend reading is a small vote. On most of the web, that vote is counted by whoever kept you
              scrolling longest.
            </p>
            <p className="!mb-0">
              Prism counts it differently: the writers who earn your time are the ones who get paid, and nothing here is
              built to keep you from closing the tab.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Notifications ────────────────────────────────────────────────────── */

function NotificationsPanel() {
  const { signedOut } = useSession()
  const profile = useUIStore((s) => s.profile)
  const updateProfile = useUIStore((s) => s.updateProfile)
  const toast = useUIStore((s) => s.toast)
  if (signedOut) return <SignInPrompt what="notifications" />

  const flip = (key: "emailDigest" | "emailReplies", label: string) => {
    const next = !profile[key]
    updateProfile({ [key]: next })
    toast(`${label} ${next ? "turned on" : "turned off"}`)
  }

  return (
    <div className="space-y-4">
      <Section title="Email" description="Choose what lands in your inbox." aside={<AutoSaved />}>
        <div className="divide-y divide-[var(--border)] -my-4">
          <SwitchRow
            icon={Mail}
            title="Weekly digest"
            description="One email on Sunday with the best stories from writers you follow."
            checked={profile.emailDigest}
            onChange={() => flip("emailDigest", "Weekly digest")}
          />
          <SwitchRow
            icon={MessageCircle}
            title="Responses to your stories"
            description="An email when someone responds to something you wrote."
            checked={profile.emailReplies}
            onChange={() => flip("emailReplies", "Response emails")}
          />
        </div>
      </Section>
      <p className="px-1 text-xs text-[var(--fg-muted)] leading-relaxed">
        In-app notifications (the bell in the header) are always on. This is a demo, so no email is actually sent.
      </p>
    </div>
  )
}

/* ── Account ──────────────────────────────────────────────────────────── */

const PLAN_NAME = { reader: "Reader", patron: "Patron" } as const

function AccountPanel() {
  const router = useRouter()
  const { currentUser, signedOut } = useSession()
  const plan = useUIStore((s) => s.plan)
  const displayName = useUIStore((s) => s.profile.displayName)
  const signOut = useUIStore((s) => s.signOut)
  const toast = useUIStore((s) => s.toast)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const titleId = useId()

  if (signedOut) return <SignInPrompt what="your account" />
  const user = MOCK_USERS.find((u) => u.username === currentUser)

  const doSignOut = () => {
    signOut()
    toast("Signed out. See you soon.")
    router.push("/")
  }

  const reset = async () => {
    setResetting(true)
    await wait(600)
    // Back to the store's first-run state (persist then saves that over the old data)
    const { toasts: _t, ...initial } = useUIStore.getInitialState()
    useUIStore.setState(initial)
    document.documentElement.setAttribute("data-theme", initial.theme)
    setResetting(false)
    setDeleteOpen(false)
    toast("Demo data reset", { tone: "success" })
    router.push("/")
  }

  return (
    <div className="space-y-4">
      <Section title="Session">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={user?.avatarUrl} alt={displayName} size="lg" />
          <div className="flex-1 min-w-[160px]">
            <p className="font-medium">{displayName}</p>
            <p className="text-sm text-[var(--fg-muted)]">@{currentUser}</p>
          </div>
          <button
            type="button"
            onClick={doSignOut}
            className="h-11 px-5 inline-flex items-center gap-2 rounded-full bg-[var(--panel)] border border-[var(--border-strong)] font-medium hover:border-[var(--fg)] transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </Section>

      <Section title="Membership">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="font-medium">{plan ? `${PLAN_NAME[plan]} member` : "Free plan"}</p>
            <p className="text-sm text-[var(--fg-muted)]">
              {plan ? `$${plan === "reader" ? 8 : 20}/month · simulated billing` : "Upgrade to read every member story."}
            </p>
          </div>
          <Link
            href="/membership"
            className="h-11 px-5 inline-flex items-center gap-2 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors"
          >
            {plan ? "Manage plan" : "See plans"} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Section>

      <section className="rounded-[var(--radius-card)] border border-[var(--error)]/40 bg-[var(--panel)] p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--error)]">Delete account</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)] leading-relaxed max-w-lg">
          Permanently remove your profile, stories, responses and reading history.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-5 h-11 px-5 rounded-full border border-[var(--error)]/50 text-[var(--error)] font-medium hover:bg-[var(--error)] hover:text-[var(--on-accent)] transition-colors"
        >
          Delete account…
        </button>
      </section>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} labelledBy={titleId} dismissible={!resetting}>
        <span className="grid place-items-center w-12 h-12 rounded-full bg-[var(--warning-subtle)] text-[var(--warning)]">
          <AlertTriangle className="w-5 h-5" />
        </span>
        <h2 id={titleId} className="display mt-4 text-[1.75rem] pr-10">
          There&apos;s no account to delete.
        </h2>
        <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">
          Prism is running in demo mode: nothing about you is stored on a server. Your profile, drafts, bookmarks and
          settings live only in this browser.
        </p>
        <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">
          If you want a clean slate, you can reset the demo. That clears everything saved here and starts over as the
          sample writer.
        </p>
        <div className="mt-7 grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            data-autofocus
            onClick={() => setDeleteOpen(false)}
            disabled={resetting}
            className="h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors disabled:opacity-50"
          >
            Keep everything
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={resetting}
            className="h-11 px-6 rounded-full bg-[var(--panel)] border border-[var(--border-strong)] text-[var(--error)] font-medium hover:border-[var(--error)] transition-colors inline-flex items-center justify-center gap-2 disabled:cursor-wait"
          >
            {resetting && <Loader2 className="w-4 h-4 animate-spin" />}
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
