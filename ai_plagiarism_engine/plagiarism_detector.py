"""
3-layer hybrid plagiarism pipeline.

  Layer 1  Lexical: 5-gram shingles, winnowing fingerprints (Schleimer et al., 2003) for candidate
           retrieval, MinHash LSH for paragraph-level near-duplicates, then a per-sentence token
           overlap check (>= 85% of the sentence's tokens in a source sentence, in order) to catch
           verbatim and lightly edited copying, including mosaic/patchwork edits.
  Layer 2  Semantic: BAAI/bge-base-en-v1.5 paragraph embeddings, cosine search against the Prism
           corpus (persistent ChromaDB) and any external reference chunks sent with the request.
           Paragraphs above the threshold (0.84) are flagged even when every word was swapped.
  Layer 3  Quote & citation exclusion happens upstream in text_prep.prepare(): blockquotes and
           attributed quotations never reach this module.

plagiarismScore = share of the author's prose words that sit in flagged sentences (0–100).
"""
from __future__ import annotations

import hashlib
import os
import re
import threading
from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable, Optional

from text_prep import Prepared, split_paragraphs, split_sentences, words

K = 5  # shingle size (tokens)
W = 4  # winnowing window


def _h(s: str) -> int:
    return int.from_bytes(hashlib.blake2b(s.encode("utf8"), digest_size=8).digest(), "big")


def shingles(tokens: list[str], k: int = K) -> list[int]:
    if len(tokens) < k:
        return [_h(" ".join(tokens))] if tokens else []
    return [_h(" ".join(tokens[i : i + k])) for i in range(len(tokens) - k + 1)]


def winnow(hashes: list[int], w: int = W) -> set[int]:
    """Robust winnowing: the minimum hash of every window of w consecutive shingles."""
    if len(hashes) <= w:
        return set(hashes)
    fps, last = set(), -1
    for i in range(len(hashes) - w + 1):
        win = hashes[i : i + w]
        m = min(win)
        j = i + (w - 1 - win[::-1].index(m))  # rightmost minimum
        if j != last:
            fps.add(m)
            last = j
    return fps


def _next_key(key: str) -> str:
    """'<article>::p3' → '<article>::p4'"""
    base, _, n = key.rpartition("::p")
    return f"{base}::p{int(n) + 1}" if n.isdigit() else ""


def token_overlap(q: list[str], src: list[str]) -> float:
    """Share of q's tokens matched, in order, in src (difflib matching blocks)."""
    if not q:
        return 0.0
    sm = SequenceMatcher(None, q, src, autojunk=False)
    return sum(b.size for b in sm.get_matching_blocks()) / len(q)


@dataclass
class SourcePara:
    key: str
    article_id: str
    url: str
    title: str
    text: str
    sentences: list[list[str]]
    sentence_text: list[str]


class PlagiarismDetector:
    def __init__(self, cfg: dict, persist_directory: Optional[str] = None, load_embeddings: bool = True):
        self.cfg = cfg["plagiarism"]
        self.persist_directory = persist_directory
        self._lock = threading.RLock()
        self.paras: dict[str, SourcePara] = {}
        self.fp_index: dict[int, set[str]] = defaultdict(set)
        self._encoder = None
        self._encoder_error: Optional[str] = None
        self._collection = None
        self._load_embeddings = load_embeddings
        self._lsh = None
        self._minhashes: dict[str, object] = {}
        try:
            from datasketch import MinHashLSH

            self._lsh = MinHashLSH(threshold=0.5, num_perm=128)
        except Exception:  # noqa: BLE001 - LSH is an accelerator; winnowing still works without it
            self._lsh = None
        if persist_directory:
            self._open_store()

    # ------------------------------------------------------------ models / storage
    @property
    def encoder(self):
        if self._encoder is None and self._encoder_error is None and self._load_embeddings:
            try:
                from sentence_transformers import SentenceTransformer

                self._encoder = SentenceTransformer(self.cfg["embedding_model"])
            except Exception as e:  # noqa: BLE001
                self._encoder_error = f"{type(e).__name__}: {e}"
        return self._encoder

    def embed(self, texts: list[str]):
        enc = self.encoder
        if enc is None or not texts:
            return None
        return enc.encode(texts, normalize_embeddings=True, convert_to_numpy=True, batch_size=16)

    def _open_store(self):
        try:
            import chromadb

            os.makedirs(self.persist_directory, exist_ok=True)
            client = chromadb.PersistentClient(path=self.persist_directory)
            name = "prism_paragraphs_" + re.sub(r"[^a-z0-9]+", "_", self.cfg["embedding_model"].lower()).strip("_")[:40]
            self._collection = client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})
            rec = self._collection.get(include=["metadatas", "documents"])
            for pid, meta, doc in zip(rec.get("ids") or [], rec.get("metadatas") or [], rec.get("documents") or []):
                self._add_lexical(pid, meta.get("article_id", ""), meta.get("url", ""), meta.get("title", ""), doc)
        except Exception as e:  # noqa: BLE001
            self._collection = None
            self._encoder_error = self._encoder_error or f"vector store unavailable: {e}"

    def _minhash(self, toks: list[str]):
        from datasketch import MinHash

        m = MinHash(num_perm=128)
        for s in {" ".join(toks[i : i + 3]) for i in range(max(1, len(toks) - 2))}:
            m.update(s.encode("utf8"))
        return m

    def _add_lexical(self, key: str, article_id: str, url: str, title: str, text: str):
        sents = split_sentences(text)
        sp = SourcePara(key, article_id, url, title, text, [words(s) for s in sents], sents)
        self.paras[key] = sp
        toks = words(text)
        for fp in winnow(shingles(toks)):
            self.fp_index[fp].add(key)
        if self._lsh is not None and len(toks) >= 8:
            m = self._minhash(toks)
            if key in self._minhashes:
                try:
                    self._lsh.remove(key)
                except Exception:  # noqa: BLE001
                    pass
            self._lsh.insert(key, m)
            self._minhashes[key] = m

    # ------------------------------------------------------------ corpus maintenance
    def index(self, article_id: str, text: str, url: str = "", title: str = "", prepared: Optional[Prepared] = None):
        """Add (or replace) a published article. Quotes/code are stripped so they never match later."""
        from text_prep import prepare

        prep = prepared or prepare(text)
        paras = prep.paragraphs
        with self._lock:
            self.remove(article_id)
            keys = [f"{article_id}::p{i}" for i in range(len(paras))]
            for k, p in zip(keys, paras):
                self._add_lexical(k, article_id, url, title, p)
            if self._collection is not None and paras:
                emb = self.embed(paras)
                if emb is not None:
                    self._collection.upsert(
                        ids=keys,
                        embeddings=emb.tolist(),
                        documents=paras,
                        metadatas=[{"article_id": article_id, "url": url, "title": title, "para_index": i} for i in range(len(paras))],
                    )
        return len(paras)

    def remove(self, article_id: str):
        with self._lock:
            keys = [k for k, p in self.paras.items() if p.article_id == article_id]
            for k in keys:
                p = self.paras.pop(k)
                for fp in winnow(shingles(words(p.text))):
                    self.fp_index.get(fp, set()).discard(k)
                if self._lsh is not None and k in self._minhashes:
                    try:
                        self._lsh.remove(k)
                    except Exception:  # noqa: BLE001
                        pass
                    self._minhashes.pop(k, None)
            if self._collection is not None and keys:
                try:
                    self._collection.delete(ids=keys)
                except Exception:  # noqa: BLE001
                    pass
            return len(keys)

    @property
    def size(self) -> int:
        return len(self.paras)

    # ------------------------------------------------------------ checking
    def check(
        self,
        prep: Prepared,
        exclude_article_id: str = "",
        external: Optional[Iterable[dict]] = None,
    ) -> dict:
        min_words = int(self.cfg.get("min_sentence_words", 8))
        lex_thr = float(self.cfg["lexical_overlap"])
        sem_thr = float(self.cfg["semantic_threshold"])
        sent_thr = float(self.cfg.get("sentence_semantic_threshold", sem_thr + 0.02))

        # External references are treated as an extra, request-scoped corpus
        ext_paras: list[SourcePara] = []
        for i, ref in enumerate(external or []):
            body = (ref.get("text") or "").strip()
            if not body:
                continue
            for j, p in enumerate(split_paragraphs(body)):
                s = split_sentences(p)
                ext_paras.append(SourcePara(f"ext{i}::p{j}", ref.get("id") or f"external-{i}", ref.get("url") or "", ref.get("title") or "", p, [words(x) for x in s], s))
        ext_fp: dict[int, set[int]] = defaultdict(set)
        for idx, sp in enumerate(ext_paras):
            for fp in winnow(shingles(words(sp.text))):
                ext_fp[fp].add(idx)

        sentences = prep.sentences
        sent_tokens = [words(s) for s in sentences]
        flagged: dict[int, dict] = {}

        def source_of(key_or_idx) -> Optional[SourcePara]:
            if isinstance(key_or_idx, int):
                return ext_paras[key_or_idx]
            p = self.paras.get(key_or_idx)
            if p is None or (exclude_article_id and p.article_id == exclude_article_id):
                return None
            return p

        # ---- Layer 1: lexical, per sentence
        with self._lock:
            for si, toks in enumerate(sent_tokens):
                if len(toks) < min_words:
                    continue
                # Every query shingle is looked up against the sources' winnowed fingerprints
                cands: set = set()
                for fp in shingles(toks):
                    cands |= self.fp_index.get(fp, set())
                    cands |= ext_fp.get(fp, set())
                best = (0.0, None, "")
                for c in cands:
                    sp = source_of(c)
                    if sp is None:
                        continue
                    # Compare against the paragraph plus its neighbour, not single sentences: hard-wrapped
                    # sources split sentences across lines, and a copied sentence can span two of them
                    nxt = self.paras.get(_next_key(c)) if isinstance(c, str) else (ext_paras[c + 1] if c + 1 < len(ext_paras) else None)
                    ctx = words(sp.text) + (words(nxt.text) if nxt is not None and nxt.article_id == sp.article_id else [])
                    ov = token_overlap(toks, ctx)
                    if ov > best[0]:
                        shown = max(zip(sp.sentences, sp.sentence_text), key=lambda x: token_overlap(toks, x[0]), default=([], sp.text))[1]
                        best = (ov, sp, shown)
                if best[1] is not None and best[0] >= lex_thr:
                    sp = best[1]
                    flagged[si] = {
                        "layer": "lexical",
                        "matchType": "VERBATIM" if best[0] >= 0.98 else "NEAR_VERBATIM",
                        "similarity": round(best[0], 3),
                        "sourceId": sp.article_id,
                        "sourceUrl": sp.url,
                        "sourceTitle": sp.title,
                        "sourceText": best[2][:300],
                    }

            # Paragraph-level MinHash: catches patchwork that re-orders sentences
            if self._lsh is not None:
                for para in prep.paragraphs:
                    toks = words(para)
                    if len(toks) < 20:
                        continue
                    for key in self._lsh.query(self._minhash(toks)):
                        sp = source_of(key)
                        if sp is None:
                            continue
                        for si, s in enumerate(sentences):
                            if si in flagged or len(sent_tokens[si]) < min_words or s not in para:
                                continue
                            best = max((token_overlap(sent_tokens[si], st) for st in sp.sentences), default=0.0)
                            if best >= lex_thr - 0.1:  # inside a near-duplicate paragraph, accept lighter overlap
                                flagged[si] = {
                                    "layer": "lexical",
                                    "matchType": "MOSAIC",
                                    "similarity": round(best, 3),
                                    "sourceId": sp.article_id,
                                    "sourceUrl": sp.url,
                                    "sourceTitle": sp.title,
                                    "sourceText": sp.text[:300],
                                }

        # ---- Layer 2: semantic, per paragraph
        semantic_status = "ok"
        paras = prep.paragraphs
        if paras and (self._collection is not None and self._collection.count() > 0 or ext_paras):
            q = self.embed(paras)
            if q is None:
                semantic_status = f"unavailable: {self._encoder_error}"
            else:
                import numpy as np

                hits: list[list[tuple[float, SourcePara]]] = [[] for _ in paras]
                if self._collection is not None and self._collection.count() > 0:
                    res = self._collection.query(
                        query_embeddings=q.tolist(),
                        n_results=min(5, self._collection.count()),
                        include=["metadatas", "distances", "documents"],
                    )
                    for pi in range(len(paras)):
                        for pid, dist in zip(res["ids"][pi], res["distances"][pi]):
                            sp = source_of(pid)
                            if sp is not None:
                                hits[pi].append((1.0 - float(dist), sp))
                if ext_paras:
                    e = self.embed([p.text for p in ext_paras])
                    sims = q @ e.T
                    for pi in range(len(paras)):
                        for j in np.argsort(-sims[pi])[:3]:
                            hits[pi].append((float(sims[pi, j]), ext_paras[j]))

                for pi, para in enumerate(paras):
                    if not hits[pi]:
                        continue
                    sim, sp = max(hits[pi], key=lambda x: x[0])
                    if sim <= sem_thr:
                        continue
                    idxs = [si for si, s in enumerate(sentences) if s in para and len(sent_tokens[si]) >= min_words]
                    if not idxs:
                        continue
                    # Pin the match to sentences: those with a close source sentence; else the whole paragraph
                    se = self.embed([sentences[si] for si in idxs])
                    src_s = sp.sentence_text or [sp.text]
                    ss = self.embed(src_s)
                    pair = se @ ss.T
                    chosen = [(si, float(pair[k].max()), src_s[int(pair[k].argmax())]) for k, si in enumerate(idxs) if pair[k].max() > sent_thr]
                    if not chosen:
                        chosen = [(si, sim, sp.text) for si in idxs]
                    for si, s_sim, stext in chosen:
                        if si in flagged:
                            continue
                        flagged[si] = {
                            "layer": "semantic",
                            "matchType": "PARAPHRASE",
                            "similarity": round(s_sim, 3),
                            "paragraphSimilarity": round(sim, 3),
                            "sourceId": sp.article_id,
                            "sourceUrl": sp.url,
                            "sourceTitle": sp.title,
                            "sourceText": stext[:300],
                        }
        elif not paras:
            semantic_status = "no prose"
        else:
            semantic_status = "empty corpus"

        total = sum(len(t) for t in sent_tokens) or 1
        copied = sum(len(sent_tokens[si]) for si in flagged)
        sources: dict[str, dict] = {}
        for si, f in flagged.items():
            s = sources.setdefault(f["sourceId"], {"sourceId": f["sourceId"], "sourceUrl": f["sourceUrl"], "sourceTitle": f["sourceTitle"], "words": 0, "sentences": 0, "maxSimilarity": 0.0, "matchTypes": set()})
            s["words"] += len(sent_tokens[si])
            s["sentences"] += 1
            s["maxSimilarity"] = max(s["maxSimilarity"], f["similarity"])
            s["matchTypes"].add(f["matchType"])
        matches = sorted(
            ({**s, "percent": round(100 * s["words"] / total, 1), "matchTypes": sorted(s["matchTypes"])} for s in sources.values()),
            key=lambda x: -x["words"],
        )
        return {
            "plagiarismScore": round(100 * copied / total, 1),
            "flagged": {si: f for si, f in sorted(flagged.items())},
            "matches": matches,
            "corpusParagraphs": self.size,
            "externalParagraphs": len(ext_paras),
            "semantic": semantic_status,
        }
