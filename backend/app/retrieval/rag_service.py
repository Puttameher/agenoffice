from typing import List, Dict, Any
from backend.app.retrieval.vector_store import vector_store

DEFAULT_DOCUMENTS = {
    "company_guidelines.md": """
# Agentic AI Office Company Policies and Guidelines

The virtual office operates on autonomous agent principles. All employee agents must follow these standards:
- Always be accurate, polite, and directly address the user's intent.
- Coding tasks should use Python 3.12+ conventions, type hints, and clean docstrings.
- Financial tasks must format currency cleanly and state assumptions explicitly.
- Research tasks must cite key points and present a balanced summary.
- Standard office working hours are continuous 24/7 autonomous cycles.
""",
    "technical_stack.md": """
# Engineering Architecture and Stack

Our internal stack relies on:
- Backend: Python 3.12, FastAPI, LangGraph state engine, SQLite local storage.
- Agentic RAG: Vector search is invoked only when query requires external or domain knowledge.
- Tool Calling: Calculator for arithmetic and PythonRunner for controlled algorithmic scripts.
- Evaluation: Each task is graded for completeness, correctness, and adherence to user specifications.
"""
}

class RAGService:
    def __init__(self):
        self._initialized = False

    def initialize_documents(self):
        if self._initialized:
            return
        for doc_name, content in DEFAULT_DOCUMENTS.items():
            vector_store.add_document(doc_name, content, {"filename": doc_name})
        self._initialized = True

    def query(self, query_text: str, top_k: int = 2) -> List[Dict[str, Any]]:
        self.initialize_documents()
        return vector_store.similarity_search(query_text, top_k=top_k)

    def add_document(self, doc_id: str, content: str):
        vector_store.add_document(doc_id, content)

rag_service = RAGService()
