"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast, useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/** Uploads an article image to Firebase Storage (articles/{uid}/{time}_{name}) and resolves to its URL */
export async function uploadArticleImage(file: File, onProgress?: (p: number) => void): Promise<string> {
  const uid = useUIStore.getState().authUid
  if (!uid) throw new Error("Sign in to upload images.")
  const { articleImagePath, uploadImageToStorage } = await import("@/lib/storage")
  return uploadImageToStorage(file, articleImagePath(uid, file), onProgress)
}

const storageError = (err: unknown) =>
  (err as { code?: string }).code === "storage/unauthorized"
    ? "Storage rules blocked the upload. Deploy storage.rules and try again."
    : (err as Error).message || "Upload failed."

/** Story settings: the cover image readers see at the top of the story and on cards */
export function CoverImageField({ value, onChange }: { value?: string; onChange: (url: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setProgress(0)
    try {
      const url = await uploadArticleImage(file, setProgress)
      onChange(url)
      toast("Cover image uploaded", { tone: "success" })
    } catch (err) {
      toast(storageError(err), { tone: "error" })
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <section>
      <p className="meta mb-2">Cover image</p>
      {value ? (
        <div className="relative overflow-hidden rounded-[14px] border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL, any size */}
          <img src={value} alt="" className="w-full aspect-[16/9] object-cover" />
          <div className="absolute right-2 bottom-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="h-8 px-3 rounded-full bg-[var(--panel)]/95 text-xs font-medium border border-[var(--border)] hover:border-[var(--fg)]"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              disabled={busy}
              aria-label="Remove cover image"
              className="grid place-items-center w-8 h-8 rounded-full bg-[var(--panel)]/95 border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--error)]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cn(
            "w-full aspect-[16/9] grid place-items-center rounded-[14px] border border-dashed border-[var(--border-strong)] text-sm text-[var(--fg-muted)] transition-colors",
            !busy && "hover:border-[var(--fg)] hover:text-[var(--fg)]"
          )}
        >
          <span className="flex flex-col items-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            {busy ? `Uploading… ${progress}%` : "Upload a cover image"}
            {!busy && <span className="text-xs">JPG, PNG, WebP or GIF · up to 8 MB</span>}
          </span>
        </button>
      )}
      {busy && value && <p className="mt-2 text-xs text-[var(--fg-muted)]">Uploading… {progress}%</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </section>
  )
}

/** "Upload from device" for the inline-image field: resolves the uploaded image's URL */
export function InlineImageUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={progress !== null}
        className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors disabled:opacity-60"
      >
        {progress !== null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
        {progress !== null ? `Uploading… ${progress}%` : "Or upload from your device"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          setProgress(0)
          try {
            onUploaded(await uploadArticleImage(file, setProgress))
          } catch (err) {
            toast(storageError(err), { tone: "error" })
          } finally {
            setProgress(null)
          }
        }}
      />
    </>
  )
}
