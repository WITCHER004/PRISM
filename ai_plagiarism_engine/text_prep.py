"""
Text preparation shared by the AI detector and the plagiarism pipeline.

What it does, in order:
  1. Strips code: fenced ``` blocks, <pre>/<code> HTML, and `inline code`. Code has very low token
     entropy and would read as "machine-like" to every prose detector.
  2. Excludes quotations the author attributes to someone else: markdown blockquotes (> ...),
     <blockquote> HTML, and quoted spans of 6+ words with an attribution ("said", "according to",
     "(Smith, 2019)", "[3]", "— Name"). They are not the author's prose, so they count toward neither
     the AI score nor plagiarism.
  3. Splits the remaining prose into paragraphs and sentences.
  4. Detects the writing domain from the author's topic tag (when given) or from the vocabulary.
"""
from __future__ import annotations

import html as _html
import re
from dataclasses import dataclass, field

# --- Code ---------------------------------------------------------------------------------------
_FENCE = re.compile(r"(^|\n)\s*(```|~~~)[^\n]*\n.*?(\n\s*\2[^\n]*(?=\n|$)|$)", re.S)
_HTML_PRE = re.compile(r"<pre\b[^>]*>.*?</pre>", re.S | re.I)
_HTML_CODE = re.compile(r"<code\b[^>]*>.*?</code>", re.S | re.I)
_INLINE_CODE = re.compile(r"`[^`\n]{1,200}`")
# Lines that are clearly code even without fences (indented 4+ spaces and full of symbols)
_CODE_LINE = re.compile(r"^(?: {4,}|\t)\S.*$|^.*[;{}]\s*$|^\s*(?:def|class|import|from|const|let|var|function|return|if|for|while)\b.*[:({=].*$", re.M)

# --- Quotes and citations -------------------------------------------------------------------------
_HTML_BLOCKQUOTE = re.compile(r"<blockquote\b[^>]*>.*?</blockquote>", re.S | re.I)
_MD_BLOCKQUOTE = re.compile(r"^[ \t]*>.*$", re.M)
_QUOTED_SPAN = re.compile(r"[\"“]([^\"”]{25,600})[\"”]")
_ATTRIBUTION = re.compile(
    r"\b(?:said|says|wrote|writes|argued|argues|noted|notes|observed|observes|according to|as .{1,40}? put it|in the words of|told|asked|explained|stated|states|claims|claimed)\b"
    r"|\(\s*[A-Z][A-Za-z\-]+(?: et al\.)?(?:,| and [A-Z][A-Za-z\-]+,)?\s*\d{4}[a-z]?(?:,\s*p+\.\s*\d+)?\s*\)"
    r"|\[\d{1,3}(?:[,–-]\s*\d{1,3})*\]"
    r"|[—–-]{1,2}\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}\s*$",
)

_TAGS = re.compile(r"<[^>]+>")
_WORD = re.compile(r"[^\W_]+(?:['’][^\W_]+)?(?:-[^\W_]+)*", re.U)
_SENT_SPLIT = re.compile(r"(?<=[.!?…])[\"”’)\]]?\s+(?=[\"“‘(\[]?[A-Z0-9])")


def words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def split_sentences(text: str) -> list[str]:
    out: list[str] = []
    for para in re.split(r"\n+", text):
        para = re.sub(r"\s+", " ", para).strip()
        if not para:
            continue
        # Headings and list items without terminal punctuation are their own sentence
        for s in _SENT_SPLIT.split(para):
            s = s.strip()
            if words(s):
                out.append(s)
    return out


def split_paragraphs(text: str, min_chars: int = 40) -> list[str]:
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n|\n(?=\S)", text)]
    paras = [p for p in paras if p]
    # Merge very short fragments (headings, one-liners) into the following paragraph
    merged: list[str] = []
    carry = ""
    for p in paras:
        p = f"{carry} {p}".strip() if carry else p
        if len(p) < min_chars:
            carry = p
            continue
        merged.append(p)
        carry = ""
    if carry:
        if merged:
            merged[-1] = f"{merged[-1]} {carry}"
        else:
            merged.append(carry)
    return merged


def html_to_text(raw: str) -> str:
    """Editor HTML → markdown-ish text that keeps code fences and blockquote markers."""
    if "<" not in raw or not re.search(r"<(p|div|br|h\d|li|pre|code|blockquote)\b", raw, re.I):
        return raw
    t = re.sub(r"<pre\b[^>]*>(.*?)</pre>", lambda m: "\n```\n" + _TAGS.sub("", m.group(1)) + "\n```\n", raw, flags=re.S | re.I)
    t = re.sub(r"<code\b[^>]*>(.*?)</code>", lambda m: "`" + _TAGS.sub("", m.group(1)).replace("`", "'") + "`", t, flags=re.S | re.I)
    t = re.sub(r"<blockquote\b[^>]*>(.*?)</blockquote>", lambda m: "\n" + "\n".join("> " + ln for ln in _TAGS.sub("\n", m.group(1)).splitlines() if ln.strip()) + "\n", t, flags=re.S | re.I)
    t = re.sub(r"</(p|h[1-6]|li|div)>|<br\s*/?>", "\n", t, flags=re.I)
    t = _TAGS.sub(" ", t)
    return _html.unescape(t)


@dataclass
class Prepared:
    original_words: int
    prose: str
    paragraphs: list[str]
    sentences: list[str]
    prose_words: int
    code_blocks: int = 0
    code_chars: int = 0
    excluded_quotes: list[str] = field(default_factory=list)

    @property
    def code_ratio(self) -> float:
        total = self.code_chars + len(self.prose)
        return self.code_chars / total if total else 0.0


def prepare(raw: str) -> Prepared:
    text = html_to_text(raw or "")
    original_words = len(words(_TAGS.sub(" ", text)))

    code_chars = 0
    code_blocks = 0

    def _drop_code(m: re.Match) -> str:
        nonlocal code_chars, code_blocks
        code_chars += len(m.group(0))
        code_blocks += 1
        return "\n\n"

    text = _FENCE.sub(_drop_code, text)
    text = _HTML_PRE.sub(_drop_code, text)
    text = _HTML_CODE.sub(_drop_code, text)

    def _drop_inline(m: re.Match) -> str:
        nonlocal code_chars
        code_chars += len(m.group(0))
        return "CODE"  # keeps the sentence grammatical without the code's tokens

    text = _INLINE_CODE.sub(_drop_inline, text)

    # Unfenced code lines (only when several sit together, so prose ending in ";" is safe)
    lines = text.split("\n")
    kept: list[str] = []
    run: list[str] = []
    for ln in lines + [""]:
        if ln.strip() and _CODE_LINE.match(ln) and _symbol_heavy(ln):
            run.append(ln)
            continue
        if len(run) >= 3:
            code_chars += sum(len(r) for r in run)
            code_blocks += 1
        else:
            kept.extend(run)
        run = []
        kept.append(ln)
    text = "\n".join(kept[:-1])

    excluded: list[str] = []

    def _drop_quote(m: re.Match) -> str:
        q = _TAGS.sub(" ", m.group(0)).strip().lstrip(">").strip()
        if q:
            excluded.append(q)
        return "\n\n"

    text = _HTML_BLOCKQUOTE.sub(_drop_quote, text)
    text = _MD_BLOCKQUOTE.sub(_drop_quote, text)
    text = _TAGS.sub(" ", text)
    text = _html.unescape(text)

    # Attributed inline quotations: drop the quoted words, keep the author's framing sentence
    out_paras = []
    for para in re.split(r"\n\s*\n", text):
        new_sents = []
        for s in split_sentences(para):
            if _ATTRIBUTION.search(s):
                def _q(m: re.Match) -> str:
                    if len(words(m.group(1))) >= 6:
                        excluded.append(m.group(1).strip())
                        return "“…”"
                    return m.group(0)
                s = _QUOTED_SPAN.sub(_q, s)
            new_sents.append(s)
        if new_sents:
            out_paras.append(" ".join(new_sents))
    prose = "\n\n".join(out_paras)
    paragraphs = split_paragraphs(prose)
    sentences = split_sentences(prose)
    return Prepared(
        original_words=original_words,
        prose=prose,
        paragraphs=paragraphs,
        sentences=sentences,
        prose_words=len(words(prose)),
        code_blocks=code_blocks,
        code_chars=code_chars,
        excluded_quotes=excluded,
    )


def _symbol_heavy(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    symbols = sum(1 for c in s if c in "{}[]();=<>+-*/_.:,'\"#$%&|\\")
    return symbols / len(s) > 0.12


# --- Domains ------------------------------------------------------------------------------------
DOMAINS = ("programming", "infrastructure", "academic", "essay", "journalism", "general")

# Prism topic slugs → detector domain
TOPIC_TO_DOMAIN = {
    "programming": "programming",
    "ai-ml": "programming",
    "technology": "programming",
    "infrastructure": "infrastructure",
    "science": "academic",
    "climate": "academic",
    "philosophy": "essay",
    "culture": "essay",
    "craft": "essay",
    "design": "essay",
    "writing": "essay",
    "policy": "journalism",
    "reporting": "journalism",
}

_LEXICON = {
    "programming": "function variable compiler runtime api library framework python javascript typescript rust java "
    "code bug debug refactor repository git commit test tests unit async await thread loop array string integer "
    "class method object interface type types npm package module import syntax parse query sql database endpoint",
    "infrastructure": "kubernetes cluster node nodes container docker latency throughput availability replica replication "
    "shard sharding load balancer cache caching cdn region failover terraform deployment pipeline observability "
    "metrics outage incident sla slo scaling autoscaling queue kafka microservice microservices network bandwidth",
    "academic": "study studies hypothesis experiment experiments participants sample data dataset results significant "
    "analysis method methods methodology findings evidence model models theory empirical paper research researchers "
    "cell cells protein species climate emissions measurement statistical correlation abstract we propose",
    "essay": "meaning self consciousness moral morality ethics virtue truth beauty freedom memory grief love death "
    "culture art literature history identity soul language wonder life human nature philosophy kant plato nietzsche "
    "experience perhaps sense belief",
    "journalism": "government policy minister ministry election officials official spokesperson reported report announced "
    "billion million percent bill law legislation court senate congress parliament president agency regulators "
    "economy market budget tax city council police public statement",
}
_LEX_SETS = {k: set(v.split()) for k, v in _LEXICON.items()}


def detect_domain(prepared: Prepared, topic: str | None = None) -> tuple[str, str]:
    """Returns (domain, source) where source is "topic" or "content"."""
    if topic:
        d = TOPIC_TO_DOMAIN.get(topic.strip().lower())
        if d:
            return d, "topic"
    toks = words(prepared.prose)
    if not toks:
        return ("programming" if prepared.code_blocks else "general"), "content"
    n = len(toks)
    scores = {k: sum(1 for t in toks if t in lex) / n * 1000 for k, lex in _LEX_SETS.items()}
    if prepared.code_ratio > 0.08 or prepared.code_blocks >= 2:
        scores["programming"] += 25
    best = max(scores, key=scores.get)
    # Require a clear signal; otherwise the generic profile applies
    return (best if scores[best] >= 12 else "general"), "content"
