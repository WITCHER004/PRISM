"""
Signals 2 and 3 of the ensemble: syntactic burstiness over sliding sentence windows, and the
low-weight cliché / structural-formula prior. Pure Python, no model.

Every function returns raw, interpretable measurements. Turning them into an AI likelihood is the
calibration layer's job (weights fitted by scripts/eval_detectors.py), so nothing here hard-codes a
verdict.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from text_prep import words

WINDOW = 3  # sentences per window
STRIDE = 1

_SUBORDINATORS = set(
    "although because since unless whereas while whether which who whom whose that if when where after before "
    "though until once".split()
)
_PUNCT_KINDS = {"comma": ",", "semicolon": ";", "colon": ":", "dash": "—–", "paren": "()", "question": "?", "exclaim": "!"}

# (pattern, weight). Weights are relative; the calibrated weight of the whole signal is capped.
CLICHES: list[tuple[str, float]] = [
    (r"\bdelv(?:e|es|ing) (?:into|deeper)\b", 1.0),
    (r"\btapestry of\b|\brich tapestry\b", 1.0),
    (r"\bit(?: is|['’]s) (?:important|worth|crucial|essential) to (?:note|remember|recogni[sz]e|consider)\b", 0.8),
    (r"\bin conclusion\b", 0.6),
    (r"\bin today['’]s (?:fast-paced|digital|ever-changing|modern|interconnected)\b", 1.0),
    (r"\bever-(?:evolving|changing)\b", 0.7),
    (r"\bnavigat(?:e|ing) the (?:complexities|intricacies|landscape)\b", 1.0),
    (r"\b(?:a )?testament to\b", 0.6),
    (r"\bplays? a (?:crucial|vital|pivotal|key|significant) role\b", 0.6),
    (r"\b(?:unlock|unleash|harness)(?:es|ing)? the (?:full )?(?:power|potential)\b", 0.9),
    (r"\bembark(?:s|ing)? on (?:a|an|this|the) journey\b", 1.0),
    (r"\bin the realm of\b|\bthe realm of\b", 0.7),
    (r"\bstands? as a\b|\bserves? as a (?:powerful|stark|poignant) reminder\b", 0.6),
    (r"\b(?:multifaceted|holistic|seamless(?:ly)?|transformative|pivotal|paramount)\b", 0.3),
    (r"\bat the end of the day\b|\bultimately,", 0.3),
    (r"\bwhether you['’]re a\b", 0.7),
    (r"\bfoster(?:s|ing)? (?:a )?(?:sense|culture|environment) of\b", 0.7),
    (r"\bshed(?:s|ding)? light on\b", 0.4),
    (r"\bnot only\b[^.]{3,80}\bbut also\b", 0.4),
    (r"\b(?:it['’]s|this is) not (?:just |merely |simply )?(?:about )?[^.,]{2,40}[,;—–-]+ (?:it['’]s|but)\b", 0.5),
    (r"\bkey takeaways?\b|\blet['’]s (?:dive|explore|unpack)\b|\bdive (?:deep )?into\b", 0.7),
]
_CLICHE_RE = [(re.compile(p, re.I), w) for p, w in CLICHES]
_SIGNOFF = re.compile(r"^(?:in conclusion|in summary|to sum up|ultimately|overall|in essence|all in all)\b", re.I)
_TRIAD = re.compile(r"\b\w+(?: \w+)?, \w+(?: \w+)?,? and \w+(?: \w+)?\b")
_BULLET_LABEL = re.compile(r"^\s*(?:[-*•]|\d+\.)\s*\**[A-Z][\w ]{1,30}\**:\s", re.M)
_TRANSITION_OPENERS = set(
    "furthermore moreover additionally however overall ultimately consequently therefore thus importantly notably "
    "similarly conversely firstly secondly lastly finally indeed".split()
)


@dataclass
class SentenceStats:
    text: str
    n_words: int
    depth: float  # clause-depth proxy
    punct: dict[str, int]
    opener: str


def sentence_stats(sentences: list[str]) -> list[SentenceStats]:
    out = []
    for s in sentences:
        toks = words(s)
        depth = sum(1 for t in toks if t in _SUBORDINATORS) + s.count(",") * 0.5 + s.count(";") + s.count("(") + s.count("—")
        punct = {k: sum(s.count(c) for c in chars) for k, chars in _PUNCT_KINDS.items()}
        out.append(SentenceStats(s, len(toks), depth, punct, toks[0] if toks else ""))
    return out


def _mean_sd(xs: list[float]) -> tuple[float, float]:
    if not xs:
        return 0.0, 0.0
    m = sum(xs) / len(xs)
    return m, math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


def burstiness_features(stats: list[SentenceStats]) -> dict[str, float]:
    """Rhythm of a stretch of sentences. Higher variation = more human-like."""
    lens = [float(s.n_words) for s in stats]
    m, sd = _mean_sd(lens)
    cv = sd / m if m else 0.0
    _, depth_sd = _mean_sd([s.depth for s in stats])
    # Share of sentences sitting in the LLM "comfort band" of 15–26 words
    band = sum(1 for x in lens if 15 <= x <= 26) / len(lens) if lens else 0.0
    # Punctuation cadence: how many kinds of punctuation appear, and how unevenly
    kinds_used = sum(1 for k in _PUNCT_KINDS if any(s.punct[k] for s in stats))
    per_sent = [sum(s.punct.values()) / max(1, s.n_words) for s in stats]
    _, punct_sd = _mean_sd(per_sent)
    short = sum(1 for x in lens if x <= 8) / len(lens) if lens else 0.0
    openers = [s.opener for s in stats if s.opener]
    transitions = sum(1 for o in openers if o in _TRANSITION_OPENERS) / len(openers) if openers else 0.0
    return {
        "len_mean": m,
        "len_cv": cv,
        "depth_sd": depth_sd,
        "band_share": band,
        "punct_kinds": float(kinds_used),
        "punct_sd": punct_sd,
        "short_share": short,
        "transition_share": transitions,
    }


def burstiness_ai(f: dict[str, float]) -> float:
    """
    Maps rhythm features to 0..1 (1 = uniform, machine-like cadence). Monotone and smooth so the
    calibrated logistic layer above can re-weight it; the constants come from the shape of the
    distributions in the benchmark (human CV ~0.5–0.8, LLM ~0.25–0.4).
    """
    z = (
        3.2 * (0.45 - f["len_cv"])
        + 1.6 * (f["band_share"] - 0.5)
        + 0.6 * (1.2 - min(f["depth_sd"], 3.0))
        + 0.25 * (3 - min(f["punct_kinds"], 6))
        - 2.0 * f["short_share"]
        + 1.5 * f["transition_share"]
    )
    return 1 / (1 + math.exp(-z))


def cliche_hits(text: str) -> list[tuple[str, float]]:
    hits = []
    for rx, w in _CLICHE_RE:
        for m in rx.finditer(text):
            hits.append((m.group(0), w))
    return hits


def structure_score(text: str, sentences: list[str]) -> tuple[float, list[str]]:
    """Formula templates: sign-off conclusions, labelled-bullet lists, back-to-back triads."""
    reasons = []
    score = 0.0
    if any(_SIGNOFF.match(s) for s in sentences[-3:]):
        score += 0.6
        reasons.append("formulaic sign-off conclusion")
    bullets = len(_BULLET_LABEL.findall(text))
    if bullets >= 3:
        score += min(1.0, bullets / 6)
        reasons.append(f"{bullets} parallel labelled bullets")
    triads = len(_TRIAD.findall(text))
    n = max(1, len(words(text)))
    if triads / n * 100 > 1.2:
        score += 0.5
        reasons.append("dense triad lists")
    return score, reasons


def cliche_ai(text: str, sentences: list[str]) -> tuple[float, list[str]]:
    """
    0..1, saturating in phrase density per 100 words. One stock phrase in a 1,000-word essay scores
    about 0.05; it takes a cluster of them to get near 1.
    """
    hits = cliche_hits(text)
    n = max(1, len(words(text)))
    density = sum(w for _, w in hits) / n * 100
    struct, reasons = structure_score(text, sentences)
    value = 1 - math.exp(-(density / 1.2 + struct * 0.4))
    found = sorted({h.lower() for h, _ in hits})
    if found:
        reasons = [f"stock phrasing: {', '.join(repr(f) for f in found[:4])}"] + reasons
    return value, reasons


def windows(n_sentences: int, size: int = WINDOW, stride: int = STRIDE) -> list[tuple[int, int]]:
    """Overlapping [start, end) sentence windows. Short texts get a single window."""
    if n_sentences <= size:
        return [(0, n_sentences)] if n_sentences else []
    return [(i, i + size) for i in range(0, n_sentences - size + 1, stride)]
