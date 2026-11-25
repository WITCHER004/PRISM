"""
Fetch benchmark slices for the detector calibration suite (scripts/eval_detectors.py).

Real, labelled text only — nothing here is synthetic except the programmatic plagiarism edits that
eval_detectors.py derives from real source passages.

  HC3         Hello-SimpleAI/HC3           human vs ChatGPT answers (wiki_csai, medicine, finance, open_qa)
  RAID        liamdugan/raid               human + 5 chat LLMs, clean and adversarial (paraphrase, synonym)
  Ghostbuster acmc/ghostbuster_wp/_reuter  creative writing and news, human vs GPT/Claude
  MAGE        yaful/MAGE                   human vs 27 generators across 10 domains
  FP audit    Liang et al. 2023 (ChatGPT-Detector-Bias): TOEFL essays by non-native writers,
              Stanford CS224N technical abstracts, US college essays — all human-written.

Rows come from the Hugging Face dataset-server API (no `datasets` package needed) and are written to
ai_plagiarism_engine/benchmarks/data/*.jsonl as {id, text, label, domain, source, generator, attack, audit}.
label: 1 = AI-generated, 0 = human.

  python scripts/fetch_benchmarks.py            # default sizes (~40 human / ~40 AI per domain)
  python scripts/fetch_benchmarks.py --per 80   # bigger slices
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "ai_plagiarism_engine", "benchmarks", "data")
API = "https://datasets-server.huggingface.co"
LIANG = "https://raw.githubusercontent.com/Weixin-Liang/ChatGPT-Detector-Bias/main/Data_and_Results/Human_Data"
UA = {"User-Agent": "prism-detector-benchmark/1.0"}


def get_json(url: str, retries: int = 4):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def rows(dataset: str, config: str, split: str, where: str | None = None, offset: int = 0, length: int = 100) -> list[dict]:
    params = {"dataset": dataset, "config": config, "split": split, "offset": offset, "length": min(100, length)}
    if where:
        params["where"] = where
    url = f"{API}/{'filter' if where else 'rows'}?{urllib.parse.urlencode(params)}"
    d = get_json(url)
    if "error" in d:
        raise RuntimeError(f"{dataset}: {d['error']}")
    return [r["row"] for r in d.get("rows", [])]


def total(dataset: str, config: str, split: str, where: str) -> int:
    params = {"dataset": dataset, "config": config, "split": split, "offset": 0, "length": 1, "where": where}
    return int(get_json(f"{API}/filter?{urllib.parse.urlencode(params)}").get("num_rows_total") or 0)


def sampled(dataset, config, split, where, n, seed=7):
    """n rows spread across the filtered set (pages at random offsets, not just the first page)."""
    t = total(dataset, config, split, where)
    if t == 0:
        return []
    rng = random.Random(seed)
    out: list[dict] = []
    pages = max(1, min(4, n // 10))
    per = max(1, n // pages + 1)
    offsets = sorted({rng.randrange(0, max(1, t - per)) for _ in range(pages)})
    for off in offsets:
        out.extend(rows(dataset, config, split, where, off, per))
    rng.shuffle(out)
    return out[:n]


def sid(*parts) -> str:
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:16]


def nwords(t: str) -> int:
    return len(t.split())


def keep(t: str, lo: int, hi: int = 1500) -> str | None:
    t = (t or "").strip()
    if nwords(t) < lo:
        return None
    w = t.split(" ")
    return " ".join(w[:hi]) if len(w) > hi else t


def write(name: str, items: list[dict]):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{name}.jsonl"), "w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    labels = [i["label"] for i in items]
    print(f"  {name}: {len(items)} rows ({labels.count(0)} human / {labels.count(1)} AI)")


def _as_list(v):
    if isinstance(v, list):
        return v
    try:
        return ast.literal_eval(v)
    except Exception:  # noqa: BLE001
        return [v]


def fetch_hc3(per: int, lo: int):
    items = []
    for cfg, domain in (("wiki_csai", "programming"), ("medicine", "academic"), ("finance", "journalism"), ("open_qa", "general")):
        got = 0
        for off in range(0, 800, 100):
            for r in rows("Hello-SimpleAI/HC3", cfg, "train", offset=off, length=100):
                for label, key in ((0, "human_answers"), (1, "chatgpt_answers")):
                    for j, t in enumerate(_as_list(r.get(key))[:1]):
                        t = keep(str(t), lo)
                        if t:
                            items.append({"id": sid("hc3", cfg, r["id"], label), "text": t, "label": label, "domain": domain, "source": f"HC3/{cfg}", "generator": "chatgpt" if label else "human", "attack": "none", "audit": False})
                            got += 1
            if got >= per * 2:
                break
    write("hc3", items)


RAID_DOMAINS = {"abstracts": "academic", "news": "journalism", "books": "essay", "wiki": "academic", "reddit": "general"}
RAID_MODELS = ["gpt4", "chatgpt", "llama-chat", "mistral-chat", "cohere-chat"]


def fetch_raid(per: int, lo: int):
    items = []
    for rd, domain in RAID_DOMAINS.items():
        n_h = per // 2 if rd in ("wiki", "reddit") else per
        for r in sampled("liamdugan/raid", "raid", "train", f"\"domain\"='{rd}' AND \"model\"='human' AND \"attack\"='none'", n_h):
            t = keep(r["generation"], lo)
            if t:
                items.append({"id": r["id"], "text": t, "label": 0, "domain": domain, "source": f"RAID/{rd}", "generator": "human", "attack": "none", "audit": False})
        # AI: clean generations from each chat model + adversarial paraphrase / synonym attacks
        for m in RAID_MODELS:
            for attack, k in (("none", 2), ("paraphrase", 1), ("synonym", 1)):
                n = max(1, (per if rd not in ("wiki", "reddit") else per // 2) * k // (4 * len(RAID_MODELS)) + 1)
                where = f"\"domain\"='{rd}' AND \"model\"='{m}' AND \"attack\"='{attack}' AND \"repetition_penalty\"='no'"
                try:
                    got = sampled("liamdugan/raid", "raid", "train", where, n, seed=int(sid(rd, m, attack), 16) % 1000)
                except Exception as e:  # noqa: BLE001
                    print(f"  RAID {rd}/{m}/{attack}: {e}", file=sys.stderr)
                    continue
                for r in got:
                    t = keep(r["generation"], lo)
                    if t:
                        items.append({"id": r["id"], "text": t, "label": 1, "domain": domain, "source": f"RAID/{rd}", "generator": m, "attack": attack, "audit": False})
    write("raid", items)


def fetch_raid_plagiarism(per: int, lo: int):
    """Paraphrase-attacked human texts + their originals: real 'spun' plagiarism pairs."""
    pairs = []
    for rd in ("news", "abstracts", "books", "wiki"):
        adv = sampled("liamdugan/raid", "raid", "train", f"\"domain\"='{rd}' AND \"model\"='human' AND \"attack\"='paraphrase'", per // 2, seed=11)
        ids = [a["source_id"] for a in adv]
        originals = {}
        for i in range(0, len(ids), 15):
            where = " OR ".join(f"\"id\"='{x}'" for x in ids[i : i + 15])
            for r in rows("liamdugan/raid", "raid", "train", where, 0, 100):
                originals[r["id"]] = r["generation"]
        for a in adv:
            src = originals.get(a["source_id"])
            if src and keep(src, lo) and keep(a["generation"], 40):
                pairs.append({"id": a["id"], "source_id": a["source_id"], "domain": RAID_DOMAINS[rd], "original": src, "paraphrase": a["generation"]})
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "plagiarism_pairs.jsonl"), "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"  plagiarism_pairs: {len(pairs)} pairs")


def fetch_ghostbuster(per: int, lo: int):
    items = []
    for ds, domain in (("acmc/ghostbuster_wp", "essay"), ("acmc/ghostbuster_reuter", "journalism")):
        for label, gen in ((0, "False"), (1, "True")):
            for r in sampled(ds, "default", "train", f"\"generated\"={gen}", per // 2 + 2, seed=label + 3):
                t = keep(r["text"], lo)
                if t:
                    items.append({"id": sid(ds, t[:200]), "text": t, "label": label, "domain": domain, "source": f"Ghostbuster/{ds.split('_')[-1]}", "generator": r.get("model") if label else "human", "attack": "none", "audit": False})
    write("ghostbuster", items)


MAGE_SRC = {"sci_gen": "academic", "cmv": "essay", "xsum": "journalism", "tldr": "journalism", "wp": "essay", "eli5": "general"}


def fetch_mage(per: int, lo: int):
    items = []
    for prefix, domain in MAGE_SRC.items():
        for mage_label, label in (("1", 0), ("0", 1)):  # MAGE: 1 = human, 0 = machine
            where = f"\"label\"='{mage_label}' AND \"src\" LIKE '{prefix}%'"
            for r in sampled("yaful/MAGE", "default", "test", where, per // 3 + 2, seed=int(mage_label) + 5):
                t = keep(r["text"], lo)
                if t:
                    items.append({"id": sid("mage", t[:200]), "text": t, "label": label, "domain": domain, "source": f"MAGE/{prefix}", "generator": r["src"], "attack": "none", "audit": False})
    write("mage", items)


def fetch_audit(per: int, lo: int):
    items = []
    for folder, domain, tag in (
        ("TOEFL_real_91", "essay", "non-native English (TOEFL)"),
        ("CS224N_real_145", "academic", "technical abstracts (CS224N)"),
        ("CollegeEssay_real_70", "essay", "college essays"),
    ):
        data = get_json(f"{LIANG}/{folder}/data.json")
        rng = random.Random(5)
        rng.shuffle(data)
        for d in data[: per]:
            t = keep(d.get("document", ""), min(lo, 80))
            if t:
                items.append({"id": sid(folder, t[:200]), "text": t, "label": 0, "domain": domain, "source": f"Audit/{tag}", "generator": "human", "attack": "none", "audit": True})
    write("audit", items)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per", type=int, default=40, help="target rows per class per domain/source")
    ap.add_argument("--min-words", type=int, default=100)
    ap.add_argument("--only", nargs="*", default=None, help="hc3 raid ghostbuster mage audit plagiarism")
    a = ap.parse_args()
    jobs = {
        "hc3": fetch_hc3,
        "raid": fetch_raid,
        "ghostbuster": fetch_ghostbuster,
        "mage": fetch_mage,
        "audit": fetch_audit,
        "plagiarism": fetch_raid_plagiarism,
    }
    for name, fn in jobs.items():
        if a.only and name not in a.only:
            continue
        print(f"[{name}]")
        try:
            fn(a.per, a.min_words)
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
