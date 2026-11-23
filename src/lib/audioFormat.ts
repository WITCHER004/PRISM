// Pure formatting helpers for audio (safe for server components and feed cards)

/** 84 → "01:24", 3725 → "1:02:05" */
export function formatClock(totalSec: number): string {
  const t = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
