// next/image loader. Unsplash resizes on its own CDN, so ask it for exactly the width the layout
// needs (from `sizes`) in a modern format, instead of shipping every cover as a 1200px JPEG.
// Anything else (DiceBear SVG avatars, uploads) passes through unchanged.
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (!src.startsWith("https://images.unsplash.com/")) return src
  const url = new URL(src)
  url.searchParams.set("w", String(width))
  url.searchParams.set("q", String(quality ?? 70))
  url.searchParams.set("auto", "format")
  url.searchParams.set("fit", "crop")
  return url.toString()
}
