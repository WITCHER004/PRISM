"""
Multi-domain benchmark + calibration for the Prism detection engine.

  python scripts/fetch_benchmarks.py           # once: download HC3 / RAID / Ghostbuster / MAGE / FP-audit slices
  python scripts/eval_detectors.py             # extract features (cached), fit, tune, report, write calibration
  python scripts/eval_detectors.py --report-only   # evaluate the current detector_calibration.json, no tuning

What it does
  1. Splits every sample 50/50 into a calibration half and a held-out test half (stable hash of id).
  2. Runs the expensive models once per sample and caches the per-window features
     (benchmarks/cache/features.jsonl), so refits take seconds.
  3. Fits the logistic ensemble weights on calibration windows (each document weighted equally,
     classes balanced, weights constrained to be non-negative; the cliché prior is capped).
  4. Tunes a temperature and bias per domain so that, on calibration humans, FPR at the 20% threshold
     stays under the target (default 1.5%, leaving margin under the 2% goal) while maximising F1.
     Domains with too few human samples inherit the global setting.
  5. Reports precision / recall / F1 / FPR on the TEST half per domain, per source dataset, per attack,
     for the false-positive audit set, and the plagiarism pipeline on RAID paraphrase pairs plus
     programmatic verbatim / light-edit / mosaic copies.
  6. Writes ai_plagiarism_engine/detector_calibration.json and benchmarks/REPORT.md + report.json.
"""
from __future__ import annotations

import argparse
import copy
import dataclasses
import hashlib
import json
import math
import os
import random
import re
import shutil
import sys
import tempfile
import time
from collections import defaultdict

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = os.path.join(ROOT, "ai_plagiarism_engine")
sys.path.insert(0, ENGINE)

import calibration as cal  # noqa: E402
from text_prep import DOMAINS, prepare  # noqa: E402

BENCH = os.path.join(ENGINE, "benchmarks")
DATA = os.path.join(BENCH, "data")
CACHE = os.path.join(BENCH, "cache")
FEATURES = cal.FEATURES


# ------------------------------------------------------------------ data
def load_samples(limit: int | None) -> list[dict]:
    items = []
    for fn in sorted(os.listdir(DATA)):
        if fn.endswith(".jsonl") and fn != "plagiarism_pairs.jsonl":
            with open(os.path.join(DATA, fn), encoding="utf-8") as f:
                items.extend(json.loads(line) for line in f if line.strip())
    seen, out = set(), []
    for it in items:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        it["split"] = "calib" if int(hashlib.md5(it["id"].encode()).hexdigest(), 16) % 2 == 0 else "test"
        out.append(it)
    if limit:
        random.Random(1).shuffle(out)
        out = out[:limit]
    return out


def models_signature(cfg: dict) -> str:
    m = cfg["models"]
    return json.dumps({"m": m, "chunk": cfg.get("chunk_words"), "center": cfg.get("binoculars_center"), "v": 3}, sort_keys=True)


def extract_all(samples: list[dict], cfg: dict) -> dict[str, dict]:
    """id → serialised Extracted (only what scoring needs)."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "features.jsonl")
    sig = models_signature(cfg)
    cache: dict[str, dict] = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                if r.get("sig") == sig:
                    cache[r["id"]] = r
    todo = [s for s in samples if s["id"] not in cache]
    if todo:
        from ai_detector import AIDetector

        det = AIDetector(cfg)
        print(f"models: {det.warmup()}")
        t0 = time.time()
        with open(path, "a", encoding="utf-8") as f:
            for i, s in enumerate(todo, 1):
                prep = prepare(s["text"])
                if not prep.sentences:
                    continue
                ex = det.extract(prep)
                r = {
                    "id": s["id"],
                    "sig": sig,
                    "windows": ex.windows,
                    "window_features": ex.window_features,
                    "window_reasons": ex.window_reasons,
                    "sentence_words": ex.sentence_words,
                    "models": ex.models,
                }
                cache[s["id"]] = r
                f.write(json.dumps(r) + "\n")
                if i % 10 == 0 or i == len(todo):
                    el = time.time() - t0
                    print(f"  extracted {i}/{len(todo)}  ({el / i:.1f}s/doc, ~{el / i * (len(todo) - i) / 60:.0f} min left)", flush=True)
    return cache


# ------------------------------------------------------------------ scoring helpers
class Doc:
    """Precomputed linear map from window probabilities to the document score."""

    def __init__(self, s: dict, r: dict):
        self.id = s["id"]
        self.label = s["label"]
        self.domain = s["domain"] if s["domain"] in DOMAINS else "general"
        self.source = s["source"]
        self.attack = s.get("attack", "none")
        self.generator = s.get("generator", "")
        self.audit = s.get("audit", False)
        self.split = s["split"]
        self.words = sum(r["sentence_words"])
        n = len(r["sentence_words"])
        cnt = [0] * n
        for a, b in r["windows"]:
            for i in range(a, b):
                cnt[i] += 1
        tw = max(1, sum(r["sentence_words"]))
        self.a = np.array([sum(r["sentence_words"][i] / (cnt[i] * tw) for i in range(a, b) if cnt[i]) for a, b in r["windows"]])
        self.X = np.array([[np.nan if f.get(k) is None else f[k] for k in FEATURES] for f in r["window_features"]], dtype=float)

    def z(self, cfg: dict) -> np.ndarray:
        X = self.X.copy()
        imp = np.array([cfg["impute"].get(k, 0.0) for k in FEATURES])
        X = np.where(np.isnan(X), imp, X)
        w = np.array([cfg["weights"].get(k, 0.0) for k in FEATURES])
        contrib = X * w
        ci = [FEATURES.index("cliche_window"), FEATURES.index("cliche_doc")]
        cl = contrib[:, ci].sum(1)
        cap = cfg.get("cliche_max_logit", 1.0)
        scale = np.where(cl > cap, cap / np.maximum(cl, 1e-9), 1.0)
        contrib[:, ci] *= scale[:, None]
        return cfg["bias"] + contrib.sum(1)

    def score(self, z: np.ndarray, temp: float, bias: float) -> float:
        p = 1 / (1 + np.exp(-(z + bias) / temp))
        return float(100 * (self.a * p).sum())


def metrics(labels: list[int], scores: list[float], thr: float) -> dict:
    tp = sum(1 for y, s in zip(labels, scores) if y == 1 and s > thr)
    fp = sum(1 for y, s in zip(labels, scores) if y == 0 and s > thr)
    fn = sum(1 for y, s in zip(labels, scores) if y == 1 and s <= thr)
    tn = sum(1 for y, s in zip(labels, scores) if y == 0 and s <= thr)
    prec = tp / (tp + fp) if tp + fp else (1.0 if tp + fn == 0 else 0.0)
    rec = tp / (tp + fn) if tp + fn else float("nan")
    f1 = 2 * prec * rec / (prec + rec) if tp and not math.isnan(rec) else 0.0
    fpr = fp / (fp + tn) if fp + tn else float("nan")
    hs = sorted(s for y, s in zip(labels, scores) if y == 0)
    ai = [s for y, s in zip(labels, scores) if y == 1]
    return {
        "n_human": fp + tn,
        "n_ai": tp + fn,
        "precision": round(prec, 3),
        "recall": None if math.isnan(rec) else round(rec, 3),
        "f1": round(f1, 3),
        "fpr": None if math.isnan(fpr) else round(fpr, 4),
        "human_mean": round(float(np.mean(hs)), 1) if hs else None,
        "human_p95": round(float(np.percentile(hs, 95)), 1) if hs else None,
        "human_max": round(hs[-1], 1) if hs else None,
        "ai_mean": round(float(np.mean(ai)), 1) if ai else None,
    }


# ------------------------------------------------------------------ fitting
def fit_weights(docs: list[Doc], cfg: dict) -> dict:
    from sklearn.linear_model import LogisticRegression

    X = np.vstack([d.X for d in docs])
    y = np.concatenate([[d.label] * len(d.X) for d in docs])
    sw = np.concatenate([[1.0 / len(d.X)] * len(d.X) for d in docs])
    # Balance classes at the document level
    for lab in (0, 1):
        m = y == lab
        sw[m] *= len(docs) / (2 * max(1, sum(1 for d in docs if d.label == lab)))
    means = np.nanmean(X, axis=0)
    means = np.where(np.isnan(means), 0.0, means)
    X = np.where(np.isnan(X), means, X)

    active = list(range(len(FEATURES)))
    for _ in range(len(FEATURES)):
        lr = LogisticRegression(C=0.5, max_iter=2000)
        lr.fit(X[:, active], y, sample_weight=sw)
        coef = lr.coef_[0]
        neg = [active[i] for i, c in enumerate(coef) if c < 0]
        if not neg:
            break
        active = [a for a in active if a not in neg]  # drop features pointing the "wrong" way and refit
    weights = {k: 0.0 for k in FEATURES}
    for i, a in enumerate(active):
        weights[FEATURES[a]] = round(float(coef[i]), 4)
    out = copy.deepcopy(cfg)
    out["weights"] = weights
    out["bias"] = round(float(lr.intercept_[0]), 4)
    out["impute"] = {k: round(float(means[i]), 4) for i, k in enumerate(FEATURES)}
    return out


def tune_domains(docs: list[Doc], cfg: dict, target_fpr: float, min_humans: int) -> dict:
    thr = cfg["thresholds"]["ai_pass_max"]
    zs = {d.id: d.z(cfg) for d in docs}
    temps = [0.6, 0.75, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.5]
    biases = [round(x, 2) for x in np.arange(-4.0, 2.01, 0.1)]

    def best(subset: list[Doc]):
        labels = [d.label for d in subset]
        top = None
        for t in temps:
            for b in biases:
                sc = [d.score(zs[d.id], t, b) for d in subset]
                m = metrics(labels, sc, thr)
                if m["fpr"] is not None and m["fpr"] > target_fpr:
                    continue
                # Headroom: calibration humans' p95 must sit 5 points under the threshold to generalise
                if m["human_p95"] is not None and m["human_p95"] > thr - 5:
                    continue
                # Prefer F1, then lower human p95 (more headroom under the threshold)
                key = (m["f1"], -(m["human_p95"] or 0))
                if top is None or key > top[0]:
                    top = (key, t, b, m)
        return top

    g = best(docs)
    if g is None:
        raise SystemExit("No temperature/bias meets the FPR target even globally; add data or loosen --target-fpr.")
    out = copy.deepcopy(cfg)
    out["domains"] = {}
    for dom in DOMAINS:
        sub = [d for d in docs if d.domain == dom]
        n_h = sum(1 for d in sub if d.label == 0)
        n_a = len(sub) - n_h
        entry = {"temperature": g[1], "bias": g[2], "n_human": n_h, "n_ai": n_a, "source": "global"}
        if n_h >= min_humans and n_a >= 5:
            r = best(sub)
            if r is not None:
                # Shrink toward the global bias in proportion to how little data the domain has, but
                # never end up less conservative than the domain's own FPR-safe setting
                k = min(1.0, n_h / (min_humans * 3))
                shrunk = k * r[2] + (1 - k) * g[2]
                entry.update(temperature=r[1], bias=round(min(r[2], shrunk), 3), source=f"tuned (shrinkage {k:.2f})")
        out["domains"][dom] = entry
    return out


def doc_scores(docs: list[Doc], cfg: dict) -> dict[str, float]:
    out = {}
    for d in docs:
        t, b = cal.domain_params(cfg, d.domain)
        out[d.id] = d.score(d.z(cfg), t, b)
    return out


def breakdown(docs: list[Doc], scores: dict[str, float], thr: float, key) -> dict:
    groups = defaultdict(list)
    for d in docs:
        groups[key(d)].append(d)
    return {g: metrics([d.label for d in ds], [scores[d.id] for d in ds], thr) for g, ds in sorted(groups.items())}


# ------------------------------------------------------------------ plagiarism
def light_edit(text: str, rng: random.Random) -> str:
    """Drop or swap roughly one word in ten (the 'lightly edited copy' case)."""
    out = []
    for w in text.split():
        r = rng.random()
        if r < 0.05:
            continue
        if r < 0.10 and len(w) > 3:
            w = w[::-1] if rng.random() < 0.2 else w.upper() if rng.random() < 0.1 else w + "s"
        out.append(w)
    return " ".join(out)


def eval_plagiarism(cfg: dict, negatives: list[dict]) -> dict:
    from plagiarism_detector import PlagiarismDetector
    from text_prep import split_sentences

    path = os.path.join(DATA, "plagiarism_pairs.jsonl")
    if not os.path.exists(path):
        return {"skipped": "no plagiarism_pairs.jsonl (run fetch_benchmarks.py)"}
    with open(path, encoding="utf-8") as f:
        pairs = [json.loads(line) for line in f if line.strip()]
    tmp = tempfile.mkdtemp(prefix="prism_plag_")
    try:
        det = PlagiarismDetector(cfg, persist_directory=tmp)
        for p in pairs:
            det.index(p["source_id"], p["original"], url=f"https://prism.example/a/{p['source_id']}", title=p["source_id"][:8])
        rng = random.Random(3)
        thr = cfg["thresholds"]["plagiarism_pass_max"]
        cases = defaultdict(list)
        sims = {"positive": [], "negative": []}

        def run(kind, text, exclude=""):
            r = det.check(prepare(text), exclude_article_id=exclude)
            cases[kind].append(r["plagiarismScore"])
            return r

        hosts = [n["text"] for n in negatives]
        for i, p in enumerate(pairs):
            run("paraphrase (RAID/Dipper)", p["paraphrase"])
            src_s = split_sentences(p["original"])
            host = hosts[i % len(hosts)] if hosts else ""
            if len(src_s) >= 4 and host:
                k = max(3, len(src_s) // 3)
                start = rng.randrange(0, len(src_s) - k + 1)
                copied = " ".join(src_s[start : start + k])
                run("verbatim insert", host + "\n\n" + copied)
                run("light-edit insert", host + "\n\n" + light_edit(copied, rng))
                # mosaic: copied sentences interleaved with the host's own
                hs = split_sentences(host)
                mixed = []
                for j, s in enumerate(src_s[start : start + k]):
                    mixed.append(s)
                    if j < len(hs):
                        mixed.append(hs[j])
                run("mosaic (interleaved)", " ".join(mixed))
        for n in negatives:
            run("human negatives (not in corpus)", n["text"])

        # Threshold sweep on paragraph cosine for paraphrase pairs vs negatives
        q_pos = [prepare(p["paraphrase"]).paragraphs for p in pairs]
        q_neg = [prepare(n["text"]).paragraphs for n in negatives]
        if det._collection is not None and det._collection.count():
            for bucket, qs in (("positive", q_pos), ("negative", q_neg)):
                for paras in qs:
                    if not paras:
                        continue
                    e = det.embed(paras)
                    res = det._collection.query(query_embeddings=e.tolist(), n_results=1, include=["distances"])
                    sims[bucket].append(max(1 - d[0] for d in res["distances"]))
        sweep = []
        for t in [0.78, 0.80, 0.82, 0.84, 0.86, 0.88, 0.90, 0.92]:
            tp = sum(1 for s in sims["positive"] if s > t)
            fp = sum(1 for s in sims["negative"] if s > t)
            sweep.append({"threshold": t, "recall": round(tp / max(1, len(sims["positive"])), 3), "fpr": round(fp / max(1, len(sims["negative"])), 3)})

        summary = {}
        for kind, scores in cases.items():
            flagged = sum(1 for s in scores if s > thr)
            summary[kind] = {
                "n": len(scores),
                "flagged_over_threshold": round(flagged / max(1, len(scores)), 3),
                "mean_score": round(float(np.mean(scores)), 1),
            }
        return {"pairs": len(pairs), "negatives": len(negatives), "cases": summary, "semantic_sweep": sweep}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def pick_semantic_threshold(sweep: list[dict], floor: float = 0.84, max_fpr: float = 0.01) -> float:
    ok = [s for s in sweep if s["fpr"] <= max_fpr and s["threshold"] >= floor]
    return min(ok, key=lambda s: s["threshold"])["threshold"] if ok else max(s["threshold"] for s in sweep)


# ------------------------------------------------------------------ report
def fmt(m: dict) -> str:
    def f(x, pct=False):
        if x is None:
            return "–"
        return f"{x * 100:.1f}%" if pct else f"{x}"

    return f"| {m['n_human']} | {m['n_ai']} | {f(m['precision'])} | {f(m['recall'])} | {f(m['f1'])} | {f(m['fpr'], True)} | {f(m['human_mean'])} | {f(m['human_p95'])} | {f(m['ai_mean'])} |"


def table(title: str, rows: dict) -> str:
    out = [f"### {title}", "", "| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |", "|---|---|---|---|---|---|---|---|---|---|"]
    for k, m in rows.items():
        out.append(f"| {k} " + fmt(m))
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--target-fpr", type=float, default=0.015)
    ap.add_argument("--min-humans", type=int, default=12, help="humans needed in a domain before it gets its own tuning")
    ap.add_argument("--report-only", action="store_true")
    ap.add_argument("--no-plagiarism", action="store_true")
    a = ap.parse_args()

    base = cal.load()
    samples = load_samples(a.limit)
    print(f"{len(samples)} samples ({sum(s['label'] == 0 for s in samples)} human / {sum(s['label'] == 1 for s in samples)} AI)")
    feats = extract_all(samples, base)
    docs = [Doc(s, feats[s["id"]]) for s in samples if s["id"] in feats and feats[s["id"]]["windows"]]
    calib = [d for d in docs if d.split == "calib"]
    test = [d for d in docs if d.split == "test"]
    thr = base["thresholds"]["ai_pass_max"]

    defaults_scores = doc_scores(test, cal.DEFAULTS)
    if a.report_only:
        cfg = base
    else:
        cfg = fit_weights(calib, base)
        cfg = tune_domains(calib, cfg, a.target_fpr, a.min_humans)
        cfg["version"] = time.strftime("%Y-%m-%d") + "-bench"
    scores = doc_scores(test, cfg)
    calib_scores = doc_scores(calib, cfg)

    report = {
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "threshold": thr,
        "target_fpr": a.target_fpr,
        "samples": {"calib": len(calib), "test": len(test)},
        "weights": cfg["weights"],
        "bias": cfg["bias"],
        "domains": cfg["domains"],
        "test_overall": metrics([d.label for d in test], [scores[d.id] for d in test], thr),
        "test_overall_uncalibrated_defaults": metrics([d.label for d in test], [defaults_scores[d.id] for d in test], thr),
        "calib_overall": metrics([d.label for d in calib], [calib_scores[d.id] for d in calib], thr),
        "test_by_domain": breakdown([d for d in test if not d.audit], scores, thr, lambda d: d.domain),
        "test_by_source": breakdown(test, scores, thr, lambda d: d.source),
        "test_by_attack": breakdown([d for d in test if d.label == 1], scores, thr, lambda d: d.attack),
        "test_by_generator": breakdown([d for d in test if d.label == 1], scores, thr, lambda d: d.generator.split("_")[0]),
        "fp_audit_test": breakdown([d for d in test if d.audit], scores, thr, lambda d: d.source),
        "fp_audit_all": breakdown([d for d in docs if d.audit], {**scores, **calib_scores}, thr, lambda d: "all audit essays"),
    }
    # Phase 1 routing: pass (<= 20), manual review (20, manual_review_max], fail (above)
    cap = cfg["thresholds"].get("manual_review_max", 60.0)
    routing = {}
    for name, grp in (("human", [d for d in test if d.label == 0]), ("AI", [d for d in test if d.label == 1])):
        n = max(1, len(grp))
        routing[name] = {
            "n": len(grp),
            "pass": round(sum(1 for d in grp if scores[d.id] <= thr) / n, 4),
            "manual_review": round(sum(1 for d in grp if thr < scores[d.id] <= cap) / n, 4),
            "auto_fail": round(sum(1 for d in grp if scores[d.id] > cap) / n, 4),
        }
    report["routing_test"] = {"manual_review_max": cap, **routing}
    top_fp = sorted(((scores[d.id], d) for d in test if d.label == 0 and scores[d.id] > thr), key=lambda x: -x[0])[:10]
    report["false_positives_test"] = [{"id": d.id, "source": d.source, "domain": d.domain, "score": round(s, 1)} for s, d in top_fp]

    if not a.no_plagiarism:
        neg_pool = [s for s in samples if s["label"] == 0 and s["split"] == "test"]
        random.Random(2).shuffle(neg_pool)
        print("plagiarism benchmark…")
        report["plagiarism"] = eval_plagiarism(cfg, neg_pool[:80])
        sweep = report["plagiarism"].get("semantic_sweep")
        if sweep and not a.report_only:
            cfg["plagiarism"]["semantic_threshold"] = pick_semantic_threshold(sweep)
            report["plagiarism"]["chosen_semantic_threshold"] = cfg["plagiarism"]["semantic_threshold"]

    if not a.report_only:
        cfg["metrics"] = {"test_overall": report["test_overall"], "fp_audit_all": report["fp_audit_all"], "generated": report["generated"]}
        cal.save(cfg)
        print(f"wrote {cal.DEFAULT_PATH}")
    with open(os.path.join(BENCH, "report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    md = [
        "# Prism detector benchmark",
        "",
        f"Generated {report['generated']} · AI threshold {thr}% · target FPR {a.target_fpr * 100:.1f}% · "
        f"{len(calib)} calibration / {len(test)} held-out test documents. All numbers below are on the **held-out test half** unless noted.",
        "",
        "## Overall",
        "",
        table("Test set", {"calibrated ensemble": report["test_overall"], "uncalibrated defaults": report["test_overall_uncalibrated_defaults"]}),
        f"### Phase 1 routing (AI <= {thr}% pass · <= {report['routing_test']['manual_review_max']}% manual review · above: fail)",
        "",
        "| | n | pass | manual review | auto-fail |",
        "|---|---|---|---|---|",
        *[f"| {k} | {v['n']} | {v['pass'] * 100:.1f}% | {v['manual_review'] * 100:.1f}% | {v['auto_fail'] * 100:.1f}% |" for k, v in report["routing_test"].items() if isinstance(v, dict)],
        "",
        table("By domain (benchmark sets, excluding the audit essays)", report["test_by_domain"]),
        table("False-positive audit (human-only: non-native TOEFL, CS224N technical abstracts, college essays)", {**report["fp_audit_test"], **report["fp_audit_all"]}),
        table("By source dataset", report["test_by_source"]),
        table("AI samples by adversarial attack (recall)", report["test_by_attack"]),
        table("AI samples by generator (recall)", report["test_by_generator"]),
        "## Fitted ensemble",
        "",
        "```json",
        json.dumps({"weights": cfg["weights"], "bias": cfg["bias"], "domains": cfg["domains"]}, indent=2),
        "```",
        "",
    ]
    if report.get("false_positives_test"):
        md += ["## Human documents over the threshold (test)", "", *[f"- {x['source']} ({x['domain']}): {x['score']}%" for x in report["false_positives_test"]], ""]
    if "plagiarism" in report and "cases" in report["plagiarism"]:
        p = report["plagiarism"]
        md += [
            "## Plagiarism pipeline",
            "",
            f"{p['pairs']} real source articles indexed (RAID); queries are RAID's own paraphrase attacks of them, programmatic "
            f"copies inserted into unrelated human text, and {p['negatives']} human documents that are not in the corpus.",
            "",
            "| case | n | share over 15% | mean score |",
            "|---|---|---|---|",
            *[f"| {k} | {v['n']} | {v['flagged_over_threshold'] * 100:.1f}% | {v['mean_score']} |" for k, v in p["cases"].items()],
            "",
            "Semantic paragraph threshold sweep (paraphrase recall vs. unrelated-human FPR):",
            "",
            "| cosine > | recall | FPR |",
            "|---|---|---|",
            *[f"| {s['threshold']} | {s['recall'] * 100:.1f}% | {s['fpr'] * 100:.1f}% |" for s in p["semantic_sweep"]],
            "",
            f"Chosen semantic threshold: {p.get('chosen_semantic_threshold', cfg['plagiarism']['semantic_threshold'])}",
            "",
        ]
    with open(os.path.join(BENCH, "REPORT.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print("\n".join(md[:40]))


if __name__ == "__main__":
    main()
