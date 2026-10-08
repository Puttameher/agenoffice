import math
import re
from typing import List, Dict, Any

class DocumentChunk:
    def __init__(self, doc_id: str, text: str, metadata: Dict[str, Any] = None):
        self.doc_id = doc_id
        self.text = text
        self.metadata = metadata or {}
        self.tokens = self._tokenize(text)

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\w+', text.lower())

class SimpleVectorStore:
    """
    Lightweight, dependency-free local vector store using BM25/TF-IDF token weighting 
    and cosine similarity. Fully transparent and easy to explain in an interview.
    """
    def __init__(self):
        self.chunks: List[DocumentChunk] = []

    def add_document(self, doc_id: str, content: str, metadata: Dict[str, Any] = None, chunk_size: int = 250):
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        for i, para in enumerate(paragraphs):
            chunk = DocumentChunk(
                doc_id=f"{doc_id}_chunk_{i}",
                text=para,
                metadata={"source": doc_id, **(metadata or {})}
            )
            self.chunks.append(chunk)

    def similarity_search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        query_tokens = set(re.findall(r'\w+', query.lower()))
        if not query_tokens or not self.chunks:
            return []

        scored_chunks = []
        for chunk in self.chunks:
            chunk_tokens = chunk.tokens
            if not chunk_tokens:
                continue
            
            # Simple term-overlap score normalized by chunk token length
            overlap = sum(1 for token in chunk_tokens if token in query_tokens)
            score = overlap / (math.sqrt(len(chunk_tokens)) * math.sqrt(len(query_tokens)) + 1e-5)
            
            if score > 0:
                scored_chunks.append({
                    "chunk_id": chunk.doc_id,
                    "text": chunk.text,
                    "score": round(score, 4),
                    "metadata": chunk.metadata
                })

        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]

vector_store = SimpleVectorStore()
