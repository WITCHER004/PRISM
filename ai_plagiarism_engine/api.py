import hmac
import logging
import os
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

log = logging.getLogger("prism.engine")

# ---------------------------------------------------------------- auth configuration
# Every call except /health needs ENGINE_API_KEY (Authorization: Bearer <key> or x-api-key). The service
# refuses to start without one unless ENGINE_INSECURE_DEV=1 is set explicitly for local development.
API_KEY = os.environ.get("ENGINE_API_KEY", "").strip()
# Optional separate key for corpus writes (POST /index, DELETE /index/{id}); falls back to ENGINE_API_KEY.
INDEX_KEY = os.environ.get("ENGINE_INDEX_KEY", "").strip()
INSECURE_DEV = os.environ.get("ENGINE_INSECURE_DEV", "") == "1"

if not API_KEY:
    if not INSECURE_DEV:
        raise RuntimeError(
            "ENGINE_API_KEY is not set. The detection engine refuses to start without an API key. "
            "Set ENGINE_API_KEY (and the app's AI_DETECTION_API_KEY to the same value), or set "
            "ENGINE_INSECURE_DEV=1 to run unauthenticated for local development only."
        )
    log.warning(
        "!!! ENGINE_INSECURE_DEV=1 and ENGINE_API_KEY is empty: /evaluate%s accept UNAUTHENTICATED requests. "
        "Never run this configuration on a reachable network. !!!",
        "" if INDEX_KEY else " and /index",
    )

MAX_BODY_BYTES = int(os.environ.get("ENGINE_MAX_BODY_BYTES", "2000000"))
MAX_TEXT_CHARS = 200_000  # same as text_prep.MAX_CHARS
MAX_EXTERNAL_REF_CHARS = 200_000  # total across all external_refs


def _presented_key(authorization: Optional[str], x_api_key: Optional[str]) -> str:
    if x_api_key:
        return x_api_key
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def _check(expected: str, authorization: Optional[str], x_api_key: Optional[str]):
    if not expected:
        return  # only reachable with ENGINE_INSECURE_DEV=1 (checked at import)
    given = _presented_key(authorization, x_api_key)
    if not hmac.compare_digest(given.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="invalid API key")


def require_key(authorization: Optional[str] = Header(default=None), x_api_key: Optional[str] = Header(default=None)):
    _check(API_KEY, authorization, x_api_key)


def require_index_key(authorization: Optional[str] = Header(default=None), x_api_key: Optional[str] = Header(default=None)):
    _check(INDEX_KEY or API_KEY, authorization, x_api_key)


# ---------------------------------------------------------------- request body limit
class BodySizeLimit:
    """Pure ASGI middleware: 413 for bodies over max_bytes, by Content-Length and while reading (chunked)."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    @staticmethod
    async def _reject(send, status: int, detail: str):
        body = ('{"detail":"%s"}' % detail).encode()
        await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        for name, value in scope.get("headers") or []:
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    return await self._reject(send, 400, "invalid Content-Length")
                if declared > self.max_bytes:
                    return await self._reject(send, 413, "request body too large")
        # Buffer the body up to the limit (covers chunked bodies and lying Content-Length), then replay it
        chunks, total = [], 0
        while True:
            msg = await receive()
            if msg["type"] == "http.disconnect":
                return
            body = msg.get("body", b"")
            total += len(body)
            if total > self.max_bytes:
                return await self._reject(send, 413, "request body too large")
            chunks.append(body)
            if not msg.get("more_body", False):
                break
        data, replayed = b"".join(chunks), False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": data, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


# ---------------------------------------------------------------- request models
class GrowthPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ms: float = Field(default=0, ge=0, le=1e12)
    words: float = Field(default=0, ge=0, le=1e7)


class CraftTelemetry(BaseModel):
    """Mirrors CraftTelemetry in src/lib/craft.ts; only the fields calibration.craft_evidence reads."""

    model_config = ConfigDict(extra="ignore")
    v: Optional[int] = Field(default=None, ge=0, le=1000)
    startedAt: Optional[float] = Field(default=None, ge=0, le=1e14)
    lastAt: Optional[float] = Field(default=None, ge=0, le=1e14)
    activeMs: Optional[float] = Field(default=None, ge=0, le=1e12)
    sessions: Optional[int] = Field(default=None, ge=0, le=100_000)
    typedChars: Optional[float] = Field(default=None, ge=0, le=1e9)
    pastedChars: Optional[float] = Field(default=None, ge=0, le=1e9)
    dictatedChars: Optional[float] = Field(default=None, ge=0, le=1e9)
    growth: List[GrowthPoint] = Field(default_factory=list, max_length=200)


class ExternalRef(BaseModel):
    id: Optional[str] = Field(default=None, max_length=128)
    url: Optional[str] = Field(default=None, max_length=500)
    title: Optional[str] = Field(default=None, max_length=300)
    text: str = Field(..., max_length=50_000)


class ArticleRequest(BaseModel):
    article_id: str = Field(..., max_length=128)
    text: str = Field(..., min_length=10, max_length=MAX_TEXT_CHARS)
    topic: Optional[str] = Field(default=None, max_length=64, description="Prism topic slug, e.g. programming")
    craft: Optional[CraftTelemetry] = Field(default=None, description="Prism editor CraftTelemetry")
    external_refs: List[ExternalRef] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def _cap_external(self):
        if sum(len(r.text) for r in self.external_refs) > MAX_EXTERNAL_REF_CHARS:
            raise ValueError(f"external_refs text exceeds {MAX_EXTERNAL_REF_CHARS} characters in total")
        return self


class IndexRequest(BaseModel):
    article_id: str = Field(..., max_length=128)
    text: str = Field(..., min_length=10, max_length=MAX_TEXT_CHARS)
    url: str = Field(default="", max_length=500)
    title: str = Field(default="", max_length=300)


# ---------------------------------------------------------------- app
from analyzer import ArticleAnalyzer  # noqa: E402  (after the auth check, so a misconfigured start fails fast)

app = FastAPI(title="Prism AI & Plagiarism Engine", version="2.0.0")
app.add_middleware(BodySizeLimit, max_bytes=MAX_BODY_BYTES)

INDEX_DIR = os.environ.get("VECTOR_INDEX_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_index"))
analyzer = ArticleAnalyzer(vector_dir=INDEX_DIR)


@app.on_event("startup")
def _warm():
    if os.environ.get("ENGINE_WARMUP", "1") == "1" and analyzer.ai is not None:
        analyzer.ai.warmup()


@app.get("/health")
def health():
    # Unauthenticated: liveness only, nothing about config, corpus or models
    return {"status": "ok", "service": "prism-detection-engine"}


@app.post("/evaluate", dependencies=[Depends(require_key)])
def evaluate(req: ArticleRequest):
    try:
        return analyzer.analyze_article(
            req.article_id,
            req.text,
            topic=req.topic,
            craft=req.craft.model_dump(exclude_none=True) if req.craft else None,
            external_refs=[r.model_dump() for r in req.external_refs],
        )
    except Exception:  # noqa: BLE001
        log.exception("evaluate failed for article %r", req.article_id)
        raise HTTPException(status_code=500, detail="internal error")


@app.post("/index", dependencies=[Depends(require_index_key)])
def index(req: IndexRequest):
    try:
        n = analyzer.index_article(req.article_id, req.text, url=req.url, title=req.title)
    except Exception:  # noqa: BLE001
        log.exception("index failed for article %r", req.article_id)
        raise HTTPException(status_code=500, detail="internal error")
    return {"status": "success", "indexed_article_id": req.article_id, "paragraphs": n}


@app.delete("/index/{article_id}", dependencies=[Depends(require_index_key)])
def unindex(article_id: str):
    try:
        removed = analyzer.remove_article(article_id)
    except Exception:  # noqa: BLE001
        log.exception("unindex failed for article %r", article_id)
        raise HTTPException(status_code=500, detail="internal error")
    return {"status": "success", "removed_paragraphs": removed}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api:app",
        host=os.environ.get("ENGINE_HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        reload=False,
    )
