from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class QuestionRequest(BaseModel):
    """Schema for incoming QA requests from the frontend."""
    question: str = Field(..., description="The user's natural language question.")
    paper_id: Optional[str] = Field(None, description="Optional ID to restrict search to a specific paper.")
    top_k: int = Field(30, description="Number of initial documents/facts to retrieve before re-ranking.")
    detailed: bool = Field(True, description="If True, generates a conversational answer. If False, extracts a strict concise answer.")

class AnswerResponse(BaseModel):
    """Schema for the outgoing QA response to the frontend."""
    question: str = Field(..., description="The original question.")
    answer: str = Field(..., description="The generated LLM answer.")
    evidence_paragraphs: List[Dict[str, Any]] = Field(..., description="Top re-ranked paragraphs used as context.")
    graph_facts: List[Dict[str, Any]] = Field(..., description="Extracted Neo4j triples used as context.")
    context: str = Field(..., description="The raw combined context string fed to the LLM.")