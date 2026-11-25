# Prism AI & Plagiarism Detection Engine

FastAPI service behind Prism's Phase 1 check. The Next.js app calls it through `AI_DETECTION_API_URL`
(see `src/lib/moderation/analyzer.ts`); without it, the app falls back to its in-process heuristic.

Pass rules: **AI ≤ 20%** and **plagiarism ≤ 15%**.

## Pipeline

```
text ─► text_prep ─┬─► AI ensemble (ai_detector.py) ───────────┐
                   │    1 Desklib + RoBERTa logits, Binoculars   │
                   │    2 3-sentence windows, burstiness         ├─► analyzer.py ─► report
                   │    3 cliché / formula prior (capped)        │
                   │    4 calibration.py: fitted weights,        │
                   │      per-domain temperature, Proof of Craft │
                   └─► plagiarism_detector.py ──────────────────┘
                        L1 5-gram winnowing + MinHash LSH + per-sentence token overlap (>= 85%)
                        L2 bge-base paragraph embeddings vs Prism corpus + external refs (cos > 0.84)
                        L3 quotes & citations excluded upstream
```

**text_prep.py** removes code (fences, `<pre>`, `<code>`, inline backticks, unfenced code runs) and
attributed quotations (blockquotes, quoted spans with "said" / "(Smith, 2019)" / "[3]"), so neither
counts toward the AI score or plagiarism. It also detects the domain: from the Prism topic tag when
given (`programming`, `infrastructure`, `science`, `philosophy`, `policy`, …), else from vocabulary.

**AI ensemble.** Transformer signals are scored on ~180-word chunks; every 3-sentence window (stride 1)
combines its chunk's classifier and Binoculars values with local and document burstiness and the
cliché prior in a logistic model whose weights are fitted on benchmarks. The cliché prior's total
contribution is capped at 1 logit, so stock phrases alone can't fail an essay. Each window then goes
through the domain's temperature and bias. A sentence's probability is the mean of its windows, and
`overallAiScore` is the word-weighted mean (the share of the text that reads as machine-written).
Scores in the 18–25% band are nudged by Proof-of-Craft telemetry: up to −6 for organic typing,
several sittings and cut/rewritten passages, and up to +3 for a mostly pasted draft.

Every model is optional. One that can't load is reported in `meta.models` and imputed with its
calibration mean, so the service degrades instead of failing.

| signal | model | CPU cost (≈300 words) |
|---|---|---|
| classifier | `desklib/ai-text-detector-v1.01` (DeBERTa-v3-large) | ~1.5 s |
| classifier | `roberta-base-openai-detector` | ~0.2 s |
| Binoculars | `Qwen/Qwen2.5-0.5B` observer / `Qwen2.5-0.5B-Instruct` performer | ~1 s |
| embeddings | `BAAI/bge-base-en-v1.5` | ~0.1 s |

The Binoculars pair is configurable in `detector_calibration.json` (`models.binoculars`). Larger pairs
such as Falcon-7B / Falcon-7B-Instruct from the paper are stronger but need a GPU. Rerun the benchmark
after changing models; the weights are fitted to the models in use.

## Calibration & benchmark

```bash
pip install -r requirements.txt
python download_weights.py
python ../scripts/fetch_benchmarks.py     # HC3, RAID, Ghostbuster, MAGE, FP-audit essays → benchmarks/data/
python ../scripts/eval_detectors.py       # fit + tune + report → detector_calibration.json, benchmarks/REPORT.md
npx tsx ../scripts/detector-benchmark.ts  # same data for the in-app heuristic fallback
```

`eval_detectors.py` splits every dataset 50/50 into calibration and held-out test halves. It fits the
ensemble weights on the calibration half and tunes each domain's temperature and bias so that FPR at
20% stays under 1.5% there. Domains with fewer than 12 human samples inherit the global setting, and
the others are shrunk toward it. The report covers the test half only: per domain, per dataset, per
adversarial attack and per generator. It includes the false-positive audit set (non-native TOEFL
essays, Stanford CS224N technical abstracts and college essays from Liang et al. 2023, all
human-written) and the plagiarism pipeline: RAID paraphrase pairs, verbatim / light-edit / mosaic
inserts, and unrelated human negatives.

Proof-of-Craft telemetry doesn't exist in public datasets, so the craft adjustment isn't part of the
benchmark. It only ever moves scores inside the 18–25 band.

## API

```bash
ENGINE_API_KEY=... python api.py                                   # binds 127.0.0.1:8000
ENGINE_API_KEY=... ENGINE_HOST=0.0.0.0 PORT=8000 python api.py     # behind a firewall / private network
```

| env var | default | meaning |
|---|---|---|
| `ENGINE_API_KEY` | **required** | Every call except `/health` needs `Authorization: Bearer <key>` or `x-api-key: <key>` (constant-time compare). The service refuses to start without it. |
| `ENGINE_INSECURE_DEV` | unset | `1` lets the engine start without `ENGINE_API_KEY` for local development. It logs a loud warning; never use it on a reachable network. |
| `ENGINE_INDEX_KEY` | unset | Separate key for corpus writes. When set, `POST /index` and `DELETE /index/{id}` require it instead of `ENGINE_API_KEY`. |
| `ENGINE_HOST` | `127.0.0.1` | Bind address for `python api.py`. Set `0.0.0.0` only behind a firewall or private network. |
| `PORT` | `8000` | Bind port. |
| `ENGINE_MAX_BODY_BYTES` | `2000000` | Request bodies larger than this get `413`, checked against `Content-Length` and while reading chunked bodies. |

Point the app at it with `AI_DETECTION_API_URL=https://engine/evaluate` and `AI_DETECTION_API_KEY=<key>`.

Input limits: `text` ≤ 200,000 characters (the same cap `text_prep` applies), at most 50 `external_refs`
with ≤ 200,000 characters of reference text in total, and `craft` is validated against the
`CraftTelemetry` shape (bounded numbers, ≤ 200 `growth` points, unknown keys ignored). The plagiarism
check processes at most 2,000 sentences and 500 paragraphs per request. Errors return a generic
`500 internal error`; details go to the server log only. Report status fields are coarse
(`ok` / `unavailable` / `disabled`, and for `plagiarism.semantic` also `empty corpus` / `no prose`).

Model downloads are pinned to Hub commits in `detector_calibration.json` → `revisions` (repo id → commit
sha) and transformers loads use `use_safetensors=True`. Update a pin deliberately when changing a model,
then rerun the benchmark.

`POST /evaluate`

```json
{ "article_id": "abc", "text": "markdown or HTML", "topic": "programming",
  "craft": { "typedChars": 9000, "pastedChars": 120, "sessions": 3, "activeMs": 5400000, "growth": [] },
  "external_refs": [{ "url": "https://…", "title": "…", "text": "reference passage" }] }
```

Response (abridged):

```json
{
  "verdict": "PASS | MANUAL_REVIEW | REJECT_AI | REJECT_PLAGIARISM",
  "overallAiScore": 7.4, "plagiarismScore": 0.0,
  "aiPassed": true, "plagiarismPassed": true,
  "detectedDomain": "programming", "confidenceLevel": "High",
  "flaggedSentences": [
    { "text": "…", "aiProbability": 0.81, "reason": "Reads 81% machine-written — driven by Desklib classifier; stock phrasing: 'delve into'." },
    { "text": "…", "aiProbability": 0.12, "plagiarismMatchUrl": "/ana/kafka-retries", "matchType": "PARAPHRASE",
      "reason": "Paraphrase of a passage in “Kafka retries” (89% similar). Quote it with attribution or rewrite it." }
  ],
  "signals": { "classifier": {}, "binoculars": {}, "burstiness": {}, "cliche": {}, "craft": null },
  "plagiarism": { "matches": [], "corpusParagraphs": 1234, "semantic": "ok" },
  "meta": { "wordCount": 1200, "proseWordCount": 980, "codeBlocksStripped": 3, "quotesExcluded": 1, "models": {} }
}
```

`POST /index` `{article_id, text, url, title}` adds a published story to the corpus. The app calls it
after a story publishes. `DELETE /index/{article_id}` removes one. `GET /health` returns only
`{"status": "ok", "service": "prism-detection-engine"}` and needs no key.

## Tests

```bash
python test_models.py --fast   # no model weights needed
python test_models.py          # full models
```
