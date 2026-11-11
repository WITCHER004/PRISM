# AI & Plagiarism Detection ML Engine

Standalone Machine Learning Engine providing unified **AI-Generated Text Detection** and **Dual-Layer Plagiarism Detection** for article publishing pipelines.

---

## Architecture Overview

### 1. AI-Generated Text Detection (`ai_detector.py`)
- **Transformer Classifier (70% weight):** Powered by `roberta-base-openai-detector`. Uses a 350-word sliding window with a 175-word stride to handle articles of arbitrary length (1,000–5,000+ words) without truncation.
- **Statistical Linguistics (30% weight):** Uses `gpt2` (`GPT2LMHeadModel`) to compute:
  - Document-level Perplexity (`doc_perplexity`).
  - Sentence-level Perplexities (`sentence_perplexities`).
  - Burstiness (`burstiness_std`): Standard deviation of sentence perplexities and sentence length variance.
- **Sentence-Level Flagging:** Automatically extracts and flags individual sentences with low perplexity (`< 35.0`) and high AI confidence.

### 2. Dual-Layer Plagiarism Detection (`plagiarism_detector.py`)
- **Lexical Exact/Near-Match:** MinHash LSH with 5-word shingles (`datasketch`) with similarity threshold `> 0.75`.
- **Semantic Paraphrase Match:** Dense vector embeddings using `sentence-transformers/all-MiniLM-L6-v2` with local persistent ChromaDB (`./vector_index`) cosine similarity `> 0.85`.
- **Dynamic Corpus Indexing:** `add_to_index(article_id, text)` method adds newly published articles to the reference corpus in real time.

### 3. Unified Analyzer Pipeline (`analyzer.py`)
Single evaluation entrypoint `analyze_article(article_id, text)` returning the strict JSON schema with verdicts:
- `REJECT_PLAGIARISM`
- `REJECT_AI`
- `MANUAL_REVIEW`
- `PASS`

---

## Directory Structure
```
ai_plagiarism_engine/
├── __init__.py
├── requirements.txt
├── download_weights.py        # Model weight downloader & cacher
├── ai_detector.py             # AIDetectorModel (Transformer + PPL + Burstiness)
├── plagiarism_detector.py     # PlagiarismModel (MinHash LSH + ChromaDB embeddings)
├── analyzer.py                # ArticleAnalyzer unified interface
├── api.py                     # FastAPI REST wrapper (POST /evaluate, POST /index)
├── test_models.py             # Verification test suite
└── vector_index/              # Persistent ChromaDB store
```

---

## Setup & Running

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Download and Cache Models
```bash
python download_weights.py
```

### 3. Run Verification Tests
```bash
python test_models.py
```

### 4. Start the FastAPI Service
```bash
uvicorn api:app --host 0.0.0.0 --port 8000
```

### 5. API Endpoints

#### Evaluate Article
`POST /evaluate`
```json
{
  "article_id": "art_101",
  "text": "Your article content goes here..."
}
```

Response:
```json
{
  "article_id": "art_101",
  "verdict": "PASS | MANUAL_REVIEW | REJECT_AI | REJECT_PLAGIARISM",
  "ai_detection": {
    "is_ai_generated": true,
    "overall_ai_probability": 0.87,
    "transformer_score": 0.95,
    "perplexity_score": 14.4,
    "burstiness_std": 25.4,
    "flagged_ai_sentences": [
      {
        "sentence": "It is important to note that artificial intelligence has become increasingly popular in recent years...",
        "ai_Confidence": 0.87,
        "perplexity": 7.3
      }
    ]
  },
  "plagiarism_detection": {
    "is_plagiarized": false,
    "overall_similarity_score": 0.03,
    "matched_sources": []
  }
}
```

#### Index Approved Article
`POST /index`
```json
{
  "article_id": "art_101",
  "text": "Approved article text to store in plagiarism corpus..."
}
```

