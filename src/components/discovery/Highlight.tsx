const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Wraps every occurrence of any term in <mark>, case-insensitively */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map(escape).join("|")})`, "gi")
  const parts = text.split(re)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[4px] px-0.5 -mx-0.5 bg-[var(--accent-subtle)] text-[var(--fg)]">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

/** A window of `text` centred on the first matched term, so matches deep in an excerpt stay visible */
export function snippet(text: string, terms: string[], radius = 70): string {
  const lower = text.toLowerCase()
  const idx = terms.reduce((min, t) => {
    const i = lower.indexOf(t)
    return i >= 0 && (min < 0 || i < min) ? i : min
  }, -1)
  if (idx <= radius) return text
  const start = text.lastIndexOf(" ", idx - radius / 2)
  return "…" + text.slice(start < 0 ? idx - radius / 2 : start + 1)
}
