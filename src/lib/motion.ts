// Shared motion tokens — every animation draws from these so the site keeps one rhythm.
// Arrivals decelerate (ease.out); exits are faster than entrances.

export const ease = {
  out: [0.2, 0.7, 0.2, 1] as const,
  in: [0.4, 0, 1, 1] as const,
}

export const dur = {
  fast: 0.16, // hover / press feedback, exits
  base: 0.32, // page + state transitions
  slow: 0.55, // content reveals
}

/** Delay between items in a staggered group (30–50ms reads as a sequence, not a crawl) */
export const stagger = 0.04

export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 35 } as const,
  soft: { type: "spring", stiffness: 260, damping: 30 } as const,
}
