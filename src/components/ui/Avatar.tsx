"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface AvatarProps {
  src?: string
  alt: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  priority?: boolean
}

const sizeMap = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-14 h-14 text-xl",
  xl: "w-20 h-20 text-2xl",
}

const pixelMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
}

export function Avatar({ src, alt, size = "md", className, priority = false }: AvatarProps) {
  // Remember which src failed so a new src gets a fresh try
  const [failedSrc, setFailedSrc] = useState<string>()
  const initials = alt
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden shrink-0 bg-[var(--surface)] flex items-center justify-center font-semibold text-[var(--fg-muted)]",
        sizeMap[size],
        className
      )}
    >
      {src && src !== failedSrc ? (
        <Image
          src={src}
          alt={alt}
          width={pixelMap[size]}
          height={pixelMap[size]}
          className="object-cover w-full h-full"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          unoptimized
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
