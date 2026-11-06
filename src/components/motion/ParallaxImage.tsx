"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

interface ParallaxImageProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
}

// Image drifts slightly slower than the page as it scrolls past — kept to ±6% so it never disorients
export function ParallaxImage({ src, alt, className, priority }: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"])

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div className="absolute inset-[-8%_0]" style={reduce ? undefined : { y }}>
        <Image src={src} alt={alt} fill className="object-cover" priority={priority} unoptimized />
      </motion.div>
    </div>
  )
}
