/**
 * Benchmark + per-domain calibration for the in-app heuristic detector (the fallback used when the
 * ML engine isn't configured). Uses the same data and split as scripts/eval_detectors.py.
 *
 *   python scripts/fetch_benchmarks.py          # once
 *   npx tsx scripts/detector-benchmark.ts       # report + write src/lib/moderation/heuristic_calibration.json
 *   npx tsx scripts/detector-benchmark.ts --report-only
 *
 * Tuning: for each domain, the temperature/bias that maximises F1 on the calibration half while
 * keeping FPR at the 20% threshold under the target (default 1.5%). Results are on the test half.
 */
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { calibrated, windowLogits } from "../src/lib/moderation/heuristics"
import { prepareText, DETECTOR_DOMAINS } from "../src/lib/moderation/textPrep"
import current from "../src/lib/moderation/heuristic_calibration.json"

const ROOT = join(__dirname, "..")
const DATA = join(ROOT, "ai_plagiarism_engine", "benchmarks", "data")
const OUT = join(ROOT, "src", "lib", "moderation", "heuristic_calibration.json")
const THRESHOLD = 20
const args = process.argv.slice(2)
const reportOnly = args.includes("--report-only")
const targetFpr = Number(args.find((a) => a.startsWith("--target-fpr="))?.split("=")[1] ?? 0.015)
const MIN_HUMANS = 12
/** Calibration humans' p95 must sit this far under the threshold, so the setting generalises */
const HEADROOM = 5

interface Sample { id: string; text: string; label: 0 | 1; domain: string; source: string; attack: string; audit: boolean }
interface Doc extends Sample { split: "calib" | "test"; z: number[]; a: number[] }
type Cal = { temperature: number; bias: number }

const samples: Sample[] = readdirSync(DATA)
  .filter((f) => f.endsWith(".jsonl") && f !== "plagiarism_pairs.jsonl")
  .flatMap((f) => readFileSync(join(DATA, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Sample))

const seen = new Set<string>()
const docs: Doc[] = []
for (const s of samples) {
  if (seen.has(s.id)) continue
  seen.add(s.id)
  const { windows, lens } = windowLogits(prepareText(s.text).prose)
  if (!windows.length) continue
  const cnt = lens.map(() => 0)
  for (const w of windows) for (let i = w.a; i < w.b; i++) cnt[i]++
  const tw = lens.reduce((x, y) => x + y, 0) || 1
  const a = windows.map((w) => {
    let t = 0
    for (let i = w.a; i < w.b; i++) if (cnt[i]) t += lens[i] / (cnt[i] * tw)
    return t
  })
  // Same split as eval_detectors.py: md5(id) parity
  const split = BigInt("0x" + createHash("md5").update(s.id).digest("hex")) % BigInt(2) === BigInt(0) ? "calib" : "test"
  docs.push({ ...s, domain: (DETECTOR_DOMAINS as readonly string[]).includes(s.domain) ? s.domain : "general", split, z: windows.map((w) => w.z), a })
}

const score = (d: Doc, c: Cal) => 100 * d.z.reduce((acc, z, i) => acc + d.a[i] * calibrated(z, c), 0)

function metrics(ds: Doc[], sc: (d: Doc) => number) {
  let tp = 0, fp = 0, fn = 0, tn = 0
  const hs: number[] = []
  for (const d of ds) {
    const s = sc(d)
    if (d.label === 1) s > THRESHOLD ? tp++ : fn++
    else {
      hs.push(s)
      s > THRESHOLD ? fp++ : tn++
    }
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : NaN
  hs.sort((x, y) => x - y)
  return {
    humans: fp + tn,
    ai: tp + fn,
    precision,
    recall,
    f1: tp ? (2 * precision * recall) / (precision + recall) : 0,
    fpr: fp + tn ? fp / (fp + tn) : NaN,
    humanP95: hs.length ? hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.95))] : NaN,
  }
}

const temps = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3]
const biases = Array.from({ length: 81 }, (_, i) => -6 + i * 0.1)
function tune(ds: Doc[]): Cal | null {
  let best: { key: [number, number]; c: Cal } | null = null
  for (const temperature of temps)
    for (const bias of biases) {
      const c = { temperature, bias: Math.round(bias * 100) / 100 }
      const m = metrics(ds, (d) => score(d, c))
      if (!(m.fpr <= targetFpr) || !(m.humanP95 <= THRESHOLD - HEADROOM)) continue
      const key: [number, number] = [m.f1, -m.humanP95]
      if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && key[1] > best.key[1])) best = { key, c }
    }
  return best?.c ?? null
}

const calib = docs.filter((d) => d.split === "calib")
const test = docs.filter((d) => d.split === "test")
const domains = (current as { domains: Record<string, Cal> }).domains
let cal: Record<string, Cal & { n_human?: number; n_ai?: number; source?: string }> = { ...domains }
if (!reportOnly) {
  const global = tune(calib)
  if (!global) throw new Error("No setting meets the FPR target on the calibration half.")
  cal = {}
  for (const dom of DETECTOR_DOMAINS) {
    const sub = calib.filter((d) => d.domain === dom)
    const nH = sub.filter((d) => d.label === 0).length
    const nA = sub.length - nH
    let entry: Cal & { n_human: number; n_ai: number; source: string } = { ...global, n_human: nH, n_ai: nA, source: "global" }
    if (nH >= MIN_HUMANS && nA >= 5) {
      const t = tune(sub)
      if (t) {
        // Shrink toward global with little data, but never less conservative than the domain's own FPR-safe bias
        const k = Math.min(1, nH / (MIN_HUMANS * 3))
        const shrunk = k * t.bias + (1 - k) * global.bias
        entry = { temperature: t.temperature, bias: Math.round(Math.min(t.bias, shrunk) * 1000) / 1000, n_human: nH, n_ai: nA, source: `tuned (shrinkage ${k.toFixed(2)})` }
      }
    }
    cal[dom] = entry
  }
}
const sc = (d: Doc) => score(d, cal[d.domain] ?? cal.general)

const pct = (x: number) => (Number.isNaN(x) ? "–" : `${(x * 100).toFixed(1)}%`)
function row(name: string, ds: Doc[]) {
  const m = metrics(ds, sc)
  return `| ${name} | ${m.humans} | ${m.ai} | ${m.precision.toFixed(3)} | ${Number.isNaN(m.recall) ? "–" : m.recall.toFixed(3)} | ${m.f1.toFixed(3)} | ${pct(m.fpr)} | ${Number.isNaN(m.humanP95) ? "–" : m.humanP95.toFixed(1)} |`
}
const groups = (ds: Doc[], key: (d: Doc) => string) => {
  const g = new Map<string, Doc[]>()
  ds.forEach((d) => g.set(key(d), [...(g.get(key(d)) ?? []), d]))
  return [...g.entries()].sort(([x], [y]) => x.localeCompare(y))
}
const head = "| group | humans | AI | precision | recall | F1 | FPR | human p95 |\n|---|---|---|---|---|---|---|---|"
const lines = [
  `# Heuristic detector benchmark (test half, threshold ${THRESHOLD}%, target FPR ${(targetFpr * 100).toFixed(1)}%)`,
  "",
  head,
  row("all", test),
  ...groups(test.filter((d) => !d.audit), (d) => d.domain).map(([k, v]) => row(`domain: ${k}`, v)),
  ...groups(test.filter((d) => d.audit), (d) => d.source).map(([k, v]) => row(k, v)),
  ...groups(test, (d) => d.source).filter(([k]) => !k.startsWith("Audit")).map(([k, v]) => row(k, v)),
  ...groups(test.filter((d) => d.label === 1), (d) => `attack: ${d.attack}`).map(([k, v]) => row(k, v)),
]
console.log(lines.join("\n"))
writeFileSync(join(ROOT, "ai_plagiarism_engine", "benchmarks", "HEURISTIC_REPORT.md"), lines.join("\n") + "\n")
if (!reportOnly) {
  writeFileSync(OUT, JSON.stringify({ version: new Date().toISOString().slice(0, 10) + "-bench", targetFpr, threshold: THRESHOLD, domains: cal }, null, 2) + "\n")
  console.log(`\nwrote ${OUT}`)
}
