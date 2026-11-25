"""
4-signal calibrated AI-text ensemble.

  1. Transformer classifiers (Desklib + RoBERTa logits) and Binoculars cross-perplexity, scored on
     ~180-word chunks of prose (code and attributed quotes already removed by text_prep).
  2. Sliding 3-sentence windows (stride 1) with syntactic burstiness: sentence-length variation,
     clause-depth variance, punctuation cadence, the 15–26-word "LLM comfort band".
  3. Cliché / structural-formula prior, capped so stock phrases alone can't fail a human essay.
  4. Calibration: fitted logistic weights + per-domain temperature scaling from
     detector_calibration.json, and the Proof-of-Craft adjustment for borderline scores.

Each window gets a calibrated probability; a sentence's probability is the mean over the windows that
contain it, and overallAiScore is the word-weighted mean over sentences ("how much of this reads as
machine-written", 0–100).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import calibration as cal
import stylometry as sty
from classifiers import Binoculars, DesklibDetector, RobertaDetector, logit, sigmoid
from text_prep import Prepared, words

_CLIP = 8.0

log = logging.getLogger("prism.detectors")


def _clip(x: float) -> float:
    return max(-_CLIP, min(_CLIP, x))


@dataclass
class Extracted:
    """Raw, model-dependent measurements. Cached by the benchmark so refits are instant."""

    sentences: list[str]
    sentence_words: list[int]
    windows: list[tuple[int, int]]
    window_features: list[dict]  # one per window, keys = calibration.FEATURES
    window_reasons: list[list[str]]
    chunk_of_sentence: list[int]
    chunk_scores: list[dict]  # per chunk: desklib/roberta/binoculars raw values
    doc: dict
    models: dict


class AIDetector:
    def __init__(self, cfg: Optional[dict] = None, device: Optional[str] = None):
        self.cfg = cfg or cal.load()
        m = self.cfg["models"]
        revs = self.cfg.get("revisions") or {}
        self.desklib = DesklibDetector(device, revs) if m.get("desklib") else None
        self.roberta = RobertaDetector(device, revs) if m.get("roberta") else None
        b = m.get("binoculars") or {}
        self.binoculars = Binoculars(b["observer"], b["performer"], device, revisions=revs) if b.get("enabled") else None

    def warmup(self) -> dict:
        return {
            name: (det.available if det else False)
            for name, det in (("desklib", self.desklib), ("roberta", self.roberta), ("binoculars", self.binoculars))
        }

    # ---------------------------------------------------------------- extraction
    def _chunks(self, sentences: list[str], lengths: list[int]) -> tuple[list[str], list[int]]:
        target = int(self.cfg.get("chunk_words", 180))
        chunks, owner, buf, n = [], [], [], 0
        for i, (s, w) in enumerate(zip(sentences, lengths)):
            buf.append(s)
            n += w
            owner.append(len(chunks))
            if n >= target:
                chunks.append(" ".join(buf))
                buf, n = [], 0
        if buf:
            if chunks and n < target / 3:
                chunks[-1] += " " + " ".join(buf)
                owner = [min(o, len(chunks) - 1) for o in owner]
            else:
                chunks.append(" ".join(buf))
        return chunks, owner

    def extract(self, prep: Prepared) -> Extracted:
        sents = prep.sentences
        lengths = [len(words(s)) for s in sents]
        chunks, owner = self._chunks(sents, lengths)

        # Long articles: score an even sample of chunks and let the rest borrow the nearest score
        max_chunks = int(self.cfg.get("max_chunks", 24))
        idx = list(range(len(chunks)))
        if len(idx) > max_chunks:
            step = (len(idx) - 1) / (max_chunks - 1)
            idx = sorted({round(i * step) for i in range(max_chunks)})
        sample = [chunks[i] for i in idx]

        models = {}
        raw: dict[str, list[Optional[float]]] = {}
        for key, det, fn in (
            ("desklib", self.desklib, "logits"),
            ("roberta", self.roberta, "logits"),
            ("binoculars", self.binoculars, "scores"),
        ):
            if det is None or not sample:
                models[key] = "disabled" if det is None else "ok"
                raw[key] = [None] * len(sample)
                continue
            try:
                raw[key] = getattr(det, fn)(sample)
                models[key] = "ok"
            except Exception:  # noqa: BLE001 - details go to the server log, never into the report
                log.warning("%s scoring failed", key, exc_info=True)
                models[key] = "unavailable"
                raw[key] = [None] * len(sample)

        chunk_scores: list[dict] = []
        for ci in range(len(chunks)):
            j = min(range(len(idx)), key=lambda k: abs(idx[k] - ci)) if idx else None
            chunk_scores.append({k: (raw[k][j] if j is not None else None) for k in raw})

        center = float(self.cfg.get("binoculars_center", 0.9))

        def semantic(ci: int) -> dict:
            c = chunk_scores[ci] if chunk_scores else {}
            d, r, b = c.get("desklib"), c.get("roberta"), c.get("binoculars")
            return {
                "desklib": _clip(d) if d is not None else None,
                "roberta": _clip(r) if r is not None else None,
                # positive = machine-like; ×10 puts a 0.1 change in the score on the logit scale
                "binoculars": _clip((center - b) * 10) if b is not None else None,
            }

        stats = sty.sentence_stats(sents)
        doc_burst = sty.burstiness_features(stats) if stats else {}
        doc_burst_ai = sty.burstiness_ai(doc_burst) if stats else 0.5
        doc_cliche, doc_reasons = sty.cliche_ai(prep.prose, sents)

        wins = sty.windows(len(sents))
        feats, reasons = [], []
        for a, b in wins:
            st = stats[a:b]
            text = " ".join(s.text for s in st)
            bf = sty.burstiness_features(st)
            # A 3-sentence window is a noisy rhythm sample: blend in the 7-sentence neighbourhood
            na, nb = max(0, a - 2), min(len(stats), b + 2)
            nf = sty.burstiness_features(stats[na:nb])
            w_ai = 0.5 * sty.burstiness_ai(bf) + 0.5 * sty.burstiness_ai(nf)
            c_ai, c_reasons = sty.cliche_ai(text, [s.text for s in st])
            center_sent = (a + b - 1) // 2
            f = semantic(owner[center_sent]) if owner else {"desklib": None, "roberta": None, "binoculars": None}
            f.update(
                burst_window=logit(w_ai),
                burst_doc=logit(doc_burst_ai),
                cliche_window=c_ai,
                cliche_doc=doc_cliche,
            )
            feats.append(f)
            r = []  # phrase-level reasons are attached per sentence in score()
            lens = [s.n_words for s in st]
            if len(lens) >= 3 and bf["len_cv"] < 0.2 and all(14 <= x <= 28 for x in lens):
                r.append(f"uniform sentence rhythm ({'/'.join(map(str, lens))} words)")
            reasons.append(r)

        return Extracted(
            sentences=sents,
            sentence_words=lengths,
            windows=wins,
            window_features=feats,
            window_reasons=reasons,
            chunk_of_sentence=owner,
            chunk_scores=chunk_scores,
            doc={
                "burstiness": {k: round(v, 3) for k, v in doc_burst.items()},
                "burstiness_ai": round(doc_burst_ai, 3),
                "cliche_ai": round(doc_cliche, 3),
                "cliche_reasons": doc_reasons,
            },
            models=models,
        )

    # ---------------------------------------------------------------- scoring
    @staticmethod
    def score(ex: Extracted, domain: str, cfg: dict, craft: Optional[dict] = None) -> dict:
        temp, dbias = cal.domain_params(cfg, domain)
        n = len(ex.sentences)
        if n == 0:
            return {"overallAiScore": 0.0, "rawAiScore": 0.0, "sentences": [], "contributions": {}, "craft": None}

        win_p, win_contrib = [], []
        for f in ex.window_features:
            z, contrib = cal.ensemble_logit(f, cfg)
            win_p.append(sigmoid((z + dbias) / temp))
            win_contrib.append(contrib)

        sums = [0.0] * n
        cnts = [0] * n
        reasons: list[set] = [set() for _ in range(n)]
        contrib_by_sent: list[dict] = [dict() for _ in range(n)]
        for (a, b), p, r, c in zip(ex.windows, win_p, ex.window_reasons, win_contrib):
            for i in range(a, b):
                sums[i] += p
                cnts[i] += 1
                reasons[i].update(r)
                for k, v in c.items():
                    contrib_by_sent[i][k] = contrib_by_sent[i].get(k, 0.0) + v
        sent_p = [s / c if c else 0.0 for s, c in zip(sums, cnts)]
        for i in range(n):
            if cnts[i]:
                contrib_by_sent[i] = {k: v / cnts[i] for k, v in contrib_by_sent[i].items()}

        total_w = sum(ex.sentence_words) or 1
        raw = 100 * sum(p * w for p, w in zip(sent_p, ex.sentence_words)) / total_w
        adjusted, craft_note = cal.craft_adjust(raw, craft, cfg)

        # Document-level signal contributions (mean over windows), for the report
        doc_contrib = {}
        if win_contrib:
            for k in win_contrib[0]:
                doc_contrib[k] = round(sum(c[k] for c in win_contrib) / len(win_contrib), 3)

        sentences = []
        for i, s in enumerate(ex.sentences):
            hits = sorted({h for h, _ in sty.cliche_hits(s)}, key=str.lower)
            if hits:
                reasons[i].add(f"stock phrasing: {', '.join(repr(h) for h in hits[:3])}")
            if sty._SIGNOFF.match(s):
                reasons[i].add("formulaic sign-off")
            sentences.append(
                {
                    "text": s,
                    "words": ex.sentence_words[i],
                    "aiProbability": round(sent_p[i], 3),
                    "reasons": sorted(reasons[i]),
                    "contrib": contrib_by_sent[i],
                }
            )
        return {
            "overallAiScore": round(adjusted, 1),
            "rawAiScore": round(raw, 1),
            "sentences": sentences,
            "contributions": doc_contrib,
            "craft": craft_note,
            "domainCalibration": {"temperature": temp, "bias": dbias},
        }


_SIGNAL_LABEL = {
    "desklib": "Desklib classifier",
    "roberta": "RoBERTa classifier",
    "binoculars": "Binoculars cross-perplexity",
    "burst_window": "uniform local sentence rhythm",
    "burst_doc": "uniform overall sentence rhythm",
    "cliche_window": "stock LLM phrasing",
    "cliche_doc": "stock LLM phrasing",
}


def explain(sentence: dict) -> str:
    """One-line human-readable reason for a flagged sentence."""
    c = sentence.get("contrib") or {}
    top = sorted(((v, k) for k, v in c.items() if v > 0.15), reverse=True)[:2]
    parts = []
    seen = set()
    for _, k in top:
        label = _SIGNAL_LABEL[k]
        if label not in seen:
            parts.append(label)
            seen.add(label)
    extra = sentence.get("reasons", [])
    msg = f"Reads {round(sentence['aiProbability'] * 100)}% machine-written"
    if parts:
        msg += " — driven by " + " and ".join(parts)
    if extra:
        msg += "; " + "; ".join(extra[:2])
    return msg + "."
