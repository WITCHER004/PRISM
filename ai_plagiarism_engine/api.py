import hmac
import os
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from analyzer import ArticleAnalyzer

# Requests must carry ENGINE_API_KEY (Authorization: Bearer <key> or x-api-key) when it is set.
API_KEY = os.environ.get("ENGINE_API_KEY", "")


def require_key(authorization: Optional[str] = Header(default=None), x_api_key: Optional[str] = Header(default=None)):
    if not API_KEY:
        return
    given = x_api_key or (authorization[7:] if authorization and authorization.lower().startswith("bearer ") else "")
    if not hmac.compare_digest(given.encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="invalid API key")


class ExternalRef(BaseModel):
    id: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    text: str = Field(..., max_length=50_000)


class ArticleRequest(BaseModel):
    article_id: str = Field(..., max_length=128)
    text: str = Field(..., min_length=10, max_length=400_000)
    topic: Optional[str] = Field(default=None, max_length=64, description="Prism topic slug, e.g. programming")
    craft: Optional[dict] = Field(default=None, description="Prism editor CraftTelemetry")
    external_refs: List[ExternalRef] = Field(default_factory=list, max_length=50)


class IndexRequest(BaseModel):
    article_id: str = Field(..., max_length=128)
    text: str = Field(..., min_length=10, max_length=400_000)
    url: str = Field(default="", max_length=500)
    title: str = Field(default="", max_length=300)


app = FastAPI(title="Prism AI & Plagiarism Engine", version="2.0.0")

INDEX_DIR = os.environ.get("VECTOR_INDEX_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_index"))
analyzer = ArticleAnalyzer(vector_dir=INDEX_DIR)


@app.on_event("startup")
def _warm():
    if os.environ.get("ENGINE_WARMUP", "1") == "1" and analyzer.ai is not None:
        analyzer.ai.warmup()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "prism-detection-engine",
        "calibration": analyzer.cfg.get("version"),
        "corpusParagraphs": analyzer.plagiarism.size,
    }


@app.post("/evaluate", dependencies=[Depends(require_key)])
def evaluate(req: ArticleRequest):
    try:
        return analyzer.analyze_article(
            req.article_id, req.text, topic=req.topic, craft=req.craft, external_refs=[r.model_dump() for r in req.external_refs]
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


@app.post("/index", dependencies=[Depends(require_key)])
def index(req: IndexRequest):
    n = analyzer.index_article(req.article_id, req.text, url=req.url, title=req.title)
    return {"status": "success", "indexed_article_id": req.article_id, "paragraphs": n}


@app.delete("/index/{article_id}", dependencies=[Depends(require_key)])
def unindex(article_id: str):
    return {"status": "success", "removed_paragraphs": analyzer.remove_article(article_id)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), reload=False)
