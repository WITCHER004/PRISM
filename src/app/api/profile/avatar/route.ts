import { NextResponse } from "next/server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

// Avatar upload. POST multipart/form-data { file } (already cropped square on the client).
// Storage: Supabase Storage (bucket AVATAR_BUCKET, default "avatars") when a service-role key
// is configured; otherwise the image comes back as a data URI, which demo mode keeps in the
// browser store alongside the rest of the profile.

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
]

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes("your-project-ref") || key.endsWith("...")) return null
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get("file")
  } catch {
    return NextResponse.json({ error: "Send the image as multipart form data in a field named “file”." }, { status: 400 })
  }
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No image received." }, { status: 400 })
  if (file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  // Trust the file's bytes, not its declared type
  const kind = SIGNATURES.find((s) => s.test(bytes))
  if (!kind) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 415 })

  const storage = storageClient()
  if (storage) {
    const bucket = process.env.AVATAR_BUCKET || "avatars"
    const path = `${crypto.randomUUID()}.${kind.ext}`
    const { error } = await storage.storage.from(bucket).upload(path, bytes, { contentType: kind.type, upsert: false })
    if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 502 })
    const { data } = storage.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, storage: "supabase" })
  }

  const dataUri = `data:${kind.type};base64,${Buffer.from(bytes).toString("base64")}`
  return NextResponse.json({ url: dataUri, storage: "inline" })
}
