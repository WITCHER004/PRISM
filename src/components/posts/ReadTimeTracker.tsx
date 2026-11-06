"use client"

import { useEffect, useRef } from "react"

interface ReadTimeTrackerProps {
  postId: string
  userId?: string
}

export function ReadTimeTracker({ postId, userId }: ReadTimeTrackerProps) {
  const activeSeconds = useRef(0)
  const maxScrollDepth = useRef(0)

  useEffect(() => {
    let lastTick = Date.now()

    // Measure active reading seconds every second
    const interval = setInterval(() => {
      const now = Date.now()
      if (document.visibilityState === "visible") {
        activeSeconds.current += Math.round((now - lastTick) / 1000)
      }
      lastTick = now
    }, 1000)

    // Measure scroll depth
    const handleScroll = () => {
      const h = document.documentElement
      const b = document.body
      const st = "scrollTop"
      const sh = "scrollHeight"
      const percent = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)
      const depth = Math.min(1, Math.max(0, percent))
      if (depth > maxScrollDepth.current) {
        maxScrollDepth.current = Math.round(depth * 100) / 100
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    // Beacon telemetry flush
    const flushTelemetry = () => {
      if (activeSeconds.current < 2) return // Don't log trivial 1-second bounces

      const payload = JSON.stringify({
        postId,
        durationSec: activeSeconds.current,
        scrollDepth: maxScrollDepth.current,
        userId: userId || null,
      })

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/read-session", payload)
      } else {
        fetch("/api/read-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    }

    // Flush periodically every 25 seconds
    const beaconInterval = setInterval(flushTelemetry, 25000)

    // Flush on page exit
    window.addEventListener("pagehide", flushTelemetry)
    window.addEventListener("beforeunload", flushTelemetry)

    return () => {
      clearInterval(interval)
      clearInterval(beaconInterval)
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("pagehide", flushTelemetry)
      window.removeEventListener("beforeunload", flushTelemetry)
      flushTelemetry()
    }
  }, [postId, userId])

  return null
}

