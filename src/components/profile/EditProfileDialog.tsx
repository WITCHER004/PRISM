"use client"

import { useEffect, useId, useState } from "react"
import { Loader2 } from "lucide-react"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { Button } from "@/components/ui/Button"
import { AvatarUploader } from "./AvatarUploader"
import { SOCIAL_ICON } from "./SocialLinks"
import { useUIStore, toast, type Profile } from "@/lib/store"
import { MOCK_USERS } from "@/lib/data"
import { handleError, normalizeHandle, SOCIAL_KEYS, SOCIALS, type SocialKey } from "@/lib/social"
import { cn } from "@/lib/utils"

type Fields = Pick<Profile, "displayName" | "bio" | "websiteUrl" | "avatarUrl" | SocialKey>
const BIO_MAX = 200

function normalizeUrl(v: string) {
  const t = v.trim()
  return !t ? "" : /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function profileFieldErrors(d: Fields) {
  const e: Partial<Record<keyof Fields, string>> = {}
  if (!d.displayName.trim()) e.displayName = "Your name can't be empty."
  else if (d.displayName.trim().length > 50) e.displayName = "Keep it under 50 characters."
  if (d.bio.length > BIO_MAX) e.bio = `Bios are capped at ${BIO_MAX} characters.`
  if (d.websiteUrl.trim()) {
    try {
      if (!new URL(normalizeUrl(d.websiteUrl)).hostname.includes(".")) e.websiteUrl = "Include a domain, like example.com."
    } catch {
      e.websiteUrl = "That doesn't look like a web address."
    }
  }
  for (const k of SOCIAL_KEYS) {
    const err = handleError(k, d[k])
    if (err) e[k] = err
  }
  return e
}

/** Normalize handles (strip @ and pasted URLs) and the website before saving */
export function cleanProfileFields(d: Fields): Fields {
  return {
    displayName: d.displayName.trim(),
    bio: d.bio.trim(),
    websiteUrl: normalizeUrl(d.websiteUrl),
    avatarUrl: d.avatarUrl,
    linkedinHandle: normalizeHandle("linkedinHandle", d.linkedinHandle),
    instagramHandle: normalizeHandle("instagramHandle", d.instagramHandle),
    twitterHandle: normalizeHandle("twitterHandle", d.twitterHandle),
    githubHandle: normalizeHandle("githubHandle", d.githubHandle),
  }
}

const input =
  "w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--fg)] outline-none transition-colors"

export function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const profile = useUIStore((s) => s.profile)
  const currentUser = useUIStore((s) => s.currentUser)
  const updateProfile = useUIStore((s) => s.updateProfile)
  const base = MOCK_USERS.find((u) => u.username === currentUser)

  const pickFields = (p: Profile): Fields => ({
    displayName: p.displayName,
    bio: p.bio,
    websiteUrl: p.websiteUrl,
    avatarUrl: p.avatarUrl,
    linkedinHandle: p.linkedinHandle,
    instagramHandle: p.instagramHandle,
    twitterHandle: p.twitterHandle,
    githubHandle: p.githubHandle,
  })
  const [draft, setDraft] = useState<Fields>(() => pickFields(profile))
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const uid = useId()

  // Start from the saved profile every time the dialog opens
  useEffect(() => {
    if (open) {
      setDraft(pickFields(profile))
      setAttempted(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const errors = profileFieldErrors(draft)
  const shown = (k: keyof Fields) => (attempted || draft[k].trim() ? errors[k] : undefined)
  const set = (k: keyof Fields) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(errors).length) return
    setSaving(true)
    updateProfile(cleanProfileFields(draft))
    setSaving(false)
    toast("Profile updated", { tone: "success" })
    onOpenChange(false)
  }

  const field = (k: keyof Fields, label: string, opts: { placeholder?: string; prefix?: string; icon?: React.ComponentType<{ className?: string }>; type?: string } = {}) => {
    const id = `${uid}-${k}`
    const err = shown(k)
    const Icon = opts.icon
    return (
      <div>
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
          {Icon && <Icon className="w-3.5 h-3.5 text-[var(--fg-muted)]" />}
          {label}
        </label>
        <div className="relative mt-1.5">
          {opts.prefix && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--fg-subtle)] pointer-events-none">{opts.prefix}</span>
          )}
          <input
            id={id}
            type={opts.type ?? "text"}
            value={draft[k]}
            onChange={(e) => set(k)(e.target.value)}
            placeholder={opts.placeholder}
            aria-invalid={!!err}
            aria-describedby={err ? `${id}-err` : undefined}
            className={cn(input, err ? "border-[var(--error)]" : "border-[var(--border)]")}
            style={opts.prefix ? { paddingLeft: `calc(1.125rem + ${opts.prefix.length}ch)` } : undefined}
          />
        </div>
        {err && (
          <p id={`${id}-err`} className="mt-1 text-xs text-[var(--error)]">
            {err}
          </p>
        )}
      </div>
    )
  }

  return (
    <StudioDialog open={open} onOpenChange={onOpenChange} title="Edit profile" className="max-w-xl">
      <form onSubmit={save} noValidate className="mt-6 space-y-5">
        <AvatarUploader
          value={draft.avatarUrl}
          fallbackSrc={base?.avatarUrl}
          name={draft.displayName || "You"}
          onChange={(url) => setDraft((d) => ({ ...d, avatarUrl: url }))}
        />

        {field("displayName", "Display name")}
        <div>
          <label htmlFor={`${uid}-bio`} className="text-sm font-medium">
            Bio
          </label>
          <textarea
            id={`${uid}-bio`}
            value={draft.bio}
            onChange={(e) => set("bio")(e.target.value)}
            rows={3}
            maxLength={BIO_MAX + 20}
            placeholder="A sentence or two about what you write and read."
            className={cn(
              "mt-1.5 w-full p-3.5 rounded-[12px] bg-[var(--bg)] border text-sm leading-relaxed resize-none focus:border-[var(--fg)] outline-none",
              shown("bio") ? "border-[var(--error)]" : "border-[var(--border)]"
            )}
          />
          <p className={cn("mt-1 text-xs text-right tabular-nums", draft.bio.length > BIO_MAX ? "text-[var(--error)]" : "text-[var(--fg-subtle)]")}>
            {draft.bio.length}/{BIO_MAX}
          </p>
        </div>

        <fieldset>
          <legend className="meta mb-3">Links</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            {SOCIAL_KEYS.map((k) => (
              <div key={k}>{field(k, SOCIALS[k].label, { prefix: SOCIALS[k].prefix, placeholder: SOCIALS[k].placeholder, icon: SOCIAL_ICON[k] })}</div>
            ))}
            <div className="sm:col-span-2">{field("websiteUrl", "Website", { placeholder: "yourname.com", type: "url" })}</div>
          </div>
          <p className="mt-3 text-xs text-[var(--fg-muted)]">
            Your handles are added to share posts when you share your articles. Pasting a full profile URL works too.
          </p>
        </fieldset>

        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save profile
          </Button>
        </DialogActions>
      </form>
    </StudioDialog>
  )
}
