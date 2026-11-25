"""
Unified pipeline: text prep → AI ensemble + plagiarism → one report.

Report schema (camelCase; consumed by src/lib/moderation/analyzer.ts):
  overallAiScore      0–100, passes at <= thresholds.ai_pass_max (20)
  plagiarismScore     0–100, passes at <= thresholds.plagiarism_pass_max (15)
  detectedDomain      programming | infrastructure | academic | essay | journalism | general
  confidenceLevel     High | Medium | Borderline
  flaggedSentences    [{ text, aiProbability, plagiarismMatchUrl?, reason }]
  verdict             PASS | MANUAL_REVIEW | REJECT_AI | REJECT_PLAGIARISM
                      (MANUAL_REVIEW: AI score in (20, 60], or a passing score with Borderline confidence)
The legacy ai_detection / plagiarism_detection blocks are kept for older clients.
"""
from __future__ import annotations

import time
from typing import Iterable, Optional

import calibration as cal
from ai_detector import AIDetector, explain
from plagiarism_detector import PlagiarismDetector
from text_prep import detect_domain, prepare


def confidence_level(score: float, words: int, models_ok: int, cfg: dict) -> str:
    lo, hi = cfg["thresholds"]["borderline"]
    if lo - 3 <= score <= hi + 5:
        return "Borderline"
    if words >= 300 and models_ok >= 2 and (score <= lo - 8 or score >= hi + 15):
        return "High"
    return "Medium"


class ArticleAnalyzer:
    def __init__(self, vector_dir: Optional[str] = None, cfg: Optional[dict] = None, device: Optional[str] = None, load_models: bool = True):
        self.cfg = cfg or cal.load()
        self.ai = AIDetector(self.cfg, device) if load_models else None
        self.plagiarism = PlagiarismDetector(self.cfg, persist_directory=vector_dir, load_embeddings=load_models)

    def analyze_article(
        self,
        article_id: str,
        text: str,
        topic: Optional[str] = None,
        craft: Optional[dict] = None,
        external_refs: Optional[Iterable[dict]] = None,
    ) -> dict:
        t0 = time.time()
        cfg = self.cfg
        prep = prepare(text)
        domain, domain_source = detect_domain(prep, topic)

        ai = {"overallAiScore": 0.0, "rawAiScore": 0.0, "sentences": [], "contributions": {}, "craft": None}
        models: dict = {}
        doc_signals: dict = {}
        if self.ai is not None and prep.sentences:
            ex = self.ai.extract(prep)
            models = ex.models
            doc_signals = ex.doc
            ai = AIDetector.score(ex, domain, cfg, craft)

        plag = self.plagiarism.check(prep, exclude_article_id=article_id, external=external_refs)

        ai_score = float(ai["overallAiScore"])
        plag_score = float(plag["plagiarismScore"])
        thr = cfg["thresholds"]
        ai_pass = ai_score <= thr["ai_pass_max"]
        plag_pass = plag_score <= thr["plagiarism_pass_max"]
        models_ok = sum(1 for v in models.values() if v == "ok")
        conf = confidence_level(ai_score, prep.prose_words, models_ok, cfg)

        # Flagged sentences: AI-like ones and copied ones, merged by sentence
        flag_min = float(cfg.get("flag_sentence_min", 0.6))
        if ai_score > thr["ai_pass_max"]:
            # A failing document must always show the author where: lower the bar to its most AI-like sentences
            probs = sorted((s["aiProbability"] for s in ai["sentences"]), reverse=True)
            if probs:
                flag_min = min(flag_min, max(0.3, probs[min(len(probs), 5) - 1]))
        flagged = []
        for i, s in enumerate(ai["sentences"] or [{"text": t, "aiProbability": 0.0, "reasons": []} for t in prep.sentences]):
            p = plag["flagged"].get(i)
            if s["aiProbability"] < flag_min and p is None:
                continue
            reasons = []
            if s["aiProbability"] >= flag_min:
                reasons.append(explain(s))
            if p is not None:
                where = p["sourceTitle"] or p["sourceUrl"] or p["sourceId"]
                kind = {"VERBATIM": "Copied verbatim", "NEAR_VERBATIM": "Nearly identical", "MOSAIC": "Patchwork of", "PARAPHRASE": "Paraphrase of"}[p["matchType"]]
                reasons.append(f"{kind} a passage in “{where}” ({round(p['similarity'] * 100)}% similar). Quote it with attribution or rewrite it.")
            item = {"text": s["text"], "aiProbability": s["aiProbability"], "reason": " ".join(reasons)}
            if p is not None:
                item["plagiarismMatchUrl"] = p["sourceUrl"] or None
                item["plagiarismMatchId"] = p["sourceId"]
                item["plagiarismSimilarity"] = p["similarity"]
                item["matchType"] = p["matchType"]
            flagged.append(item)
        flagged.sort(key=lambda f: (-(1 if "plagiarismMatchId" in f else 0), -f["aiProbability"]))

        if not plag_pass:
            verdict = "REJECT_PLAGIARISM"
        elif ai_score > thr.get("manual_review_max", 60.0):
            verdict = "REJECT_AI"
        elif not ai_pass:
            # Above the limit but in the range where careful human prose is sometimes misread
            verdict = "MANUAL_REVIEW"
        elif conf == "Borderline":
            verdict = "MANUAL_REVIEW"
        else:
            verdict = "PASS"

        contributions = ai.get("contributions", {})
        signals = {
            "classifier": {
                "desklib": contributions.get("desklib"),
                "roberta": contributions.get("roberta"),
                "status": {k: models.get(k) for k in ("desklib", "roberta")},
            },
            "binoculars": {"contribution": contributions.get("binoculars"), "status": models.get("binoculars")},
            "burstiness": {
                "contribution": round((contributions.get("burst_window") or 0) + (contributions.get("burst_doc") or 0), 3),
                **doc_signals.get("burstiness", {}),
            },
            "cliche": {
                "contribution": round((contributions.get("cliche_window") or 0) + (contributions.get("cliche_doc") or 0), 3),
                "reasons": doc_signals.get("cliche_reasons", []),
            },
            "craft": ai.get("craft"),
        }

        return {
            "articleId": article_id,
            "verdict": verdict,
            "overallAiScore": round(ai_score, 1),
            "rawAiScore": ai.get("rawAiScore", 0.0),
            "plagiarismScore": round(plag_score, 1),
            "aiPassed": ai_pass,
            "plagiarismPassed": plag_pass,
            "thresholds": {"ai": thr["ai_pass_max"], "plagiarism": thr["plagiarism_pass_max"]},
            "detectedDomain": domain,
            "domainSource": domain_source,
            "confidenceLevel": conf,
            "flaggedSentences": flagged[:40],
            "signals": signals,
            "plagiarism": {
                "matches": plag["matches"][:10],
                "corpusParagraphs": plag["corpusParagraphs"],
                "externalParagraphs": plag["externalParagraphs"],
                "semantic": plag["semantic"],
            },
            "meta": {
                "wordCount": prep.original_words,
                "proseWordCount": prep.prose_words,
                "codeBlocksStripped": prep.code_blocks,
                "quotesExcluded": len(prep.excluded_quotes),
                "models": models,
                "calibrationVersion": cfg.get("version"),
                "elapsedMs": int((time.time() - t0) * 1000),
            },
            # Legacy shape (older clients read ai_detection.overall_ai_probability)
            "ai_detection": {"overall_ai_probability": round(ai_score / 100, 4), "is_ai_generated": not ai_pass},
            "plagiarism_detection": {"overall_similarity_score": round(plag_score / 100, 4), "is_plagiarized": not plag_pass},
        }

    def index_article(self, article_id: str, text: str, url: str = "", title: str = "") -> int:
        return self.plagiarism.index(article_id, text, url=url, title=title)

    def remove_article(self, article_id: str) -> int:
        return self.plagiarism.remove(article_id)
