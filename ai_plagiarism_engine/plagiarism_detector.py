import os
import re
import chromadb
from sentence_transformers import SentenceTransformer
from datasketch import MinHash, MinHashLSH

class PlagiarismModel:
    """
    Dual-layer Plagiarism Detection Model:
    1. Lexical Exact/Near-Match: MinHash LSH (5-word shingles)
    2. Semantic Paraphrase Match: Dense Vector Search (sentence-transformers/all-MiniLM-L6-v2) + local ChromaDB
    Thresholds:
    - MinHash Jaccard similarity > 0.75 -> EXACT_LEXICAL / NEAR_EXACT
    - ChromaDB Cosine similarity > 0.85 -> SEMANTIC_PARAPHRASE
    """
    def __init__(self, persist_directory: str = "./vector_index"):
        self.persist_directory = persist_directory
        os.makedirs(persist_directory, exist_ok=True)

        # 1. Semantic Model & Vector DB
        self.encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        self.chroma_client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.chroma_client.get_or_create_collection(
            name="published_articles",
            metadata={"hnsw:space": "cosine"}
        )

        # 2. Lexical Model (MinHash LSH)
        # Using 128 permutations and threshold 0.75
        self.lsh = MinHashLSH(threshold=0.75, num_perm=128)
        self.minhash_registry = {}  # {paragraph_key: (minhash, article_id, text)}

        # Load existing collection entries into LSH if any exist
        self._sync_lsh_from_chroma()

    def _get_shingles(self, text: str, k: int = 5) -> set:
        """
        Tokenize and generate k-word shingles (lowercased alphanumeric tokens).
        """
        tokens = re.findall(r'\b\w+\b', text.lower())
        if len(tokens) < k:
            return {" ".join(tokens)} if tokens else set()
        return {" ".join(tokens[i:i+k]) for i in range(len(tokens) - k + 1)}

    def _create_minhash(self, text: str) -> MinHash:
        shingles = self._get_shingles(text, k=5)
        m = MinHash(num_perm=128)
        for s in shingles:
            m.update(s.encode('utf8'))
        return m

    def _split_into_paragraphs(self, text: str) -> list[str]:
        # Split on double linebreaks or single linebreaks if paragraphs are separated
        raw_paragraphs = [p.strip() for p in re.split(r'\n\s*\n|\r\n\s*\r\n', text)]
        # Filter out empty or trivially short paragraphs (< 20 chars)
        paragraphs = [p for p in raw_paragraphs if len(p) >= 20]
        if not paragraphs and text.strip():
            paragraphs = [text.strip()]
        return paragraphs

    def _sync_lsh_from_chroma(self):
        try:
            records = self.collection.get(include=["metadatas", "documents"])
            if records and records.get("ids"):
                for doc_id, meta, doc in zip(records["ids"], records["metadatas"], records["documents"]):
                    m = self._create_minhash(doc)
                    try:
                        self.lsh.insert(doc_id, m)
                    except Exception:
                        pass
                    self.minhash_registry[doc_id] = (m, meta.get("article_id", "unknown"), doc)
        except Exception as e:
            print(f"LSH initialization notice: {e}")

    def add_to_index(self, article_id: str, text: str):
        """
        Splits approved article into paragraphs and indexes them in ChromaDB and MinHash LSH.
        """
        paragraphs = self._split_into_paragraphs(text)
        if not paragraphs:
            return

        embeddings = self.encoder.encode(paragraphs, convert_to_numpy=True).tolist()
        ids = [f"{article_id}_p{idx}" for idx in range(len(paragraphs))]
        metadatas = [{"article_id": article_id, "para_index": idx} for idx in range(len(paragraphs))]

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=paragraphs
        )

        for doc_id, para in zip(ids, paragraphs):
            m = self._create_minhash(para)
            if doc_id in self.minhash_registry:
                try:
                    self.lsh.remove(doc_id)
                except Exception:
                    pass
            self.lsh.insert(doc_id, m)
            self.minhash_registry[doc_id] = (m, article_id, para)

    def check_plagiarism(self, text: str, current_article_id: str = "") -> dict:
        """
        Detects lexical (MinHash) and semantic (ChromaDB cosine) matches.
        """
        paragraphs = self._split_into_paragraphs(text)
        if not paragraphs:
            return {
                "is_plagiarized": False,
                "overall_similarity_score": 0.0,
                "matched_sources": []
            }

        matched_sources = []
        max_sim_scores = []

        total_stored = self.collection.count()

        for para in paragraphs:
            para_minhash = self._create_minhash(para)
            para_flagged = False

            # 1. Lexical Check (MinHash LSH)
            candidates = self.lsh.query(para_minhash)
            best_lexical_sim = 0.0
            best_lexical_match = None

            for cand_id in candidates:
                if cand_id in self.minhash_registry:
                    cand_mh, src_art_id, src_text = self.minhash_registry[cand_id]
                    if current_article_id and src_art_id == current_article_id:
                        continue  # Skip self-match
                    jaccard = para_minhash.jaccard(cand_mh)
                    if jaccard > best_lexical_sim:
                        best_lexical_sim = jaccard
                        best_lexical_match = (src_art_id, src_text, jaccard)

            if best_lexical_match and best_lexical_sim > 0.75:
                src_art_id, src_text, jaccard = best_lexical_match
                matched_sources.append({
                    "source_article_id": src_art_id,
                    "similarity_score": round(float(jaccard), 2),
                    "match_type": "EXACT_LEXICAL" if jaccard >= 0.95 else "NEAR_EXACT_MATCH",
                    "flagged_paragraph": para[:200] + ("..." if len(para) > 200 else "")
                })
                max_sim_scores.append(best_lexical_sim)
                para_flagged = True

            # 2. Semantic Paraphrase Check (Dense Vector Search via ChromaDB)
            if total_stored > 0:
                para_emb = self.encoder.encode([para], convert_to_numpy=True).tolist()
                query_results = self.collection.query(
                    query_embeddings=para_emb,
                    n_results=min(3, total_stored),
                    include=["metadatas", "distances", "documents"]
                )

                if query_results and query_results.get("ids") and query_results["ids"][0]:
                    for i in range(len(query_results["ids"][0])):
                        meta = query_results["metadatas"][0][i]
                        src_art_id = meta.get("article_id", "unknown")
                        if current_article_id and src_art_id == current_article_id:
                            continue

                        # Chroma cosine space returns distance: cosine_distance = 1 - cosine_similarity
                        distance = query_results["distances"][0][i]
                        cosine_sim = float(max(0.0, min(1.0, 1.0 - distance)))

                        if not para_flagged and cosine_sim > 0.85:
                            matched_sources.append({
                                "source_article_id": src_art_id,
                                "similarity_score": round(cosine_sim, 2),
                                "match_type": "SEMANTIC_PARAPHRASE",
                                "flagged_paragraph": para[:200] + ("..." if len(para) > 200 else "")
                            })
                            max_sim_scores.append(cosine_sim)
                            para_flagged = True
                            break
                        elif not para_flagged:
                            max_sim_scores.append(cosine_sim)

            if not para_flagged and not max_sim_scores:
                max_sim_scores.append(0.0)

        # Deduplicate matched sources by source_article_id & paragraph
        dedup_sources = []
        seen = set()
        for m in matched_sources:
            key = (m["source_article_id"], m["flagged_paragraph"])
            if key not in seen:
                seen.add(key)
                dedup_sources.append(m)

        overall_sim = float(max(max_sim_scores)) if max_sim_scores else 0.0
        is_plagiarized = bool(len(dedup_sources) > 0 or overall_sim >= 0.80)

        return {
            "is_plagiarized": is_plagiarized,
            "overall_similarity_score": round(overall_sim, 2),
            "matched_sources": dedup_sources
        }

