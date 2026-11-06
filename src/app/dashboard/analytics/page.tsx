"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { ArrowDownRight, ArrowUpRight, BookOpenCheck, Clock, Eye, UserPlus } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { PageHead, SampleBadge, samplePostsFor, seeded, useWriter } from "@/components/studio/studio-ui"
import { MOCK_POSTS } from "@/lib/data"
import { hueStyle } from "@/lib/topics"
import { dur, ease, spring } from "@/lib/motion"
import { cn, numberWithCommas } from "@/lib/utils"

type Range = 7 | 30 | 90
const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
]

const DAY = 86_400_000
const HISTORY = 180

interface DayPoint {
  date: Date
  reads: number
  minutes: number
  follows: number
}

// One deterministic 180-day history; each range shows its window and compares to the one before
function buildHistory(): DayPoint[] {
  const rand = seeded(42)
  const end = Math.floor(Date.now() / DAY) * DAY
  const out: DayPoint[] = []
  for (let i = HISTORY - 1; i >= 0; i--) {
    const date = new Date(end - i * DAY)
    const t = (HISTORY - i) / HISTORY
    const weekday = date.getUTCDay()
    const weekly = weekday === 0 || weekday === 6 ? 0.72 : 1 + (weekday === 2 ? 0.12 : 0)
    const spike = rand() > 0.94 ? 1.9 + rand() * 1.4 : 1
    const reads = Math.round((1150 + 900 * t) * weekly * spike * (0.85 + rand() * 0.3))
    out.push({
      date,
      reads,
      minutes: Math.round(reads * (5.4 + rand() * 1.6)),
      follows: Math.round(reads * (0.011 + rand() * 0.008)),
    })
  }
  return out
}

const SOURCES = [
  { name: "Prism home feed", base: 38 },
  { name: "Search", base: 21 },
  { name: "Newsletter", base: 16 },
  { name: "Hacker News", base: 12 },
  { name: "X / Twitter", base: 8 },
  { name: "Direct link", base: 5 },
]

const fmtDay = (d: Date, long = false) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(long ? { weekday: "short" } : {}), timeZone: "UTC" })

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30)
  // Server HTML renders everything at rest; entrance animations only run once we're on the client
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const history = useMemo(buildHistory, [])
  const { user } = useWriter()

  const current = history.slice(-range)
  const previous = history.slice(-range * 2, -range)
  const sum = (arr: DayPoint[], k: keyof Omit<DayPoint, "date">) => arr.reduce((a, d) => a + d[k], 0)

  const kpis = [
    { label: "Reads", icon: Eye, now: sum(current, "reads"), before: sum(previous, "reads"), fmt: numberWithCommas },
    { label: "Read time", icon: Clock, now: sum(current, "minutes"), before: sum(previous, "minutes"), fmt: (n: number) => `${numberWithCommas(Math.round(n / 60))} h` },
    {
      label: "Avg. completion",
      icon: BookOpenCheck,
      now: 68 + (range === 7 ? 6.4 : range === 30 ? 4.2 : 2.1),
      before: 68 + (range === 7 ? 3.1 : range === 30 ? 2.6 : 1.8),
      fmt: (n: number) => `${n.toFixed(1)}%`,
    },
    { label: "New followers", icon: UserPlus, now: sum(current, "follows"), before: sum(previous, "follows"), fmt: numberWithCommas },
  ]

  // Story ranking for the window: each story's share of reads (its lifetime views as weight)
  const stories = useMemo(() => {
    const mine = samplePostsFor(user.username)
    const pool = mine.length >= 3 ? mine : [...mine, ...MOCK_POSTS.filter((p) => !mine.includes(p))].slice(0, 5)
    const rand = seeded(range * 7)
    const weights = pool.map((p) => p.viewCount * (0.6 + rand() * 0.8))
    const total = weights.reduce((a, b) => a + b, 0)
    const reads = sum(current, "reads")
    return pool
      .map((p, i) => ({ post: p, reads: Math.round((weights[i] / total) * reads), mine: mine.includes(p) }))
      .sort((a, b) => b.reads - a.reads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, user.username, history])

  const sources = useMemo(() => {
    const rand = seeded(range * 13)
    const raw = SOURCES.map((s) => ({ ...s, v: s.base * (0.8 + rand() * 0.4) }))
    const total = raw.reduce((a, s) => a + s.v, 0)
    return raw.map((s) => ({ name: s.name, pct: (s.v / total) * 100 })).sort((a, b) => b.pct - a.pct)
  }, [range])

  return (
    <>
      <PageHead
        title="Analytics"
        lede="Reads, real attention and where readers find you — measured by time actually spent reading."
        actions={
          <>
            <SampleBadge />
            <div role="radiogroup" aria-label="Date range" className="flex items-center p-1 rounded-full bg-[var(--panel)] border border-[var(--border)]">
              {RANGES.map((r) => {
                const active = range === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRange(r.value)}
                    className={cn(
                      "relative h-10 px-4 rounded-full text-sm font-medium transition-colors",
                      active ? "text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    )}
                  >
                    {active && (
                      <motion.span layoutId="analytics-range" className="absolute inset-0 rounded-full bg-[var(--fg)]" transition={spring.snappy} />
                    )}
                    <span className="relative">{r.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        }
      />

      <section aria-label="Key numbers" className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const change = k.before ? ((k.now - k.before) / k.before) * 100 : 0
          const up = change >= 0
          const Icon = k.icon
          return (
            <div key={k.label} className="panel p-5">
              <div className="flex items-center justify-between">
                <p className="meta">{k.label}</p>
                <Icon className="w-4 h-4 text-[var(--fg-subtle)]" />
              </div>
              <motion.p
                key={`${k.label}-${range}`}
                initial={mounted ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base, ease: ease.out }}
                className="display mt-4 text-[2rem] tabular-nums"
              >
                {k.fmt(k.now)}
              </motion.p>
              <p className="mt-2 flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-[var(--accent)]" : "text-[var(--error)]")}>
                  {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(change).toFixed(1)}%
                </span>
                vs previous {range} days
              </p>
            </div>
          )
        })}
      </section>

      <Reveal as="section" className="mt-6 panel p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="display text-[1.5rem]">Daily reads</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              {fmtDay(current[0].date)} – {fmtDay(current[current.length - 1].date)}
            </p>
          </div>
          <p className="meta">Peak {numberWithCommas(Math.max(...current.map((d) => d.reads)))} reads</p>
        </div>
        {mounted ? (
          <ReadsChart key={range} data={current} />
        ) : (
          <div className="mt-6 ml-12 h-60 rounded-[14px] bg-[var(--surface)] opacity-60" aria-hidden />
        )}
      </Reveal>

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        <Reveal as="section" className="lg:col-span-3 panel p-5 sm:p-7">
          <h2 className="display text-[1.5rem]">Top stories</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Reads in the last {range} days</p>
          <ol className="mt-6 space-y-5">
            {stories.map((s, i) => {
              const max = stories[0].reads || 1
              return (
                <li key={s.post.id} style={hueStyle(s.post.tags[0]?.slug)}>
                  <div className="flex items-baseline justify-between gap-4">
                    <Link
                      href={`/${s.post.author.username}/${s.post.slug}`}
                      className="min-w-0 text-sm font-medium line-clamp-1 hover:underline underline-offset-2"
                    >
                      <span className="meta mr-2">{String(i + 1).padStart(2, "0")}</span>
                      {s.post.title}
                    </Link>
                    <span className="shrink-0 text-sm tabular-nums font-semibold">{numberWithCommas(s.reads)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[var(--surface)] overflow-hidden" aria-hidden>
                    <motion.div
                      key={`${s.post.id}-${range}`}
                      className="h-full rounded-full hue-dot origin-left"
                      style={{ width: `${(s.reads / max) * 100}%` }}
                      initial={mounted ? { scaleX: 0 } : false}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: dur.slow, ease: ease.out, delay: i * 0.06 }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        </Reveal>

        <Reveal as="section" index={1} className="lg:col-span-2 panel p-5 sm:p-7">
          <h2 className="display text-[1.5rem]">Where readers come from</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Share of reads by referrer</p>
          <ul className="mt-6 space-y-4">
            {sources.map((s, i) => (
              <li key={s.name}>
                <div className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="tabular-nums font-semibold">{s.pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[var(--surface)] overflow-hidden" aria-hidden>
                  <motion.div
                    key={`${s.name}-${range}`}
                    className="h-full rounded-full bg-[var(--accent)] origin-left"
                    style={{ width: `${(s.pct / sources[0].pct) * 100}%` }}
                    initial={mounted ? { scaleX: 0 } : false}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: dur.slow, ease: ease.out, delay: i * 0.05 }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </>
  )
}

function ReadsChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.reads))
  const top = Math.ceil(max / 1000) * 1000
  const ticks = [top, top / 2, 0]
  const labelEvery = data.length <= 7 ? 1 : data.length <= 30 ? 7 : 15
  const total = data.reduce((a, d) => a + d.reads, 0)
  const gap = data.length > 40 ? "gap-px" : data.length > 10 ? "gap-[3px]" : "gap-2"

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - r.left) / r.width) * data.length)
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  const h = hover !== null ? data[hover] : null

  return (
    <div className="mt-6">
      <div className="flex">
        {/* y axis */}
        <div className="w-12 shrink-0 relative h-60 text-right pr-3" aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className="meta absolute right-3 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {numberWithCommas(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 h-60">
          {ticks.map((t, i) => (
            <div
              key={t}
              aria-hidden
              className={cn("absolute inset-x-0 border-t", i === ticks.length - 1 ? "border-[var(--border-strong)]" : "border-dashed border-[var(--border)]")}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}

          <div
            role="img"
            aria-label={`Daily reads bar chart, ${data.length} days, ${numberWithCommas(total)} reads in total, peak ${numberWithCommas(max)}.`}
            className={cn("absolute inset-0 flex items-end cursor-crosshair touch-none", gap)}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {data.map((d, i) => (
              <div key={i} className="relative flex-1 h-full flex items-end">
                <motion.div
                  className={cn(
                    "w-full origin-bottom rounded-t-[4px] transition-colors",
                    hover === null || hover === i ? "bg-[var(--accent)]" : "bg-[var(--accent-subtle)]"
                  )}
                  style={{ height: `${(d.reads / top) * 100}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: dur.slow, ease: ease.out, delay: Math.min(i * (0.5 / data.length), 0.5) }}
                />
              </div>
            ))}
          </div>

          {h && hover !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full panel shadow-[var(--shadow-lift)] px-3 py-2 whitespace-nowrap"
              style={{
                left: `clamp(60px, ${((hover + 0.5) / data.length) * 100}%, calc(100% - 60px))`,
                top: `calc(${100 - (h.reads / top) * 100}% - 8px)`,
              }}
            >
              <p className="meta">{fmtDay(h.date, true)}</p>
              <p className="text-sm font-semibold tabular-nums">{numberWithCommas(h.reads)} reads</p>
              <p className="text-xs text-[var(--fg-muted)] tabular-nums">{numberWithCommas(h.minutes)} min read</p>
            </div>
          )}
        </div>
      </div>

      {/* x axis */}
      <div className="ml-12 mt-2 relative h-4" aria-hidden>
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <span
              key={i}
              className="meta absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
            >
              {fmtDay(d.date)}
            </span>
          ) : null
        )}
      </div>

      <details className="mt-6 group">
        <summary className="inline-flex items-center h-10 px-4 rounded-full border border-[var(--border)] text-sm font-medium cursor-pointer hover:border-[var(--border-strong)] transition-colors list-none">
          <span className="group-open:hidden">Show as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div className="mt-4 max-h-72 overflow-y-auto rounded-[14px] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--panel)]">
              <tr className="text-left">
                <th className="meta font-normal px-4 py-2.5">Date</th>
                <th className="meta font-normal px-4 py-2.5 text-right">Reads</th>
                <th className="meta font-normal px-4 py-2.5 text-right">Minutes</th>
                <th className="meta font-normal px-4 py-2.5 text-right">New followers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[...data].reverse().map((d) => (
                <tr key={d.date.toISOString()}>
                  <td className="px-4 py-2">{fmtDay(d.date, true)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.reads.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.minutes.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.follows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
