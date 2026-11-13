"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { X, Copy, Download, Share2, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { dur, ease } from "@/lib/motion"
import { toast } from "@/lib/store"

export type QuoteTheme = "paper" | "obsidian" | "amber" | "blueprint"

interface ThemeConfig {
  id: QuoteTheme
  name: string
  bg: string
  ink: string
  border: string
  accent: string
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: "paper",
    name: "Warm Paper",
    bg: "#faf8f5",
    ink: "#141413",
    border: "#e7e2d9",
    accent: "#b7791f",
  },
  {
    id: "obsidian",
    name: "Obsidian Ink",
    bg: "#141413",
    ink: "#f4f1ea",
    border: "#2b2a27",
    accent: "#e0a53a",
  },
  {
    id: "amber",
    name: "Amber Glass",
    bg: "#f3c97a",
    ink: "#2a1a05",
    border: "#d9a850",
    accent: "#6b470f",
  },
  {
    id: "blueprint",
    name: "Blueprint Grid",
    bg: "#1b3561",
    ink: "#eaf1ff",
    border: "#294d88",
    accent: "#9cc3ff",
  },
]

interface QuoteCardModalProps {
  open: boolean
  onClose: () => void
  quote: string
  articleTitle: string
  authorName: string
  authorHandle: string
  articleUrl?: string
}

export function QuoteCardModal({
  open,
  onClose,
  quote,
  articleTitle,
  authorName,
  authorHandle,
  articleUrl,
}: QuoteCardModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<QuoteTheme>("obsidian")
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 2x Retina resolution
    const scale = 2
    const width = 600
    const height = 400

    canvas.width = width * scale
    canvas.height = height * scale
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.scale(scale, scale)

    const theme = THEME_CONFIGS.find((t) => t.id === selectedTheme) ?? THEME_CONFIGS[1]

    // Background Canvas
    if (theme.id === "amber") {
      const grad = ctx.createLinearGradient(0, 0, width, height)
      grad.addColorStop(0, "#f8dca6")
      grad.addColorStop(0.55, "#efb85c")
      grad.addColorStop(1, "#e3a043")
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = theme.bg
    }
    ctx.fillRect(0, 0, width, height)

    // Blueprint grid pattern
    if (theme.id === "blueprint") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"
      ctx.lineWidth = 1
      const gridSize = 20
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    }

    // Border
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1.5
    ctx.strokeRect(1, 1, width - 2, height - 2)

    // Decorative top branding / logo
    ctx.fillStyle = theme.accent
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif"
    ctx.fillText("✦ PRISM ARCHIVE", 40, 48)

    // Article title tag
    ctx.fillStyle = theme.id === "obsidian" || theme.id === "blueprint" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)"
    ctx.font = "12px system-ui, -apple-system, sans-serif"
    const titleText = articleTitle ? `From “${articleTitle.slice(0, 40)}${articleTitle.length > 40 ? "..." : ""}”` : ""
    ctx.fillText(titleText, 40, 70)

    // Quote Mark icon
    ctx.font = "italic bold 48px Georgia, serif"
    ctx.fillStyle = theme.accent
    ctx.fillText("“", 36, 128)

    // Quote text with word-wrapping
    ctx.fillStyle = theme.ink
    ctx.font = "italic 22px Georgia, Cambria, serif"

    const maxTextWidth = width - 80
    const words = quote.split(" ")
    let line = ""
    let y = 148
    const lineHeight = 32
    const maxLines = 5
    let linesDrawn = 0

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " "
      const metrics = ctx.measureText(testLine)
      const testWidth = metrics.width
      if (testWidth > maxTextWidth && n > 0) {
        linesDrawn++
        if (linesDrawn === maxLines) {
          ctx.fillText(line.trim() + "...", 40, y)
          line = ""
          break
        }
        ctx.fillText(line, 40, y)
        line = words[n] + " "
        y += lineHeight
      } else {
        line = testLine
      }
    }
    if (line.trim() && linesDrawn < maxLines) {
      ctx.fillText(line, 40, y)
    }

    // Footer divider line
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, height - 70)
    ctx.lineTo(width - 40, height - 70)
    ctx.stroke()

    // Author Info in Footer
    ctx.fillStyle = theme.ink
    ctx.font = "600 15px system-ui, -apple-system, sans-serif"
    ctx.fillText(authorName || "Prism Writer", 40, height - 42)

    ctx.fillStyle = theme.id === "obsidian" || theme.id === "blueprint" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
    ctx.font = "12px system-ui, -apple-system, sans-serif"
    ctx.fillText(`@${authorHandle || "writer"}`, 40, height - 26)

    // Watermark right
    ctx.font = "600 13px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = theme.accent
    const watermark = "prism.press"
    const wmWidth = ctx.measureText(watermark).width
    ctx.fillText(watermark, width - 40 - wmWidth, height - 34)
  }, [quote, articleTitle, authorName, authorHandle, selectedTheme])

  useEffect(() => {
    if (open) {
      // Small timeout for canvas element mount
      setTimeout(drawCard, 20)
    }
  }, [open, drawCard])

  const copyImage = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ])
        setCopied(true)
        toast("Quote Card copied to clipboard as an image!")
        setTimeout(() => setCopied(false), 2000)
      }, "image/png")
    } catch {
      toast("Clipboard image copying is not permitted in this browser.", { tone: "error" })
    }
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `prism-quote-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
    toast("Quote card downloaded (2x Retina PNG)!")
  }

  const shareToX = () => {
    const text = `“${quote.slice(0, 160)}${quote.length > 160 ? "..." : ""}”\n\n— ${authorName} (@${authorHandle}) on Prism\n`
    const url = articleUrl ? window.location.origin + articleUrl : window.location.href
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: dur.fast, ease: ease.in } }}
            className="relative w-full max-w-[660px] bg-[#141413] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[111]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-display font-semibold text-lg text-[#f4f1ea] tracking-tight">
                  Quote Card Studio
                </h3>
                <p className="text-xs text-[#a8a29a] mt-0.5">
                  Rendered on signature editorial canvases for social sharing.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid place-items-center w-8 h-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close quote modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Preview Area */}
            <div className="p-6 flex flex-col items-center justify-center bg-[#0d0d0c] overflow-hidden">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
                <canvas ref={canvasRef} className="block max-w-full h-auto" />
              </div>

              {/* Theme Selector */}
              <div className="flex items-center gap-2 mt-5">
                {THEME_CONFIGS.map((theme) => {
                  const active = selectedTheme === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        active
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      {theme.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#141413]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyImage}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied Image!" : "Copy Image"}</span>
                </button>

                <button
                  type="button"
                  onClick={downloadImage}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download 2x PNG</span>
                </button>
              </div>

              <button
                type="button"
                onClick={shareToX}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold bg-[#1d9bf0] text-white hover:bg-[#1a8cd8] transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share to X</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

