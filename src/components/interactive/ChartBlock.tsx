"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion, useInView } from "motion/react"
import { BarChart3, Info, Table, TrendingUp } from "lucide-react"
import { dur, ease, spring, stagger } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface DataPoint {
  label: string
  twopc: number
  saga: number
  unit?: string
  /** Which direction is an improvement for this metric */
  better: "higher" | "lower"
}

interface ChartBlockProps {
  title?: string
  subtitle?: string
  data?: DataPoint[]
}

const defaultData: DataPoint[] = [
  { label: "Throughput", twopc: 420, saga: 3850, unit: "tx/s", better: "higher" },
  { label: "p99 latency", twopc: 240, saga: 18, unit: "ms", better: "lower" },
  { label: "Resource lock window", twopc: 180, saga: 12, unit: "ms", better: "lower" },
  { label: "Fault recovery time", twopc: 1200, saga: 95, unit: "ms", better: "lower" },
]

type SeriesKey = "twopc" | "saga"
const SERIES: { key: SeriesKey; label: string; bar: string; swatch: string }[] = [
  { key: "twopc", label: "2PC (blocking)", bar: "bg-[var(--fg-subtle)]", swatch: "bg-[var(--fg-subtle)]" },
  { key: "saga", label: "Saga (eventual)", bar: "bg-[var(--accent)]", swatch: "bg-[var(--accent)]" },
]

const fmt = (n: number) => n.toLocaleString("en-US")

function delta(row: DataPoint) {
  if (row.better === "higher") return `${(row.saga / row.twopc).toFixed(1)}× higher`
  return `${Math.round((1 - row.saga / row.twopc) * 100)}% lower`
}

export function ChartBlock({
  title = "Benchmark: Two-Phase Commit (2PC) vs. Orchestrated Saga",
  subtitle = "Measured across 5 microservices under 10,000 concurrent payment authorizations.",
  data = defaultData,
}: ChartBlockProps) {
  const [view, setView] = useState<"bars" | "table">("bars")
  const [shown, setShown] = useState<Record<SeriesKey, boolean>>({ twopc: true, saga: true })
  const listRef = useRef<HTMLUListElement>(null)
  const inView = useInView(listRef, { once: true, margin: "0px 0px -60px 0px" })

  const toggleSeries = (key: SeriesKey) =>
    setShown((s) => {
      const next = { ...s, [key]: !s[key] }
      return next.twopc || next.saga ? next : s // keep at least one series visible
    })

  return (
    <section className="not-prose panel p-5 sm:p-6 shadow-[var(--shadow)]" aria-label={title}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--border)]">
        <div className="min-w-0">
          <p className="meta flex items-center gap-1.5 hue-ink">
            <TrendingUp className="w-3.5 h-3.5" /> Benchmark
          </p>
          <h3 className="display text-[1.375rem] leading-[1.15] mt-2">{title}</h3>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">{subtitle}</p>
        </div>

        <div role="group" aria-label="Display as" className="flex items-center gap-1 p-1 rounded-full bg-[var(--surface)] self-start shrink-0">
          {(
            [
              ["bars", "Chart", BarChart3],
              ["table", "Data", Table],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium transition-colors",
                view === v ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              )}
            >
              {view === v && (
                <motion.span
                  layoutId={`chart-view-${title}`}
                  className="absolute inset-0 rounded-full bg-[var(--panel)] shadow-[var(--shadow)]"
                  transition={spring.snappy}
                />
              )}
              <Icon className="relative w-4 h-4" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {view === "bars" ? (
          <motion.div
            key="bars"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
            className="pt-5"
          >
            {/* Legend doubles as series toggles */}
            <div role="group" aria-label="Series" className="flex flex-wrap gap-2 mb-4">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={shown[s.key]}
                  onClick={() => toggleSeries(s.key)}
                  className={cn(
                    "inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-sm transition-colors",
                    shown[s.key]
                      ? "border-[var(--border-strong)] text-[var(--fg)]"
                      : "border-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full transition-opacity", s.swatch, !shown[s.key] && "opacity-30")} />
                  {s.label}
                </button>
              ))}
            </div>

            <ul ref={listRef} className="space-y-1">
              {data.map((row, rowIdx) => {
                const max = Math.max(shown.twopc ? row.twopc : 0, shown.saga ? row.saga : 0) || 1
                return (
                  <li key={row.label} className="p-3 -mx-3 rounded-[16px] hover:bg-[var(--bg-secondary)] transition-colors">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-2">
                      <span className="text-sm font-semibold">{row.label}</span>
                      <span className="text-xs text-[var(--fg-muted)]">
                        {row.better === "higher" ? "higher is better" : "lower is better"}
                        <span className="hue-ink font-medium"> · Saga {delta(row)}</span>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {SERIES.map((s) => {
                        const value = row[s.key]
                        const on = shown[s.key]
                        return (
                          <div key={s.key} className="flex items-center gap-3">
                            <div className="relative flex-1 h-3 rounded-full bg-[var(--surface)] overflow-hidden">
                              <motion.div
                                className={cn("absolute inset-0 rounded-full origin-left", s.bar)}
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: inView && on ? value / max : 0 }}
                                transition={{ duration: dur.slow, ease: ease.out, delay: rowIdx * stagger }}
                              />
                            </div>
                            <span
                              className={cn(
                                "w-[5.5rem] shrink-0 text-right font-mono text-xs tabular-nums transition-opacity",
                                on ? "text-[var(--fg-secondary)]" : "opacity-30"
                              )}
                            >
                              {fmt(value)} {row.unit}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
            className="pt-5 overflow-x-auto"
          >
            <table className="w-full min-w-[480px] text-sm text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="meta font-normal py-2.5 pr-3">Metric</th>
                  <th scope="col" className="meta font-normal py-2.5 px-3 text-right">2PC</th>
                  <th scope="col" className="meta font-normal py-2.5 px-3 text-right">Saga</th>
                  <th scope="col" className="meta font-normal py-2.5 pl-3 text-right">Saga vs 2PC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((row) => (
                  <tr key={row.label} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <th scope="row" className="py-3 pr-3 font-medium">{row.label}</th>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[var(--fg-muted)]">
                      {fmt(row.twopc)} {row.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {fmt(row.saga)} {row.unit}
                    </td>
                    <td className="py-3 pl-3 text-right font-medium hue-ink whitespace-nowrap">{delta(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 pt-4 border-t border-[var(--border)] flex items-start gap-2 text-xs text-[var(--fg-muted)]">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
        Source: distributed-systems test harness on AWS c6i.4xlarge nodes with Kafka 3.6.
      </p>
    </section>
  )
}
