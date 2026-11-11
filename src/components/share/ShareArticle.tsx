"use client"

import { useEffect, useId, useState } from "react"
import { motion } from "motion/react"
import { Check, Copy, Link2, PartyPopper, Share2 } from "lucide-react"
import { StudioDialog } from "@/components/studio/StudioDialog"
import { copyText } from "@/components/posts/copyText"
import { InstagramIcon, LinkedInIcon, WhatsAppIcon, XIcon } from "@/components/share/BrandIcons"
import { instagramCaption, shareText, shareUrls, type ShareInput, type SocialHandles } from "@/lib/social"
import { toast, useUIStore } from "@/lib/store"
import { useIdentity } from "@/components/profile/identity"
import { cn } from "@/lib/utils"

export interface ShareProps {
  title: string
  /** Path ("/story/abc") or absolute URL */
  url: string
  authorName: string
  handles: SocialHandles
  asAuthor: boolean
}

/** Resolve a path against the current origin once mounted (SSR renders the path) */
function useAbsolute(url: string) {
  const [abs, setAbs] = useState(url)
  useEffect(() => {
    setAbs(/^https?:\/\//.test(url) ? url : new URL(url, window.location.origin).toString())
  }, [url])
  return abs
}

function openPopup(href: string) {
  window.open(href, "_blank", "noopener,noreferrer,width=640,height=720")
}

async function copy(text: string, what: string) {
  const ok = await copyText(text)
  toast(ok ? `${what} copied` : "Couldn't copy — select the text and copy it manually", { tone: ok ? "success" : "error" })
  return ok
}

const iconBtn =
  "grid place-items-center w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-colors"

/** Inline action bar: one-click networks, copy link, and a "more" dialog with editable text */
export function ShareBar({ className, label = "Share", ...props }: ShareProps & { className?: string; label?: string }) {
  const url = useAbsolute(props.url)
  const input: ShareInput = { ...props, url }
  const urls = shareUrls(input)
  const [dialog, setDialog] = useState<null | "share" | "instagram">(null)

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="meta mr-1">{label}</span>
      <button type="button" className={iconBtn} aria-label="Share on LinkedIn" onClick={() => openPopup(urls.linkedin)}>
        <LinkedInIcon className="w-4 h-4" />
      </button>
      <button type="button" className={iconBtn} aria-label="Share on Instagram" onClick={() => setDialog("instagram")}>
        <InstagramIcon className="w-4 h-4" />
      </button>
      <button type="button" className={iconBtn} aria-label="Share on X" onClick={() => openPopup(urls.x)}>
        <XIcon className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={iconBtn} aria-label="Share on WhatsApp" onClick={() => openPopup(urls.whatsapp)}>
        <WhatsAppIcon className="w-4 h-4" />
      </button>
      <button type="button" className={iconBtn} aria-label="Copy link" onClick={() => copy(url, "Link")}>
        <Link2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setDialog("share")}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
      >
        <Share2 className="w-4 h-4" /> Share article
      </button>
      <ShareDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} focus={dialog ?? "share"} {...props} />
    </div>
  )
}

/** ShareBar for server-rendered pages: resolves the author's handles and whether the viewer is the author */
export function AuthorShareBar({ title, url, authorUsername, className }: { title: string; url: string; authorUsername: string; className?: string }) {
  const author = useIdentity(authorUsername)
  const currentUser = useUIStore((s) => s.currentUser)
  if (!author) return null
  return (
    <ShareBar
      className={className}
      title={title}
      url={url}
      authorName={author.displayName}
      handles={author.handles}
      asAuthor={currentUser === authorUsername}
    />
  )
}

/**
 * Share modal. Pre-fills the post with title, live URL and the author's handles; the text is
 * editable before sending. `celebrate` turns it into the "you're published" moment.
 */
export function ShareDialog({
  open,
  onOpenChange,
  celebrate = false,
  focus = "share",
  ...props
}: ShareProps & { open: boolean; onOpenChange: (o: boolean) => void; celebrate?: boolean; focus?: "share" | "instagram" }) {
  const url = useAbsolute(props.url)
  const input: ShareInput = { ...props, url }
  const defaultText = shareText(input)
  const [text, setText] = useState(defaultText)
  const [copied, setCopied] = useState<string | null>(null)
  const textId = useId()

  // Reset the editable text whenever the dialog opens or the article changes
  useEffect(() => {
    if (open) {
      setText(defaultText)
      setCopied(null)
    }
  }, [open, defaultText])

  const enc = encodeURIComponent(text)
  const caption = instagramCaption(input)

  const doCopy = async (value: string, key: string, what: string) => {
    if (await copy(value, what)) setCopied(key)
  }

  const network = (label: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 h-20 rounded-[14px] border border-[var(--border)] bg-[var(--panel)] text-sm font-medium hover:border-[var(--fg)] transition-colors"
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  )

  return (
    <StudioDialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-lg"
      title={
        celebrate ? (
          <span className="inline-flex items-center gap-2">
            <PartyPopper className="w-6 h-6 text-[var(--accent)]" /> You&apos;re published
          </span>
        ) : focus === "instagram" ? (
          "Share on Instagram"
        ) : (
          "Share this article"
        )
      }
      description={
        celebrate
          ? `“${props.title}” passed review and is live on Prism. Tell people where to find it.`
          : focus === "instagram"
            ? "Instagram doesn't accept links in posts from the web, so copy the caption and add the link as a Link sticker."
            : "The message is pre-filled with the title, link and social handles. Edit it before you post."
      }
    >
      {focus !== "instagram" && (
        <>
          <label htmlFor={textId} className="sr-only">
            Share message
          </label>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mt-5 w-full p-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm leading-relaxed resize-none focus:border-[var(--fg)] outline-none"
          />
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {network("LinkedIn", LinkedInIcon, () => openPopup(`https://www.linkedin.com/feed/?shareActive=true&text=${enc}`))}
            {network("X", XIcon, () => openPopup(shareUrls(input).x))}
            {network("WhatsApp", WhatsAppIcon, () => openPopup(`https://wa.me/?text=${enc}`))}
            {network("Copy text", copied === "text" ? Check : Copy, () => doCopy(text, "text", "Message"))}
          </div>
        </>
      )}

      {/* Instagram helper */}
      <div className={cn("rounded-[14px] border border-[var(--border)] p-4", focus === "instagram" ? "mt-5" : "mt-4")}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <InstagramIcon className="w-4 h-4" /> Instagram post or story
        </p>
        <pre className="mt-3 p-3 rounded-[10px] bg-[var(--bg)] text-xs leading-relaxed whitespace-pre-wrap font-sans text-[var(--fg-secondary)] max-h-36 overflow-y-auto">
          {caption}
        </pre>
        <ol className="mt-3 space-y-1 text-xs text-[var(--fg-muted)] list-decimal pl-4">
          <li>Copy the caption and paste it into your post.</li>
          <li>For a story, add a Link sticker and paste the article link.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => doCopy(caption, "caption", "Caption")}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
          >
            {copied === "caption" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy caption
          </button>
          <button
            type="button"
            onClick={() => doCopy(url, "ig-link", "Link")}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
          >
            {copied === "ig-link" ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />} Copy link for sticker
          </button>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
          >
            Open Instagram
          </a>
        </div>
      </div>

      {/* Link */}
      <div className="mt-4 flex items-center gap-2 h-11 pl-4 pr-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)]">
        <span className="flex-1 min-w-0 truncate text-sm text-[var(--fg-muted)]">{url}</span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => doCopy(url, "link", "Link")}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
        >
          {copied === "link" ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />} Copy link
        </motion.button>
      </div>
    </StudioDialog>
  )
}
