# Prism detector benchmark

Generated 2026-11-25 14:51 · AI threshold 20.0% · target FPR 1.5% · 552 calibration / 574 held-out test documents. All numbers below are on the **held-out test half** unless noted.

## Overall

### Test set

| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |
|---|---|---|---|---|---|---|---|---|---|
| calibrated ensemble | 280 | 294 | 0.979 | 0.935 | 0.957 | 2.1% | 1.5 | 3.8 | 82.3 |
| uncalibrated defaults | 280 | 294 | 0.909 | 0.956 | 0.932 | 10.0% | 7.8 | 37.8 | 88.0 |

### Phase 1 routing (AI <= 20.0% pass · <= 60.0% manual review · above: fail)

| | n | pass | manual review | auto-fail |
|---|---|---|---|---|
| human | 280 | 97.9% | 1.8% | 0.4% |
| AI | 294 | 6.5% | 9.9% | 83.7% |

### By domain (benchmark sets, excluding the audit essays)

| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |
|---|---|---|---|---|---|---|---|---|---|
| academic | 41 | 76 | 1.0 | 0.921 | 0.959 | 0.0% | 0.9 | 4.2 | 83.3 |
| essay | 41 | 49 | 1.0 | 0.837 | 0.911 | 0.0% | 0.1 | 0.0 | 65.6 |
| general | 9 | 34 | 1.0 | 1.0 | 1.0 | 0.0% | 0.3 | 1.7 | 95.8 |
| journalism | 76 | 84 | 1.0 | 0.94 | 0.969 | 0.0% | 0.1 | 0.2 | 84.0 |
| programming | 49 | 51 | 1.0 | 1.0 | 1.0 | 0.0% | 0.0 | 0.0 | 85.0 |

### False-positive audit (human-only: non-native TOEFL, CS224N technical abstracts, college essays)

| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |
|---|---|---|---|---|---|---|---|---|---|
| Audit/college essays | 23 | 0 | 0.0 | – | 0.0 | 4.3% | 1.9 | 1.2 | – |
| Audit/non-native English (TOEFL) | 22 | 0 | 0.0 | – | 0.0 | 9.1% | 8.3 | 51.6 | – |
| Audit/technical abstracts (CS224N) | 19 | 0 | 0.0 | – | 0.0 | 15.8% | 8.2 | 32.8 | – |
| all audit essays | 117 | 0 | 0.0 | – | 0.0 | 7.7% | 6.1 | 34.1 | – |

### By source dataset

| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |
|---|---|---|---|---|---|---|---|---|---|
| Audit/college essays | 23 | 0 | 0.0 | – | 0.0 | 4.3% | 1.9 | 1.2 | – |
| Audit/non-native English (TOEFL) | 22 | 0 | 0.0 | – | 0.0 | 9.1% | 8.3 | 51.6 | – |
| Audit/technical abstracts (CS224N) | 19 | 0 | 0.0 | – | 0.0 | 15.8% | 8.2 | 32.8 | – |
| Ghostbuster/reuter | 10 | 5 | 1.0 | 1.0 | 1.0 | 0.0% | 0.0 | 0.1 | 89.0 |
| Ghostbuster/wp | 13 | 12 | 1.0 | 1.0 | 1.0 | 0.0% | 0.2 | 1.2 | 66.4 |
| HC3/finance | 37 | 45 | 1.0 | 1.0 | 1.0 | 0.0% | 0.1 | 0.2 | 91.3 |
| HC3/medicine | 18 | 43 | 1.0 | 1.0 | 1.0 | 0.0% | 1.0 | 5.1 | 93.9 |
| HC3/open_qa | 6 | 34 | 1.0 | 1.0 | 1.0 | 0.0% | 0.5 | 2.1 | 95.8 |
| HC3/wiki_csai | 49 | 51 | 1.0 | 1.0 | 1.0 | 0.0% | 0.0 | 0.0 | 85.0 |
| MAGE/cmv | 3 | 6 | 1.0 | 0.167 | 0.286 | 0.0% | 0.0 | 0.0 | 9.6 |
| MAGE/eli5 | 3 | 0 | 1.0 | – | 0.0 | 0.0% | 0.0 | 0.0 | – |
| MAGE/sci_gen | 6 | 5 | 1.0 | 0.4 | 0.571 | 0.0% | 2.0 | 8.1 | 19.0 |
| MAGE/tldr | 1 | 7 | 1.0 | 1.0 | 1.0 | 0.0% | 0.0 | 0.0 | 93.2 |
| MAGE/wp | 7 | 1 | 1.0 | 1.0 | 1.0 | 0.0% | 0.0 | 0.1 | 85.8 |
| MAGE/xsum | 8 | 1 | 1.0 | 1.0 | 1.0 | 0.0% | 0.2 | 0.6 | 64.4 |
| RAID/abstracts | 17 | 28 | 1.0 | 0.893 | 0.943 | 0.0% | 0.3 | 1.4 | 78.6 |
| RAID/books | 18 | 30 | 1.0 | 0.9 | 0.947 | 0.0% | 0.0 | 0.0 | 75.7 |
| RAID/news | 20 | 26 | 1.0 | 0.808 | 0.894 | 0.0% | 0.1 | 0.2 | 68.7 |

### AI samples by adversarial attack (recall)

| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |
|---|---|---|---|---|---|---|---|---|---|
| none | 0 | 246 | 1.0 | 0.955 | 0.977 | – | – | – | 85.5 |
| paraphrase | 0 | 21 | 1.0 | 0.81 | 0.895 | – | – | – | 61.8 |
| synonym | 0 | 27 | 1.0 | 0.852 | 0.92 | – | – | – | 68.9 |

### AI samples by generator (recall)

| group | humans | AI | precision | recall | F1 | FPR | human mean | human p95 | AI mean |
|---|---|---|---|---|---|---|---|---|---|
| chatgpt | 0 | 194 | 1.0 | 1.0 | 1.0 | – | – | – | 90.2 |
| claude | 0 | 2 | 1.0 | 1.0 | 1.0 | – | – | – | 86.2 |
| cmv | 0 | 6 | 1.0 | 0.167 | 0.286 | – | – | – | 9.6 |
| cohere-chat | 0 | 17 | 1.0 | 0.588 | 0.741 | – | – | – | 46.0 |
| gpt | 0 | 15 | 1.0 | 1.0 | 1.0 | – | – | – | 71.3 |
| gpt4 | 0 | 13 | 1.0 | 0.769 | 0.87 | – | – | – | 64.6 |
| llama-chat | 0 | 20 | 1.0 | 0.95 | 0.974 | – | – | – | 87.2 |
| mistral-chat | 0 | 13 | 1.0 | 1.0 | 1.0 | – | – | – | 86.6 |
| sci | 0 | 5 | 1.0 | 0.4 | 0.571 | – | – | – | 19.0 |
| tldr | 0 | 7 | 1.0 | 1.0 | 1.0 | – | – | – | 93.2 |
| wp | 0 | 1 | 1.0 | 1.0 | 1.0 | – | – | – | 85.8 |
| xsum | 0 | 1 | 1.0 | 1.0 | 1.0 | – | – | – | 64.4 |

## Fitted ensemble

```json
{
  "weights": {
    "desklib": 0.6459,
    "roberta": 0.0621,
    "binoculars": 0.8845,
    "burst_window": 0.0,
    "burst_doc": 0.4448,
    "cliche_window": 0.1342,
    "cliche_doc": 0.1172
  },
  "bias": -1.476,
  "domains": {
    "programming": {
      "temperature": 0.6,
      "bias": -4.0,
      "n_human": 27,
      "n_ai": 45,
      "source": "tuned (shrinkage 0.75)"
    },
    "infrastructure": {
      "temperature": 0.6,
      "bias": -2.2,
      "n_human": 0,
      "n_ai": 0,
      "source": "global"
    },
    "academic": {
      "temperature": 1.0,
      "bias": -1.9,
      "n_human": 55,
      "n_ai": 76,
      "source": "tuned (shrinkage 1.00)"
    },
    "essay": {
      "temperature": 0.6,
      "bias": -2.2,
      "n_human": 83,
      "n_ai": 36,
      "source": "global"
    },
    "journalism": {
      "temperature": 0.6,
      "bias": -2.0,
      "n_human": 65,
      "n_ai": 109,
      "source": "tuned (shrinkage 1.00)"
    },
    "general": {
      "temperature": 0.6,
      "bias": -1.575,
      "n_human": 15,
      "n_ai": 41,
      "source": "tuned (shrinkage 0.42)"
    }
  }
}
```

## Human documents over the threshold (test)

- Audit/non-native English (TOEFL) (essay): 94.4%
- Audit/non-native English (TOEFL) (essay): 53.7%
- Audit/technical abstracts (CS224N) (academic): 53.0%
- Audit/college essays (essay): 40.3%
- Audit/technical abstracts (CS224N) (academic): 30.6%
- Audit/technical abstracts (CS224N) (academic): 25.1%

## Plagiarism pipeline

59 real source articles indexed (RAID); queries are RAID's own paraphrase attacks of them, programmatic copies inserted into unrelated human text, and 80 human documents that are not in the corpus.

| case | n | share over 15% | mean score |
|---|---|---|---|
| paraphrase (RAID/Dipper) | 59 | 98.3% | 60.8 |
| verbatim insert | 59 | 69.5% | 28.4 |
| light-edit insert | 59 | 67.8% | 27.6 |
| mosaic (interleaved) | 59 | 67.8% | 35.3 |
| human negatives (not in corpus) | 80 | 0.0% | 0.0 |

Semantic paragraph threshold sweep (paraphrase recall vs. unrelated-human FPR):

| cosine > | recall | FPR |
|---|---|---|
| 0.78 | 100.0% | 0.0% |
| 0.8 | 100.0% | 0.0% |
| 0.82 | 98.3% | 0.0% |
| 0.84 | 98.3% | 0.0% |
| 0.86 | 98.3% | 0.0% |
| 0.88 | 96.6% | 0.0% |
| 0.9 | 93.2% | 0.0% |
| 0.92 | 78.0% | 0.0% |

Chosen semantic threshold: 0.84
