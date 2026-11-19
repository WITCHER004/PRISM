"use client"

// Client-side article exports. Everything runs in the browser from the HTML already on the page:
// Markdown (.md, YAML frontmatter + the reader's private highlights), plain text (.txt), a
// self-contained offline HTML edition (.html, light/dark toggle) and a print-ready edition (→ PDF).

import type { PrivateHighlight } from "@/lib/highlights"

export interface ExportMeta {
  title: string
  subtitle?: string
  authorName: string
  authorHandle: string
  topic?: string
  publishedAt?: string
  /** AI-likelihood from Prism's verification (0–100), when known */
  aiVerificationScore?: number | null
  url: string
}

/* ── Sanitising + walking the body ───────────────────────────────────────── */

/** Parse the body and strip anything executable before it goes into a file */
function parseBody(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html")
  const root = doc.getElementById("root")!
  root.querySelectorAll("script, style, iframe, object, embed, form, input, button, noscript").forEach((n) => n.remove())
  root.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase()
      if (a.name.startsWith("on") || ((a.name === "href" || a.name === "src") && v.startsWith("javascript:")) || a.name.startsWith("data-")) {
        el.removeAttribute(a.name)
      }
    }
  })
  // Highlight marks painted on the page aren't part of the article
  root.querySelectorAll("mark[data-hl-id]").forEach((m) => m.replaceWith(...Array.from(m.childNodes)))
  return root
}

const collapse = (s: string) => s.replace(/[ \t\r\n ]+/g, " ")

function inlineMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return collapse(node.textContent ?? "").replace(/([*_`[\]])/g, "\\$1")
  if (node.nodeType !== Node.ELEMENT_NODE) return ""
  const el = node as HTMLElement
  const inner = () => Array.from(el.childNodes).map(inlineMd).join("")
  switch (el.tagName) {
    case "STRONG":
    case "B": {
      const t = inner().trim()
      return t ? `**${t}**` : ""
    }
    case "EM":
    case "I": {
      const t = inner().trim()
      return t ? `*${t}*` : ""
    }
    case "S":
    case "DEL":
      return `~~${inner()}~~`
    case "CODE":
      return "`" + (el.textContent ?? "").replace(/`/g, "\\`") + "`"
    case "A": {
      const href = el.getAttribute("href")
      return href ? `[${inner()}](${href})` : inner()
    }
    case "IMG":
      return `![${el.getAttribute("alt") ?? ""}](${el.getAttribute("src") ?? ""})`
    case "BR":
      return "  \n"
    default:
      return inner()
  }
}

function blocksMd(el: Element, depth = 0): string[] {
  const out: string[] = []
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = collapse(node.textContent ?? "").trim()
      if (t) out.push(t)
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const c = node as HTMLElement
    const text = () => inlineMd(c).trim()
    switch (c.tagName) {
      case "H1":
        out.push(`# ${text()}`)
        break
      case "H2":
        out.push(`## ${text()}`)
        break
      case "H3":
        out.push(`### ${text()}`)
        break
      case "H4":
      case "H5":
      case "H6":
        out.push(`#### ${text()}`)
        break
      case "P":
        if (text()) out.push(text())
        break
      case "BLOCKQUOTE":
        out.push(
          blocksMd(c, depth)
            .join("\n\n")
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n")
        )
        break
      case "PRE":
        out.push("```\n" + (c.textContent ?? "").replace(/\n$/, "") + "\n```")
        break
      case "UL":
      case "OL": {
        const items = Array.from(c.children).filter((li) => li.tagName === "LI")
        out.push(
          items
            .map((li, i) => {
              const marker = c.tagName === "OL" ? `${i + 1}.` : "-"
              const pad = "  ".repeat(depth)
              const own = Array.from(li.childNodes)
                .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes((n as Element).tagName)))
                .map(inlineMd)
                .join("")
                .trim()
              const nested = Array.from(li.children)
                .filter((n) => ["UL", "OL"].includes(n.tagName))
                .map((n) => blocksMd({ childNodes: [n] } as unknown as Element, depth + 1).join("\n"))
                .join("\n")
              return `${pad}${marker} ${own}${nested ? "\n" + nested : ""}`
            })
            .join("\n")
        )
        break
      }
      case "HR":
        out.push("---")
        break
      case "IMG":
        out.push(inlineMd(c))
        break
      case "FIGURE":
      case "DIV":
      case "SECTION":
        out.push(...blocksMd(c, depth))
        break
      default:
        if (text()) out.push(text())
    }
  }
  return out
}

function blocksText(el: Element): string[] {
  const out: string[] = []
  const walk = (parent: Element) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = collapse(node.textContent ?? "").trim()
        if (t) out.push(t)
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const c = node as HTMLElement
      const t = collapse(c.textContent ?? "").trim()
      switch (c.tagName) {
        case "H1":
        case "H2":
        case "H3":
        case "H4":
          if (t) out.push(t.toUpperCase())
          break
        case "UL":
        case "OL":
          out.push(
            Array.from(c.children)
              .map((li, i) => `${c.tagName === "OL" ? `${i + 1}.` : "  •"} ${collapse(li.textContent ?? "").trim()}`)
              .join("\n")
          )
          break
        case "BLOCKQUOTE":
          if (t) out.push(wrap(`“${t}”`, 72, "    "))
          break
        case "PRE":
          out.push(c.textContent ?? "")
          break
        case "HR":
          out.push("* * *")
          break
        case "DIV":
        case "SECTION":
        case "FIGURE":
          walk(c)
          break
        default:
          if (t) out.push(wrap(t, 72))
      }
    }
  }
  walk(el)
  return out
}

/** Hard-wrap a paragraph at `width` columns */
function wrap(text: string, width: number, indent = ""): string {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > width - indent.length) {
      lines.push(indent + line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(indent + line)
  return lines.join("\n")
}

const yamlStr = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
const dateOnly = (iso?: string) => (iso ? iso.slice(0, 10) : "")
const longDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""

/* ── Formats ──────────────────────────────────────────────────────────────── */

export function toMarkdown(meta: ExportMeta, html: string, highlights: PrivateHighlight[] = []): string {
  const front = [
    "---",
    `title: ${yamlStr(meta.title)}`,
    ...(meta.subtitle ? [`subtitle: ${yamlStr(meta.subtitle)}`] : []),
    `author: ${yamlStr(meta.authorName)}`,
    `authorHandle: ${yamlStr("@" + meta.authorHandle)}`,
    `topic: ${yamlStr(meta.topic ?? "")}`,
    `publishedAt: ${yamlStr(dateOnly(meta.publishedAt))}`,
    `aiVerificationScore: ${typeof meta.aiVerificationScore === "number" ? Math.round(meta.aiVerificationScore) : "null"}`,
    `source: ${yamlStr(meta.url)}`,
    "---",
  ].join("\n")

  const body = blocksMd(parseBody(html)).join("\n\n")
  const head = `# ${meta.title}${meta.subtitle ? `\n\n*${meta.subtitle}*` : ""}\n\nBy ${meta.authorName}${meta.publishedAt ? ` · ${longDate(meta.publishedAt)}` : ""}`

  const hl = highlights.length
    ? "\n\n---\n\n## My private highlights\n\n" +
      highlights
        .map((h) => {
          const quote = h.selectedText
            .trim()
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n")
          return `${quote}\n\n— Paragraph ${h.paragraphIndex + 1} · ${h.color}${h.personalNote ? `\n\n**Note:** ${h.personalNote}` : ""}`
        })
        .join("\n\n")
    : ""

  return `${front}\n\n${head}\n\n${body}${hl}\n`
}

export function toPlainText(meta: ExportMeta, html: string): string {
  const rule = "=".repeat(Math.min(72, Math.max(12, meta.title.length)))
  const head = [
    meta.title.toUpperCase(),
    rule,
    ...(meta.subtitle ? ["", wrap(meta.subtitle, 72)] : []),
    "",
    `By ${meta.authorName} (@${meta.authorHandle})`,
    [meta.topic, longDate(meta.publishedAt)].filter(Boolean).join(" · "),
    "",
    "",
  ].join("\n")
  const body = blocksText(parseBody(html)).join("\n\n")
  return `${head}${body}\n\n\n— Read on Prism: ${meta.url}\n`
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * A complete, standalone HTML edition. `print` → the distraction-free print layout that calls
 * window.print() on load; otherwise an offline reader with a light/dark toggle.
 */
export function toReaderHtml(meta: ExportMeta, html: string, opts: { print?: boolean } = {}): string {
  const body = parseBody(html).innerHTML
  const date = longDate(meta.publishedAt)
  const print = !!opts.print
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)} — ${esc(meta.authorName)}</title>
<meta name="author" content="${esc(meta.authorName)}">
<style>
  :root { --bg:#FAF8F5; --fg:#141413; --muted:#62626b; --line:#e7e4de; --accent:#b7791f; --quote:#f3f0ea; }
  [data-theme="dark"] { --bg:#141413; --fg:#f1f0ec; --muted:#a1a1aa; --line:#2b2a27; --accent:#e0a53a; --quote:#1d1c1a; }
  * { box-sizing: border-box; }
  html { background: var(--bg); color: var(--fg); }
  body { margin: 0; font-family: "Iowan Old Style", "Source Serif 4", Georgia, "Times New Roman", serif; font-size: 19px; line-height: 1.72; -webkit-font-smoothing: antialiased; transition: background .2s, color .2s; background: var(--bg); }
  main { max-width: 680px; margin: 0 auto; padding: 72px 24px 96px; }
  .kicker { font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
  h1.title { font-size: 2.6em; line-height: 1.05; letter-spacing: -0.015em; margin: .45em 0 .3em; font-weight: 600; }
  .subtitle { font-size: 1.22em; line-height: 1.4; color: var(--muted); margin: 0 0 1.2em; }
  .byline { font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; color: var(--muted); padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 2.4em; }
  .byline strong { color: var(--fg); font-weight: 600; }
  article h2 { font-size: 1.5em; line-height: 1.2; margin: 1.8em 0 .5em; }
  article h3 { font-size: 1.2em; margin: 1.6em 0 .4em; }
  article p { margin: 0 0 1.15em; }
  article a { color: inherit; text-decoration-color: var(--accent); text-underline-offset: 3px; }
  article blockquote { margin: 1.6em 0; padding: .2em 0 .2em 1.1em; border-left: 3px solid var(--accent); font-style: italic; color: var(--fg); }
  article pre { background: var(--quote); padding: 14px 16px; border-radius: 10px; overflow-x: auto; font-size: .78em; line-height: 1.5; }
  article code { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: .85em; }
  article img { max-width: 100%; height: auto; border-radius: 10px; }
  article hr { border: 0; text-align: center; margin: 2.2em 0; }
  article hr::after { content: "✦  ✦  ✦"; color: var(--muted); letter-spacing: .4em; font-size: .8em; }
  article ul, article ol { padding-left: 1.3em; }
  footer { margin-top: 4em; padding-top: 1.2em; border-top: 1px solid var(--line); font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; color: var(--muted); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .mark { font-family: Georgia, serif; font-weight: 600; letter-spacing: -.01em; color: var(--fg); }
  .toggle { position: fixed; top: 16px; right: 16px; font: 500 13px/1 ui-sans-serif, system-ui, sans-serif; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 9px 14px; cursor: pointer; }
  .watermark { display: none; }
  @media (max-width: 560px) { body { font-size: 17.5px; } main { padding-top: 64px; } h1.title { font-size: 2.1em; } }
  @media print {
    @page { margin: 22mm 20mm 24mm; }
    html, body { background: #fff !important; color: #111 !important; }
    body { font-size: 11.5pt; line-height: 1.6; }
    main { max-width: none; padding: 0; }
    .toggle { display: none !important; }
    h1.title { font-size: 26pt; }
    article h2, article h3 { break-after: avoid; }
    article p, article blockquote, article pre, article img { break-inside: avoid; }
    article a { text-decoration: none; }
    .watermark { display: block; position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font: 8pt ui-sans-serif, system-ui, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #9a9aa1; }
  }
</style>
</head>
<body>
${print ? "" : `<button class="toggle" type="button" onclick="var r=document.documentElement;var d=r.getAttribute('data-theme')==='dark';r.setAttribute('data-theme',d?'light':'dark');this.textContent=d?'☾ Dark':'☀ Light';">☾ Dark</button>`}
<main>
  ${meta.topic ? `<p class="kicker">${esc(meta.topic)}</p>` : ""}
  <h1 class="title">${esc(meta.title)}</h1>
  ${meta.subtitle ? `<p class="subtitle">${esc(meta.subtitle)}</p>` : ""}
  <div class="byline">By <strong>${esc(meta.authorName)}</strong> · @${esc(meta.authorHandle)}${date ? ` · ${esc(date)}` : ""}</div>
  <article>
${body}
  </article>
  <footer><span><span class="mark">✦ Prism</span> · Independent writing, read by humans</span><span>${esc(meta.url)}</span></footer>
</main>
<div class="watermark">✦ Prism · ${esc(meta.url)}</div>
${print ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},250)});window.addEventListener("afterprint",function(){window.close()});</script>` : ""}
</body>
</html>`
}

/* ── Delivery ─────────────────────────────────────────────────────────────── */

export function fileSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 60) || "prism-article"
  )
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Open the print edition in its own window and print it. If a popup blocker stops the window, fall
 * back to printing this page, which the global @media print rules strip down to the article.
 */
export function printEdition(meta: ExportMeta, html: string) {
  const w = window.open("", "_blank")
  if (!w) {
    window.print()
    return
  }
  w.document.open()
  w.document.write(toReaderHtml(meta, html, { print: true }))
  w.document.close()
}
