"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, ChevronDown, Copy, Eraser, Loader2, Play, RotateCcw, Terminal } from "lucide-react"
import { toast } from "@/lib/store"
import { copyText } from "@/components/posts/copyText"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface CodeSandboxProps {
  title?: string
  initialCode?: string
  language?: string
  description?: string
}

type Level = "log" | "info" | "warn" | "error" | "result"
interface Line {
  id: number
  level: Level
  text: string
}

const DEFAULT_CODE = `// Simulate a distributed transaction orchestrator
async function executePaymentSaga(orderId, amount) {
  console.log(\`[saga] Processing \${orderId} for $\${amount}\`);

  // Step 1: Reserve inventory
  console.log("→ Step 1: reserving inventory in Warehouse Service…");

  // Step 2: Authorize payment
  console.log("→ Step 2: charging card via payments API…");
  const paymentSuccess = amount < 500; // orders of $500+ fail

  if (!paymentSuccess) {
    console.warn("Payment declined: card limit exceeded.");
    console.log("← Compensating: releasing reserved inventory…");
    return { status: "COMPENSATED", orderId };
  }

  // Step 3: Emit fulfillment event
  console.log("→ Step 3: emitting OrderFulfilled event to Kafka.");
  return { status: "COMMITTED", orderId, tx: "tx_" + Math.random().toString(36).slice(2, 8) };
}

const results = [];
results.push(await executePaymentSaga("ORD-8921", 120));
results.push(await executePaymentSaga("ORD-8922", 750));
return results;`

const LEVEL_STYLE: Record<Level, string> = {
  log: "text-[var(--fg-secondary)]",
  info: "text-[var(--accent)]",
  warn: "text-[var(--warning)] bg-[var(--warning-subtle)]",
  error: "text-[var(--error)]",
  result: "hue-ink",
}
const LEVEL_PREFIX: Record<Level, string> = { log: "", info: "info ", warn: "warn ", error: "error ", result: "⇐ " }

function show(v: unknown): string {
  if (typeof v === "string") return v
  if (v instanceof Error) return `${v.name}: ${v.message}`
  try {
    return JSON.stringify(v, null, 2) ?? String(v)
  } catch {
    return String(v)
  }
}

// Runs the snippet in-page (new Function, async wrapper) with console calls captured into the panel.
// Not a security sandbox — fine for an author's own demo code; untrusted code would need a worker/iframe.
export function CodeSandboxBlock({
  title = "Distributed Saga Orchestrator Simulation",
  language = "javascript",
  description = "Edit the code and run it to see how a saga compensates when a step fails.",
  initialCode = DEFAULT_CODE,
}: CodeSandboxProps) {
  const [code, setCode] = useState(initialCode)
  const [output, setOutput] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [lastRun, setLastRun] = useState<{ ok: boolean; ms: number } | null>(null)
  const seq = useRef(0)
  const outRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Keep the newest output in view
  useEffect(() => {
    const el = outRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output])

  const run = async () => {
    if (running) return
    setRunning(true)
    setConsoleOpen(true)
    const lines: Line[] = []
    const push = (level: Level, args: unknown[]) => lines.push({ id: ++seq.current, level, text: args.map(show).join(" ") })
    const captured = {
      log: (...a: unknown[]) => push("log", a),
      info: (...a: unknown[]) => push("info", a),
      warn: (...a: unknown[]) => push("warn", a),
      error: (...a: unknown[]) => push("error", a),
      debug: (...a: unknown[]) => push("log", a),
      table: (...a: unknown[]) => push("log", a),
    }

    const started = performance.now()
    let ok = true
    try {
      const fn = new Function("console", `"use strict"; return (async () => {\n${code}\n})()`) as (c: typeof captured) => Promise<unknown>
      const result = await fn(captured)
      if (result !== undefined) push("result", [result])
    } catch (err) {
      ok = false
      push("error", [err instanceof Error ? `${err.name}: ${err.message}` : err])
    }
    const ms = Math.round(performance.now() - started)
    if (!lines.length) lines.push({ id: ++seq.current, level: "info", text: "Finished with no output." })

    // A short beat so the run reads as a run, even when the code is instant
    timers.current.push(
      setTimeout(() => {
        setOutput(lines)
        setLastRun({ ok, ms })
        setRunning(false)
      }, 350)
    )
  }

  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true)
      toast("Code copied", { tone: "success" })
      timers.current.push(setTimeout(() => setCopied(false), 1800))
    } else {
      toast("Couldn’t copy the code", { tone: "error" })
    }
  }

  const reset = () => {
    setCode(initialCode)
    setOutput([])
    setLastRun(null)
    toast("Code reset")
  }

  const iconBtn =
    "grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
  const edited = code !== initialCode

  return (
    <section className="not-prose panel overflow-hidden shadow-[var(--shadow)]" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--border)]">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-full hue-wash hue-ink shrink-0">
            <Terminal className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{title}</p>
            <p className="meta">
              {language}
              {edited && " · edited"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={reset} disabled={!edited && !output.length} className={iconBtn} aria-label="Reset code" title="Reset code">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button type="button" onClick={copy} className={iconBtn} aria-label={copied ? "Code copied" : "Copy code"} title="Copy code">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "y" : "n"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: dur.fast }}
              >
                {copied ? <Check className="w-4 h-4 text-[var(--accent)]" /> : <Copy className="w-4 h-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={run}
            disabled={running}
            aria-busy={running}
            className="ml-1 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-70"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {running ? "Running…" : "Run"}
          </motion.button>
        </div>
      </div>

      {description && <p className="px-4 sm:px-5 py-2.5 text-sm text-[var(--fg-muted)] border-b border-[var(--border)]">{description}</p>}

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            run()
          }
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={`${title} — code editor (Ctrl+Enter to run)`}
        className="block w-full h-64 px-4 sm:px-5 py-4 font-mono text-[0.8125rem] leading-relaxed bg-[var(--bg-secondary)] text-[var(--fg)] outline-none resize-y border-0 focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]"
        style={{ tabSize: 2 }}
      />

      <div className="border-t border-[var(--border)]">
        <div className="flex items-center justify-between pl-2 pr-2 sm:pr-3">
          <button
            type="button"
            onClick={() => setConsoleOpen((o) => !o)}
            aria-expanded={consoleOpen}
            className="flex items-center gap-2 h-11 px-3 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <motion.span animate={{ rotate: consoleOpen ? 0 : -90 }} transition={{ duration: dur.fast }} className="inline-flex">
              <ChevronDown className="w-4 h-4" />
            </motion.span>
            Console
            {output.length > 0 && <span className="meta">{output.length} lines</span>}
          </button>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {lastRun && (
                <motion.span
                  key={`${lastRun.ok}-${lastRun.ms}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: dur.fast } }}
                  className={cn("meta normal-case tracking-normal", lastRun.ok ? "" : "text-[var(--error)]")}
                >
                  {lastRun.ok ? "Done" : "Failed"} in {lastRun.ms}ms
                </motion.span>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => {
                setOutput([])
                setLastRun(null)
              }}
              disabled={!output.length}
              className={iconBtn}
              aria-label="Clear console"
              title="Clear console"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {consoleOpen && (
            <motion.div
              key="console"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.base } }}
              exit={{ opacity: 0, transition: { duration: dur.fast } }}
            >
              <div
                ref={outRef}
                role="log"
                aria-live="polite"
                className="max-h-56 overflow-y-auto px-4 sm:px-5 pb-4 font-mono text-[0.8125rem] leading-relaxed"
              >
                {output.length === 0 ? (
                  <p className="py-2 text-[var(--fg-subtle)]">
                    {running ? "Running…" : "Press Run (or Ctrl+Enter in the editor) to execute the code in your browser."}
                  </p>
                ) : (
                  output.map((line, i) => (
                    <motion.pre
                      key={line.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0, transition: { duration: dur.base, ease: ease.out, delay: Math.min(i, 12) * 0.03 } }}
                      className={cn("whitespace-pre-wrap break-words px-2 -mx-2 py-0.5 rounded-md", LEVEL_STYLE[line.level])}
                    >
                      {LEVEL_PREFIX[line.level] && <span className="opacity-60">{LEVEL_PREFIX[line.level]}</span>}
                      {line.text}
                    </motion.pre>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
