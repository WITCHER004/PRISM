"use client"

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage"
import { storage } from "@/lib/firebase"

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** A storage-safe file name: keeps the extension, drops anything that isn't a plain character */
export const safeFileName = (name: string) => name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "image"

/**
 * Uploads an image to Firebase Storage at `path` and resolves to its public download URL.
 * `onProgress` receives 0–100 while the upload runs.
 */
export function uploadImageToStorage(file: File, path: string, onProgress?: (percent: number) => void): Promise<string> {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Choose an image file (JPG, PNG, WebP or GIF)."))
  if (file.size > MAX_IMAGE_BYTES) return Promise.reject(new Error("Images must be under 8 MB."))

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

export const avatarPath = (uid: string, file: File) => `avatars/${uid}/${Date.now()}_${safeFileName(file.name)}`
export const articleImagePath = (uid: string, file: File) => `articles/${uid}/${Date.now()}_${safeFileName(file.name)}`
