import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from analyzer import ArticleAnalyzer

# Define Request and Response Schemas
class ArticleRequest(BaseModel):
    article_id: str = Field(..., description="Unique ID of the submitted article")
    text: str = Field(..., min_length=10, description="Article content to evaluate")

class IndexRequest(BaseModel):
    article_id: str = Field(..., description="Unique ID of the published article")
    text: str = Field(..., min_length=10, description="Article content to add to reference corpus")

class FlaggedSentence(BaseModel):
    sentence: str
    ai_Confidence: float
    perplexity: float

class AIDetectionResult(BaseModel):
    is_ai_generated: bool
    overall_ai_probability: float
    transformer_score: float
    perplexity_score: float
    burstiness_std: float
    flagged_ai_sentences: List[FlaggedSentence]

class MatchedSource(BaseModel):
    source_article_id: str
    similarity_score: float
    match_type: str
    flagged_paragraph: str

class PlagiarismResult(BaseModel):
    is_plagiarized: bool
    overall_similarity_score: float
    matched_sources: List[MatchedSource]

class EvaluationResponse(BaseModel):
    article_id: str
    verdict: str
    ai_detection: AIDetectionResult
    plagiarism_detection: PlagiarismResult

app = FastAPI(
    title="AI & Plagiarism Detection ML Engine",
    description="High-performance ML Engine for AI text classification, linguistic perplexity, and dual-layer plagiarism detection.",
    version="1.0.0"
)

# Persistent index path inside ./ai_plagiarism_engine/vector_index
INDEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_index")
analyzer = ArticleAnalyzer(vector_dir=INDEX_DIR)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-plagiarism-engine"}

@app.post("/evaluate", response_model=EvaluationResponse)
def evaluate_article(request: ArticleRequest):
    """
    Evaluates submitted text for AI generation and plagiarism.
    Returns structured analysis matching strict schema.
    """
    try:
        result = analyzer.analyze_article(request.article_id, request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/index")
def index_approved_article(request: IndexRequest):
    """
    Adds an approved/published article to the reference corpus for future plagiarism checks.
    """
    try:
        analyzer.index_article(request.article_id, request.text)
        return {"status": "success", "indexed_article_id": request.article_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)

