"use client"

// Pre-recorded author audiobooks: validation, duration probing and the upload to Firebase Storage.
// Keep the limits in step with the audiobooks/{uid}/ block in storage.rules.

import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { safeFileName } from "@/lib/storage"
import type { AudiobookSource } from "@/lib/live/schema"
import { formatBytes } from "@/lib/audioFormat"

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024
/** Voice-post recordings stop on their own at an hour (~43 MB at the bitrate below), under the upload cap */
export const MAX_RECORD_SEC = 60 * 60
export const RECORD_BITRATE = 96_000

const EXT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  // In-browser recordings only (Chrome/Firefox record WebM, Safari MP4); the file picker doesn't offer these
  webm: "audio/webm",
  mp4: "audio/mp4",
}
const TYPE_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/vnd.wave": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
}
export const AUDIO_ACCEPT = ".mp3,.wav,.m4a,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/ogg"

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""
/** "audio/ogg; codecs=opus" → "audio/ogg" */
const baseType = (type: string) => type.split(";")[0].trim().toLowerCase()

/**
 * The content type to store a file under, or null when it isn't an accepted audio file.
 * Some systems (Windows with .m4a, for one) report no type at all, so the extension decides then.
 */
export function audioTypeOf(file: { name: string; type: string }): string | null {
  const type = baseType(file.type)
  const ext = extOf(file.name)
  if (type && TYPE_EXT[type] && EXT_TYPE[ext]) return type
  if (!type || type === "application/octet-stream" || type === "video/mp4" || type === "video/webm" || type === "video/ogg") return EXT_TYPE[ext] ?? null
  return null
}

/** Why this file can't be attached, or null when it can */
const PICKABLE = /\.(mp3|wav|m4a|ogg)$/i
export function audioFileProblem(file: File): string | null {
  if (!PICKABLE.test(file.name) || !audioTypeOf(file)) return "Choose an MP3, WAV, M4A or OGG audio file."
  if (file.size >= MAX_AUDIO_BYTES) return `Audio files must be under 50 MB — this one is ${formatBytes(file.size)}.`
  if (file.size === 0) return "That file is empty."
  return null
}

/** The best format this browser's MediaRecorder can produce (Chrome/Firefox: WebM Opus, Safari: MP4/AAC) */
export function recorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ""
}

/** A file name for a fresh recording, with the extension its format needs */
export const recordingName = (type: string) => `voice-post.${TYPE_EXT[baseType(type)] ?? "webm"}`

/**
 * Reads an audio file's length in seconds. Some files (VBR MP3s, some OGGs) report Infinity until the
 * browser has scanned to the end, so that case seeks far ahead to force the real value.
 */
export function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    let settled = false
    const done = (v: number) => {
      if (settled) return
      settled = true
      audio.removeAttribute("src")
      audio.load()
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(v) && v > 0 ? v : 0)
    }
    const timeout = window.setTimeout(() => done(0), 8000)
    audio.preload = "metadata"
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        window.clearTimeout(timeout)
        return done(audio.duration)
      }
      audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          window.clearTimeout(timeout)
          done(audio.duration)
        }
      }
      audio.currentTime = 1e7
    }
    audio.onerror = () => {
      window.clearTimeout(timeout)
      done(0)
    }
    audio.src = url
  })
}

export interface UploadedAudiobook {
  audiobookUrl: string
  audiobookDurationSec: number
  audiobookSource: AudiobookSource
}

/**
 * Uploads a narration to audiobooks/{uid}/{time}_{name} with a resumable upload and resolves to the
 * fields saved on the article. `onProgress` receives 0–100. Call `cancel()` on the returned handle to stop.
 */
export function uploadAudiobook(
  blob: Blob,
  opts: { uid: string; name: string; durationSec: number; source: AudiobookSource; onProgress?: (percent: number) => void }
): { promise: Promise<UploadedAudiobook>; cancel: () => void } {
  const contentType = audioTypeOf({ name: opts.name, type: blob.type })
  if (!contentType) return { promise: Promise.reject(new Error("That isn't a supported audio format.")), cancel: () => {} }
  if (blob.size >= MAX_AUDIO_BYTES) return { promise: Promise.reject(new Error("Audio files must be under 50 MB.")), cancel: () => {} }

  // The Storage rules need an extension that matches the type
  let name = safeFileName(opts.name)
  if (!EXT_TYPE[extOf(name)]) name = name.replace(/\.[^.]*$/, "") + "." + (TYPE_EXT[contentType] ?? "mp3")
  const path = `audiobooks/${opts.uid}/${Date.now()}_${name}`

  let task: UploadTask | null = null
  const promise = new Promise<UploadedAudiobook>((resolve, reject) => {
    task = uploadBytesResumable(ref(storage, path), blob, {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      // Opening the file's link saves it instead of playing it in a tab (the <audio> player ignores this)
      contentDisposition: `attachment; filename="${name}"`,
    })
    task.on(
      "state_changed",
      (snap) => opts.onProgress?.(snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0),
      reject,
      () =>
        getDownloadURL(task!.snapshot.ref).then(
          (url) => resolve({ audiobookUrl: url, audiobookDurationSec: Math.round(opts.durationSec), audiobookSource: opts.source }),
          reject
        )
    )
  })
  return { promise, cancel: () => task?.cancel() }
}

/** A friendly message for a failed upload */
export function uploadErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ""
  if (code === "storage/canceled") return "Upload cancelled."
  if (code === "storage/unauthorized") return "Storage refused the file. Check it's an audio file under 50 MB, and that you're signed in."
  if (code === "storage/quota-exceeded") return "Storage is full right now. Try again later."
  if (code === "storage/retry-limit-exceeded") return "The connection dropped during the upload. Try again."
  return (err as Error)?.message || "The upload failed. Try again."
}

export { formatBytes, formatClock } from "@/lib/audioFormat"
