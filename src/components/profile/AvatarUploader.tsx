"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Camera, Loader2, Trash2, ZoomIn, ZoomOut } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { toast } from "@/lib/store"
import { cn } from "@/lib/utils"

const ACCEPT = ["image/jpeg", "image/png", "image/webp"]
const MAX_INPUT_BYTES = 8 * 1024 * 1024 // before cropping; the upload itself is a small JPEG
const VIEW = 240 // crop viewport, px (fits a 320px-wide phone inside the dialog)
const OUT = 400 // output avatar, px
const MAX_ZOOM = 3

export function validateImageFile(file: File): string | null {
  if (!ACCEPT.includes(file.type)) return "Use a JPG, PNG or WebP image."
  if (file.size > MAX_INPUT_BYTES) return "That image is over 8 MB. Choose a smaller one."
  return null
}

/** Upload a cropped avatar; falls back to the inline image if the server can't be reached */
async function uploadAvatar(blob: Blob, fallback: string): Promise<string> {
  const form = new FormData()
  form.append("file", blob, "avatar.jpg")
  let res: Response
  try {
    res = await fetch("/api/profile/avatar", { method: "POST", body: form })
  } catch {
    return fallback // offline: keep the image in the browser
  }
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (res.ok && body.url) return body.url
  if (res.status < 500 && body.error) throw new Error(body.error) // the image was rejected
  return fallback
}

interface AvatarUploaderProps {
  value: string
  fallbackSrc?: string
  name: string
  onChange: (url: string) => void
  className?: string
}

export function AvatarUploader({ value, fallbackSrc, name, onChange, className }: AvatarUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<string | null>(null)
  const [error, setError] = useState("")

  const pick = (file: File | undefined) => {
    if (!file) return
    const problem = validateImageFile(file)
    if (problem) {
      setError(problem)
      return
    }
    setError("")
    const reader = new FileReader()
    reader.onload = () => setSource(reader.result as string)
    reader.onerror = () => setError("Couldn't read that file.")
    reader.readAsDataURL(file)
  }

  return (
    <div className={className}>
      <div
        className="flex items-center gap-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          pick(e.dataTransfer.files[0])
        }}
      >
        <div className="relative">
          <Avatar src={value || fallbackSrc} alt={name} size="xl" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 grid place-items-center w-8 h-8 rounded-full bg-[var(--fg)] text-[var(--bg)] ring-2 ring-[var(--panel)] hover:bg-[var(--fg-secondary)] transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              Upload photo
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
          </div>
          <p className={cn("mt-1.5 text-xs", error ? "text-[var(--error)]" : "text-[var(--fg-muted)]")} role={error ? "alert" : undefined}>
            {error || "JPG, PNG or WebP, up to 8 MB. You can crop it next."}
          </p>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = "" // allow re-selecting the same file
          }}
        />
      </div>

      {source && (
        <CropDialog
          source={source}
          onCancel={() => setSource(null)}
          onDone={(url) => {
            onChange(url)
            setSource(null)
          }}
        />
      )}
    </div>
  )
}

/* ── Crop ─────────────────────────────────────────────────────────────── */

type Img = { el: HTMLImageElement; w: number; h: number }

function CropDialog({ source, onCancel, onDone }: { source: string; onCancel: () => void; onDone: (url: string) => void }) {
  const [img, setImg] = useState<Img | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = new Image()
    el.onload = () => {
      const w = el.naturalWidth
      const h = el.naturalHeight
      const s = VIEW / Math.min(w, h)
      setImg({ el, w, h })
      setPos({ x: (VIEW - w * s) / 2, y: (VIEW - h * s) / 2 }) // centred
    }
    el.onerror = () => {
      toast("That image couldn't be opened", { tone: "error" })
      onCancel()
    }
    el.src = source
  }, [source, onCancel])

  const scale = img ? (VIEW / Math.min(img.w, img.h)) * zoom : 1

  // Keep the image covering the whole viewport
  const clamp = useCallback(
    (x: number, y: number, s = scale) =>
      img
        ? { x: Math.min(0, Math.max(VIEW - img.w * s, x)), y: Math.min(0, Math.max(VIEW - img.h * s, y)) }
        : { x, y },
    [img, scale]
  )

  const setZoomKeepingCenter = (next: number) => {
    if (!img) return
    const z = Math.min(MAX_ZOOM, Math.max(1, next))
    const base = VIEW / Math.min(img.w, img.h)
    const cx = (VIEW / 2 - pos.x) / scale
    const cy = (VIEW / 2 - pos.y) / scale
    const s = base * z
    setZoom(z)
    setPos(clamp(VIEW / 2 - cx * s, VIEW / 2 - cy * s, s))
  }

  const save = async () => {
    if (!img) return
    setSaving(true)
    const canvas = document.createElement("canvas")
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#ffffff" // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.imageSmoothingQuality = "high"
    const size = VIEW / scale
    ctx.drawImage(img.el, -pos.x / scale, -pos.y / scale, size, size, 0, 0, OUT, OUT)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88))
    try {
      const url = blob ? await uploadAvatar(blob, dataUrl) : dataUrl
      onDone(url)
    } catch (err) {
      toast((err as Error).message, { tone: "error" })
      setSaving(false)
    }
  }

  return (
    <StudioDialog open onOpenChange={(o) => !o && !saving && onCancel()} title="Crop your photo" description="Drag to position, zoom to fit. It's shown as a circle across Prism.">
      <div className="mt-5 flex flex-col items-center">
        <div
          role="application"
          aria-label="Crop area. Use arrow keys to move the photo."
          tabIndex={0}
          className="relative overflow-hidden rounded-[16px] bg-[var(--surface)] touch-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (d) setPos(clamp(d.x + e.clientX - d.px, d.y + e.clientY - d.py))
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => setZoomKeepingCenter(zoom - e.deltaY * 0.002)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 6
            const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
            const m = moves[e.key]
            if (m) {
              e.preventDefault()
              setPos(clamp(pos.x + m[0], pos.y + m[1]))
            }
          }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              draggable={false}
              className="absolute top-0 left-0 max-w-none select-none"
              style={{ width: img.w * scale, height: img.h * scale, transform: `translate(${pos.x}px, ${pos.y}px)` }}
            />
          ) : (
            <Loader2 className="absolute inset-0 m-auto w-6 h-6 animate-spin text-[var(--fg-muted)]" />
          )}
          {/* Circular mask preview */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(15,15,20,0.45)] ring-1 ring-white/70" />
        </div>

        <div className="mt-5 flex items-center gap-3 w-full max-w-[260px]">
          <button type="button" aria-label="Zoom out" onClick={() => setZoomKeepingCenter(zoom - 0.2)} className="grid place-items-center w-9 h-9 rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]">
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomKeepingCenter(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-[var(--fg)]"
          />
          <button type="button" aria-label="Zoom in" onClick={() => setZoomKeepingCenter(zoom + 0.2)} className="grid place-items-center w-9 h-9 rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      <DialogActions>
        <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="lg" onClick={save} disabled={!img || saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Use photo
        </Button>
      </DialogActions>
    </StudioDialog>
  )
}
