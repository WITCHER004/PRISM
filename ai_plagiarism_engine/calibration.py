"""
Signal 4: the calibration layer. Loads detector_calibration.json (written by
scripts/eval_detectors.py) and turns raw per-window features into calibrated probabilities:

    z      = bias + Σ weight_k · feature_k                  (logistic ensemble, fitted on benchmarks)
    p      = sigmoid((z + domain_bias) / domain_temperature) (per-domain temperature scaling)

plus the Proof-of-Craft adjustment for borderline documents.
"""
from __future__ import annotations

import copy
import json
import os
from typing import Any, Optional

FEATURES = ["desklib", "roberta", "binoculars", "burst_window", "burst_doc", "cliche_window", "cliche_doc"]

DEFAULT_PATH = os.environ.get(
    "DETECTOR_CALIBRATION", os.path.join(os.path.dirname(os.path.abspath(__file__)), "detector_calibration.json")
)

# Used until the benchmark has been run; deliberately conservative (biased toward "human").
DEFAULTS: dict[str, Any] = {
    "version": "defaults",
    "thresholds": {"ai_pass_max": 20.0, "manual_review_max": 60.0, "plagiarism_pass_max": 15.0, "borderline": [18.0, 25.0]},
    "models": {
        "desklib": True,
        "roberta": True,
        "binoculars": {"enabled": True, "observer": "Qwen/Qwen2.5-0.5B", "performer": "Qwen/Qwen2.5-0.5B-Instruct"},
    },
    "chunk_words": 180,
    "max_chunks": 24,
    "binoculars_center": 0.9,
    "weights": {
        "desklib": 0.45,
        "roberta": 0.10,
        "binoculars": 0.50,
        "burst_window": 0.20,
        "burst_doc": 0.30,
        "cliche_window": 0.40,
        "cliche_doc": 0.60,
    },
    "bias": -1.5,
    # Neutral values for features whose model is unavailable
    "impute": {k: 0.0 for k in FEATURES},
    # Cap on the cliché prior's total logit contribution, so stock phrases alone can't fail an essay
    "cliche_max_logit": 1.0,
    "domains": {d: {"temperature": 1.0, "bias": 0.0} for d in ("programming", "infrastructure", "academic", "essay", "journalism", "general")},
    "craft": {"max_discount": 6.0, "max_penalty": 3.0},
    "plagiarism": {
        "embedding_model": "BAAI/bge-base-en-v1.5",
        "lexical_overlap": 0.85,
        "semantic_threshold": 0.84,
        "sentence_semantic_threshold": 0.86,
        "min_sentence_words": 8,
    },
    "flag_sentence_min": 0.6,
}


def _merge(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load(path: Optional[str] = None) -> dict:
    path = path or DEFAULT_PATH
    try:
        with open(path, encoding="utf-8") as f:
            return _merge(DEFAULTS, json.load(f))
    except FileNotFoundError:
        return copy.deepcopy(DEFAULTS)


def save(cfg: dict, path: Optional[str] = None):
    path = path or DEFAULT_PATH
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, sort_keys=False)
        f.write("\n")


def ensemble_logit(feat: dict[str, Optional[float]], cfg: dict) -> tuple[float, dict[str, float]]:
    """Returns z and each feature's contribution (for explanations)."""
    w = cfg["weights"]
    contrib: dict[str, float] = {}
    for k in FEATURES:
        v = feat.get(k)
        if v is None:
            v = cfg["impute"].get(k, 0.0)
        contrib[k] = w.get(k, 0.0) * v
    cl = contrib["cliche_window"] + contrib["cliche_doc"]
    cap = cfg.get("cliche_max_logit", 1.0)
    if cl > cap:
        scale = cap / cl
        contrib["cliche_window"] *= scale
        contrib["cliche_doc"] *= scale
    return cfg["bias"] + sum(contrib.values()), contrib


def domain_params(cfg: dict, domain: str) -> tuple[float, float]:
    d = cfg["domains"].get(domain) or cfg["domains"].get("general") or {"temperature": 1.0, "bias": 0.0}
    return max(0.25, float(d.get("temperature", 1.0))), float(d.get("bias", 0.0))


def craft_evidence(craft: Optional[dict]) -> Optional[dict]:
    """
    Reads Prism editor telemetry (CraftTelemetry in src/lib/craft.ts). Returns human-evidence 0..1
    and a paste share, or None when there's nothing usable.
    """
    if not craft or not isinstance(craft, dict):
        return None
    typed = float(craft.get("typedChars") or 0) + float(craft.get("dictatedChars") or 0)
    pasted = float(craft.get("pastedChars") or 0)
    inserted = typed + pasted
    if inserted < 200:
        return None
    typed_ratio = typed / inserted
    sessions = int(craft.get("sessions") or 1)
    active_min = float(craft.get("activeMs") or 0) / 60000
    growth = craft.get("growth") or []
    final_words = max([g.get("words", 0) for g in growth] + [1])
    # Non-linear revision: points where the word count dropped (passages cut or rewritten)
    revisions = sum(1 for a, b in zip(growth, growth[1:]) if b.get("words", 0) < a.get("words", 0) - 5)
    pace = min(1.0, active_min / max(1.0, final_words / 30))  # ~30 words per active minute or slower
    clip = lambda x: max(0.0, min(1.0, x))  # noqa: E731
    evidence = (
        0.5 * clip((typed_ratio - 0.6) / 0.35)
        + 0.2 * clip((sessions - 1) / 2)
        + 0.15 * pace
        + 0.15 * clip(revisions / 3)
    )
    return {
        "evidence": round(evidence, 3),
        "typedRatio": round(typed_ratio, 3),
        "sessions": sessions,
        "revisions": revisions,
        "activeMinutes": round(active_min, 1),
    }


def craft_adjust(score: float, craft: Optional[dict], cfg: dict) -> tuple[float, Optional[dict]]:
    """Only moves scores that sit in the borderline band, and never out of it by more than its width."""
    lo, hi = cfg["thresholds"]["borderline"]
    ev = craft_evidence(craft)
    if ev is None:
        return score, None
    note = dict(ev)
    if not (lo <= score <= hi):
        note["applied"] = 0.0
        return score, note
    delta = -cfg["craft"]["max_discount"] * ev["evidence"]
    if ev["typedRatio"] < 0.3:
        delta += cfg["craft"]["max_penalty"] * (0.3 - ev["typedRatio"]) / 0.3
    new = max(0.0, score + delta)
    note["applied"] = round(new - score, 2)
    return new, note
