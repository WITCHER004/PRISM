"use client"

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage"
import { storage } from "@/lib/firebase"

// Keep in step with storage.rules
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",")
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i
const EXT_FOR: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }

/** A storage-safe file name: keeps the extension, drops anything that isn't a plain character */
export const safeFileName = (name: string) => name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "image"

/** A safe name that always ends in the extension matching the file's type (the Storage rules require one) */
const storageName = (file: File) => {
  const base = safeFileName(file.name)
  return IMAGE_EXT.test(base) ? base : base.replace(/\.[^.]*$/, "") + (EXT_FOR[file.type] ?? ".jpg")
}

/**
 * Uploads an image to Firebase Storage at `path` and resolves to its public download URL.
 * `onProgress` receives 0–100 while the upload runs.
 */
export function uploadImageToStorage(file: File, path: string, onProgress?: (percent: number) => void): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) return Promise.reject(new Error("Choose a JPG, PNG or WebP image."))
  if (file.size >= MAX_IMAGE_BYTES) return Promise.reject(new Error("Images must be under 5 MB."))

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    })
    task.on(
      "state_changed",
      (snap) => onProgress?.(snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0),
      (err) => reject(err),
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject)
    )
  })
}

export const avatarPath = (uid: string, file: File) => `avatars/${uid}/${Date.now()}_${storageName(file)}`
export const articleImagePath = (uid: string, file: File) => `articles/${uid}/${Date.now()}_${storageName(file)}`
