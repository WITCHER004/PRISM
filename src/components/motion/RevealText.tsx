interface Line {
  text: string
  className?: string
}

interface RevealTextProps {
  lines: Line[]
  as?: "h1" | "h2" | "p"
  className?: string
  /** Seconds before the first word starts */
  delay?: number
}

const STAGGER = 0.04

// Headline whose words rise out of a mask one after another. Pure CSS (.word-rise in globals.css):
// it plays on first paint without waiting for JavaScript, so the headline is never held back.
export function RevealText({ lines, as = "h1", className, delay = 0 }: RevealTextProps) {
  const Tag = as
  let i = 0
  return (
    <Tag className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.text.split(/\s+/).map((word, wi, words) => {
            const order = i++
            return (
              <span key={wi}>
                {/* padding/negative margin keeps descenders from being clipped by the mask */}
                <span className="inline-block overflow-hidden align-top pb-[0.12em] -mb-[0.12em]">
                  <span className="inline-block word-rise" style={{ animationDelay: `${delay + order * STAGGER}s` }}>
                    {/* line styling sits on its own span so its animations (e.g. spectrum-sweep) don't clash with the rise */}
                    {line.className ? <span className={line.className}>{word}</span> : word}
                  </span>
                </span>
                {wi < words.length - 1 && " "}
              </span>
            )
          })}
        </span>
      ))}
    </Tag>
  )
}
